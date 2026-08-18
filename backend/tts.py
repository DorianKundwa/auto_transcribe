"""
tts.py
------
Kokoro TTS pipeline for AutoTranscribe.

Provides:
  run_tts_and_transcribe(script, voice, lang_code, speed, model_name,
                         device_req, pause_threshold, progress_cb)
  → saves a WAV to disk, then runs WhisperX word-level alignment on it
  → returns { segments, language, duration, wav_path }
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Kokoro pipeline cache  (one per lang_code)
# ---------------------------------------------------------------------------
_kokoro_cache: dict[str, Any] = {}   # key: lang_code

TTS_DIR = Path(__file__).parent / "uploads" / "tts_wav"
TTS_DIR.mkdir(parents=True, exist_ok=True)


def _get_kokoro_pipeline(lang_code: str) -> Any:
    """Load or reuse a KPipeline for the given lang_code."""
    if lang_code not in _kokoro_cache:
        try:
            from kokoro import KPipeline  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "The 'kokoro' package is not installed. "
                "Run: pip install kokoro>=0.9.4 soundfile"
            ) from exc
        logger.info("Loading Kokoro pipeline for lang_code='%s' …", lang_code)
        _kokoro_cache[lang_code] = KPipeline(lang_code=lang_code)
        logger.info("Kokoro pipeline ready.")
    return _kokoro_cache[lang_code]


# ---------------------------------------------------------------------------
# TTS synthesis
# ---------------------------------------------------------------------------

def _synthesize(
    script: str,
    voice: str,
    lang_code: str,
    speed: float,
    output_path: str,
) -> None:
    """
    Run Kokoro synthesis synchronously and write a 24 kHz WAV file.
    Raises RuntimeError with a helpful message if espeak-ng is missing.
    """
    try:
        import soundfile as sf  # type: ignore
        import numpy as np
    except ImportError as exc:
        raise RuntimeError(
            "The 'soundfile' or 'numpy' package is missing. "
            "Run: pip install soundfile numpy"
        ) from exc

    pipeline = _get_kokoro_pipeline(lang_code)

    chunks: list[Any] = []
    try:
        for _gs, _ps, audio in pipeline(script, voice=voice, speed=speed):
            chunks.append(audio)
    except Exception as exc:
        err_str = str(exc).lower()
        if "espeak" in err_str or "phonemizer" in err_str:
            raise RuntimeError(
                "Kokoro requires espeak-ng for text-to-phoneme conversion. "
                "Install it: \n"
                "  Windows: winget install espeak-ng  (or choco install espeak)\n"
                "  Linux:   sudo apt-get install espeak-ng\n"
                "  macOS:   brew install espeak\n"
                f"Original error: {exc}"
            ) from exc
        raise

    if not chunks:
        raise RuntimeError("Kokoro produced no audio output for the given script.")

    import numpy as np
    audio_np = np.concatenate(chunks, axis=0)
    sf.write(output_path, audio_np, 24000)
    logger.info("TTS WAV written to %s (%.1f s)", output_path, len(audio_np) / 24000)


# ---------------------------------------------------------------------------
# Combined TTS → WhisperX pipeline
# ---------------------------------------------------------------------------

async def run_tts_and_transcribe(
    script: str,
    voice: str = "af_heart",
    lang_code: str = "a",
    speed: float = 1.0,
    model_name: str = "base",
    device_req: str = "auto",
    pause_threshold: float = 0.75,
    progress_cb: Optional[Callable[[str, int], None]] = None,
) -> dict[str, Any]:
    """
    Full TTS + timestamp pipeline.

    Progress stages:
      generating_audio   0 → 40
      loading_model     40 → 50
      transcribing      50 → 65
      aligning          65 → 85
      segmenting        85 → 95
      complete          95 → 100

    Returns:
      {
        "segments":  [...],
        "language":  "en",
        "duration":  12.4,
        "wav_path":  "/abs/path/to/file.wav"   ← kept on disk for download
      }
    """
    from .transcribe import run_transcription  # reuse existing pipeline

    def emit(stage: str, pct: int) -> None:
        if progress_cb:
            try:
                progress_cb(stage, pct)
            except Exception:
                pass

    # ------------------------------------------------------------------ #
    # 1. Kokoro TTS synthesis → WAV                                       #
    # ------------------------------------------------------------------ #
    emit("generating_audio", 0)
    wav_filename = f"tts_{uuid.uuid4()}.wav"
    wav_path = str(TTS_DIR / wav_filename)

    logger.info("Starting Kokoro TTS synthesis (voice=%s, speed=%.1f) …", voice, speed)
    await asyncio.to_thread(_synthesize, script, voice, lang_code, speed, wav_path)
    emit("generating_audio", 40)

    # ------------------------------------------------------------------ #
    # 2. WhisperX transcription + alignment                               #
    # ------------------------------------------------------------------ #
    # We override the emit calls from run_transcription by wrapping them
    # so that their 0–100 range maps to 40–100 in our overall progress.
    def scaled_cb(stage: str, pct: int) -> None:
        # Remap run_transcription's 0–100 → our 40–100
        scaled = 40 + int(pct * 0.60)
        emit(stage, min(scaled, 99))

    result = await run_transcription(
        audio_path=wav_path,
        model_name=model_name,
        language=None,          # let WhisperX auto-detect from synthesised speech
        device_req=device_req,
        pause_threshold=pause_threshold,
        progress_cb=scaled_cb,
    )

    emit("complete", 100)

    return {
        "segments": result["segments"],
        "language": result["language"],
        "duration": result["duration"],
        "wav_path": wav_path,
    }
