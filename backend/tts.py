"""
tts.py
------
Kokoro TTS pipeline for AutoTranscribe with multi-voice blending and instant preview.

Provides:
  run_tts_and_transcribe(script, voice, lang_code, speed, model_name,
                         device_req, pause_threshold, progress_cb)
  synthesize_preview(voice, lang_code, speed, text) -> bytes (WAV)
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Callable, Optional, Union

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Kokoro pipeline cache (one per lang_code)
# ---------------------------------------------------------------------------
_kokoro_cache: dict[str, Any] = {}   # key: lang_code
_shared_kmodel: Any = None          # shared KModel instance
_preview_cache: dict[str, bytes] = {} # key: hash string

TTS_DIR = Path(__file__).parent / "uploads" / "tts_wav"
TTS_DIR.mkdir(parents=True, exist_ok=True)


def _get_kokoro_pipeline(lang_code: str) -> Any:
    """Load or reuse a KPipeline for the given lang_code."""
    global _shared_kmodel
    if lang_code not in _kokoro_cache:
        try:
            from kokoro import KPipeline  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "The 'kokoro' package is not installed. "
                "Please pip install kokoro."
            ) from exc

        logger.info(f"Loading Kokoro pipeline for lang_code={lang_code!r} …")
        if _shared_kmodel is None:
            pipe = KPipeline(lang_code=lang_code)
            _shared_kmodel = pipe.model
        else:
            pipe = KPipeline(lang_code=lang_code, model=_shared_kmodel)
            
        _kokoro_cache[lang_code] = pipe
        logger.info("Kokoro pipeline ready.")

    return _kokoro_cache[lang_code]


def _load_voice_unit(pipeline: Any, voice_name: str) -> Any:
    """Load single voice by name, checking custom voices first then Kokoro built-in voices."""
    voice_name = voice_name.strip()
    try:
        from .voice_cloner import load_custom_voice_tensor
        custom_t = load_custom_voice_tensor(voice_name)
        if custom_t is not None:
            return custom_t
    except Exception as e:
        logger.debug(f"Could not load custom voice tensor for {voice_name}: {e}")

    return pipeline.load_voice(voice_name)


def _resolve_voice_tensor(pipeline: Any, voice: Any) -> Any:
    """
    Resolve single voice string, blend string syntax (e.g. 'af_heart:0.6,af_bella:0.4'),
    or list of voices with weights into a style tensor. Supports custom cloned voices.
    """
    if isinstance(voice, str):
        voice_str = voice.strip()
        if "," in voice_str or ":" in voice_str:
            parts = [p.strip() for p in voice_str.split(",") if p.strip()]
            entries = []
            for p in parts:
                if ":" in p:
                    v_name, w_str = p.split(":", 1)
                    try:
                        w = float(w_str)
                    except ValueError:
                        w = 1.0
                    entries.append((v_name.strip(), w))
                else:
                    entries.append((p.strip(), 1.0))
            if not entries:
                return _load_voice_unit(pipeline, "af_heart")
            total_w = sum(w for _, w in entries) or 1.0
            blended = None
            for v_name, w in entries:
                norm_w = w / total_w
                t = _load_voice_unit(pipeline, v_name)
                if blended is None:
                    blended = t * norm_w
                else:
                    blended += t * norm_w
            return blended
        else:
            return _load_voice_unit(pipeline, voice_str)

    elif isinstance(voice, list):
        if not voice:
            return _load_voice_unit(pipeline, "af_heart")

        entries = []
        for item in voice:
            if isinstance(item, dict):
                v_name = item.get("voice") or item.get("id") or "af_heart"
                try:
                    w = float(item.get("weight", 1.0))
                except (ValueError, TypeError):
                    w = 1.0
                entries.append((str(v_name).strip(), w))
            elif isinstance(item, str):
                entries.append((item.strip(), 1.0))

        total_w = sum(w for _, w in entries) or 1.0
        blended = None
        for v_name, w in entries:
            norm_w = w / total_w
            t = _load_voice_unit(pipeline, v_name)
            if blended is None:
                blended = t * norm_w
            else:
                blended += t * norm_w
        return blended

    return voice


def _extract_custom_voice_id(voice: Any) -> Optional[str]:
    """Find if a voice target references a custom cloned voice ID."""
    if isinstance(voice, str):
        for part in voice.split(","):
            v_name = part.split(":")[0].strip()
            if v_name.startswith("custom_"):
                return v_name
    elif isinstance(voice, list):
        for item in voice:
            if isinstance(item, dict):
                v_name = str(item.get("voice") or item.get("id") or "").strip()
                if v_name.startswith("custom_"):
                    return v_name
            elif isinstance(item, str) and item.strip().startswith("custom_"):
                return item.strip()
    return None


# ---------------------------------------------------------------------------
# TTS synthesis
# ---------------------------------------------------------------------------

def _synthesize(
    script: str,
    voice: Any,
    lang_code: str,
    speed: float,
    output_path: str,
    dsp_settings: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Run Kokoro synthesis synchronously, apply Voicebox DSP effects, and write a 24 kHz WAV file.
    Supports single voices, custom cloned voices, multi-voice blends, and paralinguistic tags.
    """
    try:
        import soundfile as sf  # type: ignore
        import numpy as np
    except ImportError as exc:
        raise RuntimeError(
            "The 'soundfile' or 'numpy' package is missing. "
            "Run: pip install soundfile numpy"
        ) from exc

    from .voicebox_dsp import parse_paralinguistic_tags, clean_script_for_tts, apply_voicebox_dsp

    pipeline = _get_kokoro_pipeline(lang_code)
    resolved_voice = _resolve_voice_tensor(pipeline, voice)

    parsed_tokens = parse_paralinguistic_tags(script)
    audio_segments: list[np.ndarray] = []

    try:
        import torch
        with torch.inference_mode():
            for tok in parsed_tokens:
                if tok["type"] == "pause":
                    silence_samples = int(24000 * tok.get("duration", 0.5))
                    if silence_samples > 0:
                        audio_segments.append(np.zeros(silence_samples, dtype=np.float32))
                elif tok["type"] == "text":
                    sub_text = tok["text"]
                    if not sub_text.strip():
                        continue
                    chunks: list[Any] = []
                    for _gs, _ps, audio in pipeline(sub_text, voice=resolved_voice, speed=speed):
                        chunks.append(audio)
                    if chunks:
                        audio_segments.append(np.concatenate(chunks, axis=0))
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

    if not audio_segments:
        raise RuntimeError("Kokoro produced no audio output for the given script.")

    audio_np = np.concatenate(audio_segments, axis=0)

    # Apply Voicebox Studio DSP FX (EQ, Compression, Reverb, Pitch)
    if dsp_settings:
        try:
            audio_np = apply_voicebox_dsp(
                audio_np,
                sr=24000,
                preset=dsp_settings.get("delivery_preset", "studio_neutral"),
                warmth=float(dsp_settings.get("warmth", 0.0)),
                clarity=float(dsp_settings.get("clarity", 0.0)),
                pitch_shift=float(dsp_settings.get("pitch_shift", 0.0)),
                reverb=float(dsp_settings.get("reverb", 0.0)),
                compression=dsp_settings.get("compression"),
            )
        except Exception as e:
            logger.warning(f"Could not apply Voicebox DSP effects: {e}")

    sf.write(output_path, audio_np, 24000)
    logger.info("TTS WAV written to %s (%.1f s)", output_path, len(audio_np) / 24000)


def synthesize_preview(
    voice: Any,
    lang_code: str = "a",
    speed: float = 1.0,
    text: Optional[str] = None,
    dsp_settings: Optional[Dict[str, Any]] = None,
) -> bytes:
    """
    Fast audio preview generator for a single voice, custom voice, or voice blend.
    Returns in-memory WAV audio bytes with optional Voicebox DSP.
    """
    sample_text = (
        text.strip()
        if text and text.strip()
        else "Hello! This is a preview of the selected Kokoro voice."
    )
    
    cache_key = f"{voice}|{lang_code}|{speed}|{sample_text}|{dsp_settings}"
    if cache_key in _preview_cache:
        return _preview_cache[cache_key]

    try:
        import soundfile as sf
        import numpy as np
    except ImportError as exc:
        raise RuntimeError(
            "Missing 'soundfile' or 'numpy'. Run: pip install soundfile numpy"
        ) from exc

    from .voicebox_dsp import parse_paralinguistic_tags, apply_voicebox_dsp

    pipeline = _get_kokoro_pipeline(lang_code)
    resolved_voice = _resolve_voice_tensor(pipeline, voice)

    parsed_tokens = parse_paralinguistic_tags(sample_text)
    audio_segments: list[np.ndarray] = []

    try:
        import torch
        with torch.inference_mode():
            for tok in parsed_tokens:
                if tok["type"] == "pause":
                    silence_samples = int(24000 * tok.get("duration", 0.5))
                    if silence_samples > 0:
                        audio_segments.append(np.zeros(silence_samples, dtype=np.float32))
                elif tok["type"] == "text":
                    sub_text = tok["text"]
                    if not sub_text.strip():
                        continue
                    chunks: list[Any] = []
                    for _gs, _ps, audio in pipeline(sub_text, voice=resolved_voice, speed=speed):
                        chunks.append(audio)
                    if chunks:
                        audio_segments.append(np.concatenate(chunks, axis=0))
    except Exception as exc:
        err_str = str(exc).lower()
        if "espeak" in err_str or "phonemizer" in err_str:
            raise RuntimeError(
                "Kokoro requires espeak-ng for text-to-phoneme conversion. "
                "Please install espeak-ng."
            ) from exc
        raise

    if not audio_segments:
        raise RuntimeError("Failed to synthesize preview audio.")

    audio_np = np.concatenate(audio_segments, axis=0)

    # Apply Voicebox DSP effects if provided
    if dsp_settings:
        try:
            audio_np = apply_voicebox_dsp(
                audio_np,
                sr=24000,
                preset=dsp_settings.get("delivery_preset", "studio_neutral"),
                warmth=float(dsp_settings.get("warmth", 0.0)),
                clarity=float(dsp_settings.get("clarity", 0.0)),
                pitch_shift=float(dsp_settings.get("pitch_shift", 0.0)),
                reverb=float(dsp_settings.get("reverb", 0.0)),
                compression=dsp_settings.get("compression"),
            )
        except Exception as e:
            logger.warning(f"Could not apply Voicebox DSP effects: {e}")

    buf = io.BytesIO()
    sf.write(buf, audio_np, 24000, format="WAV")
    buf.seek(0)
    
    wav_bytes = buf.read()
    _preview_cache[cache_key] = wav_bytes
    return wav_bytes


# ---------------------------------------------------------------------------
# Combined TTS → WhisperX pipeline
# ---------------------------------------------------------------------------

async def run_tts_and_transcribe(
    script: str,
    voice: Any = "af_heart",
    lang_code: str = "a",
    speed: float = 1.0,
    model_name: str = "base",
    device_req: str = "auto",
    pause_threshold: float = 0.75,
    dsp_settings: Optional[Dict[str, Any]] = None,
    progress_cb: Optional[Callable[[str, int], None]] = None,
) -> dict[str, Any]:
    """
    Full TTS + timestamp pipeline supporting voice blending and Voicebox DSP FX.
    """
    from .transcribe import run_transcription

    def emit(stage: str, pct: int) -> None:
        if progress_cb:
            try:
                progress_cb(stage, pct)
            except Exception:
                pass

    # 1. Kokoro TTS synthesis → WAV
    emit("generating_audio", 0)
    wav_filename = f"tts_{uuid.uuid4()}.wav"
    wav_path = str(TTS_DIR / wav_filename)

    logger.info("Starting Kokoro TTS synthesis (speed=%.1f) …", speed)
    await asyncio.to_thread(_synthesize, script, voice, lang_code, speed, wav_path, dsp_settings)
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
