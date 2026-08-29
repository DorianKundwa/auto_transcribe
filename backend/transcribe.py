"""
transcribe.py
-------------
WhisperX transcription pipeline with in-memory model caching and progress callbacks.
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# PyTorch 2.6+ compatibility for model checkpoints
# ---------------------------------------------------------------------------
try:
    import functools
    import torch
    _orig_torch_load = torch.load

    @functools.wraps(_orig_torch_load)
    def _patched_torch_load(*args, **kwargs):
        kwargs["weights_only"] = False
        return _orig_torch_load(*args, **kwargs)

    torch.load = _patched_torch_load
except Exception:
    pass

# ---------------------------------------------------------------------------
# Model cache — keeps the WhisperX ASR model in memory between jobs so
# consecutive transcriptions don't pay the model-load cost each time.
# ---------------------------------------------------------------------------
_asr_cache: dict[str, Any] = {}       # key: "<model_name>:<device>"
_align_cache: dict[str, Any] = {}     # key: "<language>:<device>"


def _get_device(requested: str) -> tuple[str, int]:
    """
    Resolve device string to (device_str, compute_int).

    Returns ('cuda', 0) if CUDA is available and requested,
    else falls back to ('cpu', 0).
    """
    try:
        import torch
        cuda_ok = torch.cuda.is_available()
    except ImportError:
        cuda_ok = False

    if requested in ("cuda", "auto") and cuda_ok:
        return "cuda", 0
    return "cpu", 0


# ---------------------------------------------------------------------------
# FFmpeg helper
# ---------------------------------------------------------------------------

def ffmpeg_to_wav(input_path: str, output_path: str) -> None:
    """Convert any audio file to 16 kHz mono WAV using ffmpeg."""
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-ar", "16000",
        "-ac", "1",
        "-f", "wav",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg conversion failed:\n{result.stderr}"
        )


def get_audio_duration(path: str) -> float:
    """Use ffprobe to get audio duration in seconds."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        path,
    ]
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, text=True)
        return float(out.strip())
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

async def run_transcription(
    audio_path: str,
    model_name: str = "base",
    language: Optional[str] = None,
    device_req: str = "auto",
    pause_threshold: float = 0.75,
    progress_cb: Optional[Callable[[str, int], None]] = None,
) -> dict[str, Any]:
    """
    Full WhisperX transcription pipeline.

    Progress stages emitted via progress_cb(stage_name, percent):
      loading_model   0 → 10
      transcribing   10 → 50
      aligning       50 → 80
      segmenting     80 → 95
      complete       95 → 100

    Returns a dict:
    {
      "segments": [...],   # sentence-level segments with words
      "language": "en",
      "duration": 62.4,
    }
    """
    import whisperx
    from .segmentation import merge_whisperx_segments

    def emit(stage: str, pct: int) -> None:
        if progress_cb:
            try:
                progress_cb(stage, pct)
            except Exception:
                pass

    device, compute_type_idx = _get_device(device_req)
    compute_type = "float16" if device == "cuda" else "int8"

    # ------------------------------------------------------------------ #
    # 1. Load / reuse ASR model                                           #
    # ------------------------------------------------------------------ #
    emit("loading_model", 0)
    cache_key = f"{model_name}:{device}"
    if cache_key not in _asr_cache:
        logger.info("Loading WhisperX model '%s' on %s …", model_name, device)
        _asr_cache[cache_key] = await asyncio.to_thread(
            whisperx.load_model,
            model_name,
            device,
            compute_type=compute_type,
            vad_method="silero",
        )
        logger.info("Model loaded.")
    else:
        logger.info("Reusing cached model '%s'.", model_name)
    model = _asr_cache[cache_key]
    emit("loading_model", 10)

    # ------------------------------------------------------------------ #
    # 2. FFmpeg → WAV                                                     #
    # ------------------------------------------------------------------ #
    emit("transcribing", 12)
    suffix = Path(audio_path).suffix.lower()
    if suffix != ".wav":
        wav_path = audio_path + ".converted.wav"
        await asyncio.to_thread(ffmpeg_to_wav, audio_path, wav_path)
    else:
        wav_path = audio_path

    duration = await asyncio.to_thread(get_audio_duration, wav_path)

    # ------------------------------------------------------------------ #
    # 3. WhisperX transcription                                           #
    # ------------------------------------------------------------------ #
    emit("transcribing", 15)
    audio = await asyncio.to_thread(whisperx.load_audio, wav_path)
    emit("transcribing", 25)

    transcribe_kwargs: dict[str, Any] = {}
    if language and language != "auto":
        transcribe_kwargs["language"] = language

    import torch

    def _do_transcribe():
        with torch.inference_mode():
            return model.transcribe(
                audio,
                batch_size=32,
                **transcribe_kwargs,
            )

    result = await asyncio.to_thread(_do_transcribe)
    detected_language: str = result.get("language", language or "en")
    emit("transcribing", 50)

    # ------------------------------------------------------------------ #
    # 4. Word-level alignment                                             #
    # ------------------------------------------------------------------ #
    emit("aligning", 52)
    aligned_segments = result.get("segments", [])

    try:
        align_key = f"{detected_language}:{device}"
        align_model = None
        metadata = None

        if align_key in _align_cache:
            align_model, metadata = _align_cache[align_key]
        else:
            try:
                align_model, metadata = await asyncio.to_thread(
                    whisperx.load_align_model,
                    language_code=detected_language,
                    device=device,
                )
                _align_cache[align_key] = (align_model, metadata)
            except (ValueError, Exception) as align_err:
                logger.warning(f"No direct align model for '{detected_language}' ({align_err}). Attempting fallback to 'en'...")
                fallback_key = f"en:{device}"
                if fallback_key in _align_cache:
                    align_model, metadata = _align_cache[fallback_key]
                else:
                    align_model, metadata = await asyncio.to_thread(
                        whisperx.load_align_model,
                        language_code="en",
                        device=device,
                    )
                    _align_cache[fallback_key] = (align_model, metadata)

        emit("aligning", 60)
        def _do_align():
            with torch.inference_mode():
                return whisperx.align(
                    result["segments"],
                    align_model,
                    metadata,
                    audio,
                    device,
                    return_char_alignments=False,
                )

        aligned = await asyncio.to_thread(_do_align)
        aligned_segments = aligned.get("segments", result.get("segments", []))
        emit("aligning", 80)

    except Exception as exc:
        logger.warning(f"Word-level alignment skipped for '{detected_language}': {exc}. Using base Whisper segments.")
        aligned_segments = result.get("segments", [])

    # ------------------------------------------------------------------ #
    # 5. Sentence segmentation                                            #
    # ------------------------------------------------------------------ #
    emit("segmenting", 82)
    segments = await asyncio.to_thread(
        merge_whisperx_segments,
        aligned_segments,
        pause_threshold,
    )
    emit("segmenting", 95)

    # ------------------------------------------------------------------ #
    # 6. Cleanup converted WAV                                            #
    # ------------------------------------------------------------------ #
    if wav_path != audio_path and os.path.exists(wav_path):
        try:
            os.remove(wav_path)
        except OSError:
            pass

    emit("complete", 100)

    return {
        "segments": segments,
        "language": detected_language,
        "duration": duration,
    }
