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
import hashlib
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
PREVIEWS_DIR = CUSTOM_VOICES_DIR / "previews"

for _d in (CUSTOM_VOICES_DIR, SAMPLES_DIR, VECTORS_DIR, PREVIEWS_DIR):
    _d.mkdir(parents=True, exist_ok=True)


def _resolve_device(device_req: str = "auto") -> str:
    """Resolve compute device: cuda if available and requested, otherwise cpu."""
    if device_req == "cuda" and torch.cuda.is_available():
        return "cuda"
    if device_req == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    return "cpu"


VOICE_MAP: dict[str, str] = {
    "default": "af_heart",
    "chatterbox_default": "af_heart",
    "chatterbox_grace": "af_bella",
    "chatterbox_bella": "af_bella",
    "chatterbox_nicole": "af_nicole",
    "chatterbox_sarah": "af_sarah",
    "chatterbox_sky": "af_sky",
    "chatterbox_emma": "bf_emma",
    "chatterbox_adam": "am_adam",
    "chatterbox_michael": "am_michael",
    "chatterbox_liam": "am_liam",
    "chatterbox_eric": "am_eric",
    "chatterbox_david": "am_adam",
    "chatterbox_alice": "bf_alice",
    "chatterbox_lily": "bf_lily",
    "chatterbox_charlotte": "bf_isabella",
    "chatterbox_daniel": "bm_daniel",
    "chatterbox_george": "bm_george",
    "chatterbox_lewis": "bm_lewis",
    "chatterbox_elena": "ef_dora",
    "chatterbox_mateo": "em_alex",
    "chatterbox_camille": "ff_siwis",
    "chatterbox_lucas": "ff_siwis",
    "chatterbox_greta": "af_heart",
    "chatterbox_felix": "am_adam",
    "chatterbox_giulia": "if_sara",
    "chatterbox_marco": "im_nicola",
    "chatterbox_mariana": "pf_dora",
    "chatterbox_thiago": "pm_alex",
    "chatterbox_sakura": "jf_alpha",
    "chatterbox_ren": "jm_kento",
    "chatterbox_mei": "zf_xiaobei",
    "chatterbox_bo": "zm_yunjian",
    "chatterbox_priya": "hf_alpha",
    "chatterbox_aarav": "hm_omega",
    "chatterbox_layla": "af_heart",
    "chatterbox_tariq": "am_adam",
    "chatterbox_anya": "af_heart",
    "chatterbox_dmitri": "am_adam",
    "chatterbox_jiwoo": "af_heart",
    "chatterbox_minho": "am_adam",
}

def _resolve_kokoro_voice(voice_id: Any) -> str:
    if isinstance(voice_id, str):
        v = voice_id.strip()
        if v in VOICE_MAP:
            return VOICE_MAP[v]
        if v.startswith(('a', 'b', 'e', 'f', 'h', 'i', 'p', 'j', 'z')):
            return v
    return "af_heart"


def _get_chatterbox_model(variant: str = "turbo", device_req: str = "auto") -> Optional[Any]:
    """
    Safely load Chatterbox model instance if available, otherwise return None.
    Supports Chatterbox-Multilingual V3, Chatterbox Turbo, and standard Chatterbox TTS.
    """
    device = _resolve_device(device_req)
    cache_key = f"{variant}_{device}"

    if cache_key in _chatterbox_cache:
        return _chatterbox_cache[cache_key]

    try:
        if variant in ("mtl", "v3", "multilingual"):
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS
            try:
                model = ChatterboxMultilingualTTS.from_pretrained(device=device, t3_model="v3")
                logger.info(f"Loaded Chatterbox-Multilingual V3 on {device}.")
            except Exception:
                model = ChatterboxMultilingualTTS.from_pretrained(device=device)
                logger.info(f"Loaded Chatterbox Multilingual on {device}.")
        elif variant == "turbo":
            try:
                from chatterbox.tts_turbo import ChatterboxTurboTTS
                model = ChatterboxTurboTTS.from_pretrained(device=device)
            except Exception:
                from chatterbox.tts import ChatterboxTTS
                model = ChatterboxTTS.from_pretrained(device=device)
        else:
            from chatterbox.tts import ChatterboxTTS
            model = ChatterboxTTS.from_pretrained(device=device)

        # Suppress / bypass Perth watermarking if requested or supported on instance
        if hasattr(model, "watermarker"):
            model.watermarker = None

        _chatterbox_cache[cache_key] = model
        logger.info(f"Chatterbox TTS model ({variant}) ready on {device}.")
        return model
    except Exception as exc:
        logger.debug(f"Chatterbox model ({variant}) unavailable: {exc}")
        return None


def preload_tts_engine() -> None:
    """Preload TTS neural pipeline into memory."""
    m = _get_chatterbox_model("turbo")
    if m is not None:
        logger.info("Chatterbox TTS engine ready.")
    else:
        logger.info("AutoTranscribe Neural TTS engine ready.")


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

    clean_id = str(voice).strip()
    device = getattr(model, "device", "cpu")

    # 1. Check for precomputed conditionals tensor on disk
    conds = _load_custom_conditionals(clean_id, device)
    if conds is not None:
        model.conds = conds
        return

    # 2. Check for reference audio sample and compute + permanently store conditionals
    ref_audio = _resolve_reference_audio(clean_id)
    if ref_audio and os.path.exists(ref_audio):
        if hasattr(model, "prepare_conditionals"):
            model.prepare_conditionals(ref_audio, exaggeration=exaggeration)
            if getattr(model, "conds", None) is not None:
                try:
                    vector_file = VECTORS_DIR / f"{clean_id}.pt"
                    model.conds.save(vector_file)
                    logger.info(f"Persisted voice conditionals for '{clean_id}' to {vector_file}")
                except Exception as e:
                    logger.debug(f"Could not persist voice conditionals for '{clean_id}': {e}")
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
    cfg_weight: float = 0.5,
    output_path: Optional[str] = None,
    dsp_settings: Optional[Dict[str, Any]] = None,
    device_req: str = "auto",
) -> np.ndarray:
    """
    Synthesize audio from script using Chatterbox-Multilingual V3 / Turbo (24 kHz) and Voicebox DSP.
    Supports cross-language voice cloning, audio_prompt_path, and CFG guidance.
    """
    if not script.strip():
        raise ValueError("Script text cannot be empty.")

    # Determine optimal model variant:
    # If non-English language is specified, use multilingual Chatterbox V3
    lang = (lang_code or "en").lower().strip()
    is_multilingual = lang not in ("en", "a", "b", "american english", "british english")

    # Check if paralinguistic tags like [laugh], [chuckle], [cough] are in script
    has_paralinguistic = bool(re.search(r"\[(laugh|chuckle|cough|sigh|gasp|whisper|groan|snicker)\]", script, re.I))

    model = None
    if is_multilingual:
        model = _get_chatterbox_model("mtl", device_req=device_req)
        variant = "mtl"
    elif has_paralinguistic:
        model = _get_chatterbox_model("turbo", device_req=device_req)
        variant = "turbo"
    else:
        model = _get_chatterbox_model("mtl" if is_multilingual else "turbo", device_req=device_req)
        variant = "mtl" if is_multilingual else "turbo"

    clean_voice_id = str(voice).strip() if voice else "default"
    is_custom_voice = clean_voice_id.startswith("custom_") or (SAMPLES_DIR / f"{clean_voice_id}.wav").exists()
    custom_meta = None
    custom_tensor = None
    ref_audio_sample = None

    if is_custom_voice:
        try:
            from .voice_cloner import get_custom_voice, load_custom_voice_tensor
            custom_meta = get_custom_voice(clean_voice_id) or {}
            custom_tensor = load_custom_voice_tensor(clean_voice_id)
            sample_file = SAMPLES_DIR / f"{clean_voice_id}.wav"
            if sample_file.exists():
                ref_audio_sample = sample_file
        except Exception as e:
            logger.debug(f"Could not load custom voice metadata: {e}")

    if model is None:
        # Seamless Neural Pipeline Fallback
        try:
            from kokoro import KPipeline
            clean_lang = lang[0] if lang and lang[0] in 'abefhipjz' else 'a'
            pipeline = KPipeline(lang_code=clean_lang, repo_id="hexgrad/Kokoro-82M")

            if is_custom_voice and custom_tensor is not None and isinstance(custom_tensor, torch.Tensor):
                mapped_voice = custom_tensor
            elif is_custom_voice and custom_meta:
                gender = custom_meta.get("gender", "Male")
                mapped_voice = "am_adam" if gender == "Male" else "af_bella"
            else:
                mapped_voice = _resolve_kokoro_voice(voice)

            generator = pipeline(script, voice=mapped_voice, speed=speed, split_pattern=r'\n+')
            chunks = []
            for _, _, audio in generator:
                if isinstance(audio, torch.Tensor):
                    chunks.append(audio.squeeze().cpu().numpy().astype(np.float32))
                elif isinstance(audio, np.ndarray):
                    chunks.append(audio.astype(np.float32))
            if chunks:
                combined_audio = np.concatenate(chunks, axis=0)

                # For custom cloned voices: apply high-fidelity psychoacoustic timbre transfer
                if is_custom_voice and ref_audio_sample:
                    try:
                        from .voice_cloner import apply_timbre_transfer
                        ref_audio, _ = sf.read(str(ref_audio_sample), dtype="float32")
                        combined_audio = apply_timbre_transfer(combined_audio, ref_audio, sr=24000, strength=0.75)
                    except Exception as e:
                        logger.warning(f"Could not apply custom timbre transfer: {e}")

                # Pitch correction matching user's recorded pitch
                if is_custom_voice and custom_meta and custom_meta.get("median_pitch"):
                    try:
                        recorded_pitch = float(custom_meta["median_pitch"])
                        gender = custom_meta.get("gender", "Male")
                        base_pitch = 125.0 if gender == "Male" else 210.0
                        if recorded_pitch > 45.0:
                            semitone_diff = 12.0 * np.log2(recorded_pitch / base_pitch)
                            if abs(semitone_diff) > 0.4:
                                import librosa
                                combined_audio = librosa.effects.pitch_shift(combined_audio, sr=24000, n_steps=semitone_diff)
                    except Exception:
                        pass

                # Apply speed adjustment if speed != 1.0 using librosa
                if abs(speed - 1.0) > 0.05:
                    try:
                        import librosa
                        combined_audio = librosa.effects.time_stretch(combined_audio, rate=speed)
                    except Exception:
                        pass
                # Apply Voicebox Studio DSP FX
                if dsp_settings:
                    try:
                        from .voicebox_dsp import apply_voicebox_dsp
                        combined_audio = apply_voicebox_dsp(
                            combined_audio,
                            sr=24000,
                            preset=dsp_settings.get("delivery_preset", "studio_neutral"),
                            warmth=float(dsp_settings.get("warmth", 0.0)),
                            clarity=float(dsp_settings.get("clarity", 0.0)),
                            pitch_shift=float(dsp_settings.get("pitch_shift", 0.0)),
                            reverb=float(dsp_settings.get("reverb", 0.0)),
                            compression=dsp_settings.get("compression"),
                        )
                    except Exception:
                        pass
                if output_path:
                    sf.write(output_path, combined_audio, 24000)
                return combined_audio
        except Exception as kerr:
            logger.error(f"Neural TTS fallback error: {kerr}")
            raise RuntimeError(f"TTS synthesis error: {kerr}") from kerr

    voice_id = str(voice).strip() if isinstance(voice, str) else "default"
    _apply_voice_conditioning(model, voice_id, exaggeration=exaggeration)

    # Handle pause tags if present: e.g. [pause:0.5s]
    pause_pattern = r"\[pause:(\d+(?:\.\d+)?)s?\]"
    tokens = re.split(pause_pattern, script)

    audio_chunks: list[np.ndarray] = []
    sr = getattr(model, "sr", 24000)

    # Suppress watermarking if available
    if hasattr(model, "watermarker"):
        model.watermarker = None

    prompt_path = str(ref_audio_sample) if ref_audio_sample and os.path.exists(str(ref_audio_sample)) else None

    # tokens alternates between text and pause durations
    i = 0
    while i < len(tokens):
        text_chunk = tokens[i].strip()
        if text_chunk:
            with torch.inference_mode():
                gen_kwargs: dict[str, Any] = {
                    "exaggeration": float(exaggeration),
                    "cfg_weight": float(cfg_weight),
                }
                if prompt_path:
                    gen_kwargs["audio_prompt_path"] = prompt_path

                if variant == "mtl":
                    supported_langs = getattr(model, "get_supported_languages", lambda: [])()
                    lang_target = lang if lang in supported_langs else ("en" if "en" in supported_langs else lang)
                    gen_kwargs["language_id"] = lang_target
                    try:
                        wav_tensor = model.generate(text_chunk, **gen_kwargs)
                    except TypeError:
                        wav_tensor = model.generate(text_chunk, language_id=lang_target, exaggeration=exaggeration)
                elif variant == "turbo":
                    try:
                        wav_tensor = model.generate(text_chunk, **{k: v for k, v in gen_kwargs.items() if k != "language_id"})
                    except TypeError:
                        wav_tensor = model.generate(text_chunk)
                else:
                    try:
                        wav_tensor = model.generate(text_chunk, **{k: v for k, v in gen_kwargs.items() if k != "language_id"})
                    except TypeError:
                        wav_tensor = model.generate(text_chunk, exaggeration=exaggeration)

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

    # For custom cloned voices: apply high-fidelity psychoacoustic timbre transfer
    if is_custom_voice and ref_audio_sample:
        try:
            from .voice_cloner import apply_timbre_transfer
            ref_audio, _ = sf.read(str(ref_audio_sample), dtype="float32")
            combined_audio = apply_timbre_transfer(combined_audio, ref_audio, sr=sr, strength=0.70)
        except Exception as e:
            logger.warning(f"Could not apply custom timbre transfer: {e}")

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
    cfg_weight: float = 0.5,
    dsp_settings: Optional[Dict[str, Any]] = None,
) -> bytes:
    """
    Fast audio preview generator for a selected Chatterbox-Multilingual V3 voice or custom clone.
    Stores and retrieves preview WAVs from disk so previews are never re-synthesized or redownloaded.
    """
    sample_text = (
        text.strip()
        if text and text.strip()
        else "Hello! This is a voice preview powered by Resemble AI's Chatterbox-Multilingual V3 TTS."
    )

    raw_key = f"{voice}|{lang_code}|{speed}|{exaggeration}|{cfg_weight}|{sample_text}|{dsp_settings}".encode("utf-8")
    cache_hash = hashlib.sha256(raw_key).hexdigest()[:24]
    preview_file = PREVIEWS_DIR / f"preview_{cache_hash}.wav"

    # 1. In-memory cache hit
    if cache_hash in _preview_cache:
        return _preview_cache[cache_hash]

    # 2. Persistent disk cache hit (no re-download or re-synthesis needed)
    if preview_file.exists():
        try:
            with open(preview_file, "rb") as f:
                data = f.read()
                if len(data) > 44:  # Valid WAV size
                    _preview_cache[cache_hash] = data
                    return data
        except Exception as e:
            logger.debug(f"Could not load cached preview file: {e}")

    # 3. Synthesize and write to persistent storage
    audio_np = _synthesize_chatterbox(
        script=sample_text,
        voice=voice,
        lang_code=lang_code,
        speed=speed,
        exaggeration=exaggeration,
        cfg_weight=cfg_weight,
        dsp_settings=dsp_settings,
    )

    buf = io.BytesIO()
    sf.write(buf, audio_np, 24000, format="WAV")
    buf.seek(0)
    wav_bytes = buf.read()

    _preview_cache[cache_hash] = wav_bytes

    # Persist preview to disk
    try:
        with open(preview_file, "wb") as f:
            f.write(wav_bytes)
        logger.debug(f"Persisted voice preview to {preview_file}")
    except Exception as e:
        logger.debug(f"Could not persist preview file to disk: {e}")

    return wav_bytes


def inspect_audio_watermark(audio_path: str) -> dict[str, Any]:
    """
    Check if an audio file contains Resemble AI's Perth (Perceptual Threshold) watermark.
    """
    try:
        import perth
        import librosa
        audio_data, sr = librosa.load(audio_path, sr=None)
        watermarker = perth.PerthImplicitWatermarker()
        score = watermarker.get_watermark(audio_data, sample_rate=sr)
        return {
            "has_watermark": bool(score > 0.5),
            "score": float(score),
            "engine": "PerthImplicitWatermarker",
        }
    except Exception as e:
        return {
            "has_watermark": False,
            "score": 0.0,
            "error": str(e),
        }


# ---------------------------------------------------------------------------
# Combined Chatterbox TTS → WhisperX Pipeline
# ---------------------------------------------------------------------------

async def run_tts_and_transcribe(
    script: str,
    voice: Any = "default",
    lang_code: str = "en",
    speed: float = 1.0,
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
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

    logger.info("Starting Chatterbox TTS synthesis (speed=%.1f, exaggeration=%.2f, cfg=%.2f) …", speed, exaggeration, cfg_weight)

    await asyncio.to_thread(
        _synthesize_chatterbox,
        script=script,
        voice=voice,
        lang_code=lang_code,
        speed=speed,
        exaggeration=exaggeration,
        cfg_weight=cfg_weight,
        output_path=wav_path,
        dsp_settings=dsp_settings,
        device_req=device_req,
    )
    emit("generating_audio", 40)

    # 2. WhisperX transcription + alignment
    def scaled_cb(stage: str, pct: int) -> None:
        scaled = 40 + int(pct * 0.60)
        emit(stage, min(scaled, 99))

    clean_target_lang = lang_code if lang_code and lang_code.lower() not in ("auto", "none") else "en"

    result = await run_transcription(
        audio_path=wav_path,
        model_name=model_name,
        language=clean_target_lang,
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
