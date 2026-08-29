"""
tts.py
------
Resemble AI Chatterbox TTS pipeline for AutoTranscribe with zero-shot voice cloning,
paralinguistic expression tags, emotion exaggeration control, and instant preview.

Provides:
  run_tts_and_transcribe(script, voice, lang_code, speed, exaggeration, model_name,
                         device_req, pause_threshold, dsp_settings, progress_cb)
  synthesize_preview(voice, lang_code, speed, text, exaggeration, dsp_settings) -> bytes (WAV)
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

import numpy as np
import soundfile as sf
import torch

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Chatterbox Model & Pipeline Cache
# ---------------------------------------------------------------------------
_chatterbox_cache: dict[str, Any] = {}   # key: (variant, device)
_preview_cache: dict[str, bytes] = {}    # key: cache hash string

TTS_DIR = Path(__file__).parent / "uploads" / "tts_wav"
TTS_DIR.mkdir(parents=True, exist_ok=True)

CUSTOM_VOICES_DIR = Path(__file__).parent / "custom_voices"
SAMPLES_DIR = CUSTOM_VOICES_DIR / "samples"
VECTORS_DIR = CUSTOM_VOICES_DIR / "vectors"


def _resolve_device(device_req: str = "auto") -> str:
    """Resolve compute device: cuda if available and requested, otherwise cpu."""
    if device_req == "cuda" and torch.cuda.is_available():
        return "cuda"
    if device_req == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    return "cpu"


def _get_chatterbox_model(variant: str = "turbo", device_req: str = "auto") -> Any:
    """
    Load or reuse a Chatterbox model instance.
    Variants:
      - 'turbo': ChatterboxTurboTTS (low-latency, native paralinguistic tags [laugh], [chuckle], [cough], etc.)
      - 'standard': ChatterboxTTS (English with emotion exaggeration control)
      - 'mtl': ChatterboxMultilingualTTS (23+ languages)
    """
    device = _resolve_device(device_req)
    cache_key = f"{variant}_{device}"

    if cache_key in _chatterbox_cache:
        return _chatterbox_cache[cache_key]

    logger.info(f"Loading Chatterbox TTS model (variant={variant!r}, device={device!r}) …")

    try:
        if variant == "turbo":
            from chatterbox.tts_turbo import ChatterboxTurboTTS
            model = ChatterboxTurboTTS.from_pretrained(device=device)
        elif variant == "mtl":
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS
            model = ChatterboxMultilingualTTS.from_pretrained(device=device)
        else:
            from chatterbox.tts import ChatterboxTTS
            model = ChatterboxTTS.from_pretrained(device=device)

        _chatterbox_cache[cache_key] = model
        logger.info(f"Chatterbox TTS model ({variant}) ready on {device}.")
        return model

    except Exception as exc:
        logger.exception(f"Failed to load Chatterbox TTS model '{variant}': {exc}")
        # Fallback to standard Chatterbox if Turbo fails
        if variant != "standard":
            try:
                from chatterbox.tts import ChatterboxTTS
                model = ChatterboxTTS.from_pretrained(device=device)
                _chatterbox_cache[cache_key] = model
                return model
            except Exception:
                pass
        raise RuntimeError(f"Chatterbox TTS initialization failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Voice & Conditioning Resolution
# ---------------------------------------------------------------------------

def _resolve_reference_audio(voice_id: str) -> Optional[str]:
    """Find reference audio path for custom cloned voice or preset voice."""
    if not voice_id:
        return None

    # 1. Custom voice sample
    clean_id = voice_id.strip()
    sample_file = SAMPLES_DIR / f"{clean_id}.wav"
    if sample_file.exists():
        return str(sample_file)

    # 2. Check direct file path
    if os.path.exists(clean_id):
        return clean_id

    return None


def _load_custom_conditionals(voice_id: str, device: str) -> Optional[Any]:
    """Load pre-computed Conditionals tensor for custom voice if available."""
    clean_id = voice_id.strip()
    vector_file = VECTORS_DIR / f"{clean_id}.pt"
    if vector_file.exists():
        try:
            from chatterbox.tts import Conditionals
            conds = Conditionals.load(vector_file, map_location=device).to(device)
            return conds
        except Exception as e:
            logger.debug(f"Could not load precomputed conditionals for {voice_id}: {e}")
    return None


def _apply_voice_conditioning(model: Any, voice: str, exaggeration: float = 0.5) -> None:
    """Apply voice conditioning to Chatterbox model via reference audio or precomputed tensor."""
    if not voice or voice in ("default", "builtin", "af_heart", "chatterbox_default"):
        return

    # Check for precomputed conditionals
    device = getattr(model, "device", "cpu")
    conds = _load_custom_conditionals(voice, device)
    if conds is not None:
        model.conds = conds
        return

    # Check for reference audio
    ref_audio = _resolve_reference_audio(voice)
    if ref_audio and os.path.exists(ref_audio):
        model.prepare_conditionals(ref_audio, exaggeration=exaggeration)
        return


# ---------------------------------------------------------------------------
# Text & Tag Preprocessing
# ---------------------------------------------------------------------------

def _preprocess_script(script: str) -> tuple[str, list[dict[str, Any]]]:
    """
    Process script text, normalize whitespace and handle pause tags.
    Returns cleaned text and list of pauses/segments.
    """
    # Normalize unicode quotes and dashes
    script = (
        script.replace("“", '"')
        .replace("”", '"')
        .replace("‘", "'")
        .replace("’", "'")
        .replace("—", "-")
        .replace("–", "-")
    )
    return script.strip(), []


# ---------------------------------------------------------------------------
# Synthesis Engine
# ---------------------------------------------------------------------------

def _synthesize_chatterbox(
    script: str,
    voice: Any = "default",
    lang_code: str = "en",
    speed: float = 1.0,
    exaggeration: float = 0.5,
    output_path: Optional[str] = None,
    dsp_settings: Optional[Dict[str, Any]] = None,
    device_req: str = "auto",
) -> np.ndarray:
    """
    Synthesize audio from script using Chatterbox TTS (24 kHz) and apply Voicebox DSP.
    """
    if not script.strip():
        raise ValueError("Script text cannot be empty.")

    # Determine optimal model variant:
    # If non-English language is specified, use multilingual Chatterbox
    lang = (lang_code or "en").lower().strip()
    is_multilingual = lang not in ("en", "a", "b", "american english", "british english")

    # Check if paralinguistic tags like [laugh], [chuckle], [cough] are in script
    has_paralinguistic = bool(re.search(r"\[(laugh|chuckle|cough|sigh|gasp|whisper|groan|snicker)\]", script, re.I))

    if is_multilingual:
        model = _get_chatterbox_model("mtl", device_req=device_req)
        variant = "mtl"
    elif has_paralinguistic:
        model = _get_chatterbox_model("turbo", device_req=device_req)
        variant = "turbo"
    else:
        model = _get_chatterbox_model("turbo", device_req=device_req)
        variant = "turbo"

    voice_id = str(voice).strip() if isinstance(voice, str) else "default"
    _apply_voice_conditioning(model, voice_id, exaggeration=exaggeration)

    # Handle pause tags if present: e.g. [pause:0.5s]
    # Split text into segments around pause tags
    pause_pattern = r"\[pause:(\d+(?:\.\d+)?)s?\]"
    tokens = re.split(pause_pattern, script)

    audio_chunks: list[np.ndarray] = []
    sr = getattr(model, "sr", 24000)

    # tokens alternates between text and pause durations
    i = 0
    while i < len(tokens):
        text_chunk = tokens[i].strip()
        if text_chunk:
            with torch.inference_mode():
                if variant == "mtl":
                    wav_tensor = model.generate(
                        text_chunk,
                        language_id=lang if lang in model.get_supported_languages() else "en",
                        exaggeration=exaggeration,
                    )
                elif variant == "turbo":
                    wav_tensor = model.generate(
                        text_chunk,
                    )
                else:
                    wav_tensor = model.generate(
                        text_chunk,
                        exaggeration=exaggeration,
                    )

                if isinstance(wav_tensor, torch.Tensor):
                    chunk_np = wav_tensor.squeeze().cpu().numpy().astype(np.float32)
                else:
                    chunk_np = np.asarray(wav_tensor, dtype=np.float32)

                if len(chunk_np) > 0:
                    audio_chunks.append(chunk_np)

        # Next token is pause duration (if any)
        if i + 1 < len(tokens):
            try:
                pause_sec = float(tokens[i + 1])
                silence_samples = int(sr * max(0.05, min(10.0, pause_sec)))
                if silence_samples > 0:
                    audio_chunks.append(np.zeros(silence_samples, dtype=np.float32))
            except (ValueError, TypeError):
                pass
            i += 2
        else:
            i += 1

    if not audio_chunks:
        raise RuntimeError("Chatterbox TTS produced no audio output for the script.")

    combined_audio = np.concatenate(audio_chunks, axis=0)

    # Apply speed adjustment if speed != 1.0 using librosa
    if abs(speed - 1.0) > 0.05:
        try:
            import librosa
            combined_audio = librosa.effects.time_stretch(combined_audio, rate=speed)
        except Exception as e:
            logger.warning(f"Could not apply speed stretch: {e}")

    # Apply Voicebox Studio DSP FX (EQ, Compression, Reverb, Pitch, Delivery Presets)
    if dsp_settings:
        try:
            from .voicebox_dsp import apply_voicebox_dsp
            combined_audio = apply_voicebox_dsp(
                combined_audio,
                sr=sr,
                preset=dsp_settings.get("delivery_preset", "studio_neutral"),
                warmth=float(dsp_settings.get("warmth", 0.0)),
                clarity=float(dsp_settings.get("clarity", 0.0)),
                pitch_shift=float(dsp_settings.get("pitch_shift", 0.0)),
                reverb=float(dsp_settings.get("reverb", 0.0)),
                compression=dsp_settings.get("compression"),
            )
        except Exception as e:
            logger.warning(f"Could not apply Voicebox DSP effects: {e}")

    if output_path:
        sf.write(output_path, combined_audio, sr)
        logger.info(f"Chatterbox TTS WAV written to {output_path} ({len(combined_audio)/sr:.2f}s)")

    return combined_audio


def synthesize_preview(
    voice: Any = "default",
    lang_code: str = "en",
    speed: float = 1.0,
    text: Optional[str] = None,
    exaggeration: float = 0.5,
    dsp_settings: Optional[Dict[str, Any]] = None,
) -> bytes:
    """
    Fast audio preview generator for a selected Chatterbox voice or custom clone.
    Returns in-memory WAV audio bytes with optional Voicebox DSP.
    """
    sample_text = (
        text.strip()
        if text and text.strip()
        else "Hello! This is a voice preview powered by Resemble AI's Chatterbox TTS."
    )

    cache_key = f"{voice}|{lang_code}|{speed}|{exaggeration}|{sample_text}|{dsp_settings}"
    if cache_key in _preview_cache:
        return _preview_cache[cache_key]

    audio_np = _synthesize_chatterbox(
        script=sample_text,
        voice=voice,
        lang_code=lang_code,
        speed=speed,
        exaggeration=exaggeration,
        dsp_settings=dsp_settings,
    )

    buf = io.BytesIO()
    sf.write(buf, audio_np, 24000, format="WAV")
    buf.seek(0)

    wav_bytes = buf.read()
    _preview_cache[cache_key] = wav_bytes
    return wav_bytes


# ---------------------------------------------------------------------------
# Combined Chatterbox TTS → WhisperX Pipeline
# ---------------------------------------------------------------------------

async def run_tts_and_transcribe(
    script: str,
    voice: Any = "default",
    lang_code: str = "en",
    speed: float = 1.0,
    exaggeration: float = 0.5,
    model_name: str = "base",
    device_req: str = "auto",
    pause_threshold: float = 0.75,
    dsp_settings: Optional[Dict[str, Any]] = None,
    progress_cb: Optional[Callable[[str, int], None]] = None,
    job_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Full pipeline: Script -> Chatterbox TTS (24kHz WAV) -> WhisperX Alignment -> Word-Level Timestamps.
    """
    from .transcribe import run_transcription

    def emit(stage: str, pct: int) -> None:
        if progress_cb:
            try:
                progress_cb(stage, pct)
            except Exception:
                pass

    # 1. Chatterbox TTS synthesis -> WAV
    emit("generating_audio", 0)
    wav_id = job_id if job_id else str(uuid.uuid4())
    wav_filename = f"tts_{wav_id}.wav"
    wav_path = str(TTS_DIR / wav_filename)

    logger.info("Starting Chatterbox TTS synthesis (speed=%.1f, exaggeration=%.2f) …", speed, exaggeration)

    await asyncio.to_thread(
        _synthesize_chatterbox,
        script=script,
        voice=voice,
        lang_code=lang_code,
        speed=speed,
        exaggeration=exaggeration,
        output_path=wav_path,
        dsp_settings=dsp_settings,
        device_req=device_req,
    )
    emit("generating_audio", 40)

    # 2. WhisperX transcription + alignment
    def scaled_cb(stage: str, pct: int) -> None:
        scaled = 40 + int(pct * 0.60)
        emit(stage, min(scaled, 99))

    result = await run_transcription(
        audio_path=wav_path,
        model_name=model_name,
        language=None,
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
