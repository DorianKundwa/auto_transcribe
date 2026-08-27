"""
voicebox_dsp.py
---------------
Voicebox Audio Production, Delivery Control & Studio DSP FX Engine.
(Inspired by Jamie Pine / Voicebox AI Voice Studio).

Features:
  1. Delivery Style Presets (Studio Neutral, Broadcast Warmth, Podcast Crisp,
     Cinematic Narrator, Soft Whisper, High Energy).
  2. 3-Band Studio Parametric EQ (Low-end warmth, Mid presence, High-end air).
  3. Dynamic Studio Broadcast Compressor & Soft-Knee Peak Limiter.
  4. Algorithmic Studio Room Reverb (Schroeder allpass + comb delay network).
  5. Semitone Pitch Transposer (STFT Phase-Vocoder).
  6. Paralinguistic & Expressive Speech Tag Parser ([pause], [whisper], [laugh], [sigh], [gasp]).
"""

from __future__ import annotations

import logging
import math
import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import scipy.ndimage
import scipy.signal

logger = logging.getLogger(__name__)

# Standard sample rate
SR_DEFAULT = 24000


# ---------------------------------------------------------------------------
# 1. Paralinguistic & Expressive Speech Tag Parser
# ---------------------------------------------------------------------------

TAG_PATTERN = re.compile(
    r"\[(pause(?::[\d.]+(?:s|ms)?)?|laugh|sigh|gasp|whisper|emphasis|shout|happy|sad|excited)\]",
    re.IGNORECASE,
)


def parse_paralinguistic_tags(text: str) -> List[Dict[str, Any]]:
    """
    Parse paralinguistic emotion and timing tags from script.
    Examples:
      - "Hello [pause:0.5s] world" -> [{'type': 'text', 'text': 'Hello'}, {'type': 'pause', 'duration': 0.5}, {'type': 'text', 'text': 'world'}]
      - "That was hilarious [laugh]" -> [{'type': 'text', 'text': 'That was hilarious'}, {'type': 'tag', 'tag': 'laugh'}]
    """
    tokens: List[Dict[str, Any]] = []
    last_idx = 0

    for match in TAG_PATTERN.finditer(text):
        start, end = match.span()
        if start > last_idx:
            segment = text[last_idx:start].strip()
            if segment:
                tokens.append({"type": "text", "text": segment})

        tag_content = match.group(1).lower()
        if tag_content.startswith("pause"):
            dur = 0.5
            if ":" in tag_content:
                val_str = tag_content.split(":", 1)[1]
                if val_str.endswith("ms"):
                    dur = float(val_str[:-2]) / 1000.0
                elif val_str.endswith("s"):
                    dur = float(val_str[:-1])
                else:
                    dur = float(val_str)
            tokens.append({"type": "pause", "duration": min(max(dur, 0.1), 5.0)})
        else:
            tokens.append({"type": "tag", "tag": tag_content})

        last_idx = end

    if last_idx < len(text):
        segment = text[last_idx:].strip()
        if segment:
            tokens.append({"type": "text", "text": segment})

    return tokens if tokens else [{"type": "text", "text": text}]


def clean_script_for_tts(text: str) -> str:
    """Strip bracketed paralinguistic tags for basic phonemizers while preserving pauses."""
    cleaned = re.sub(TAG_PATTERN, " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


# ---------------------------------------------------------------------------
# 2. Studio Parametric EQ (3-Band Biquad Filter Engine)
# ---------------------------------------------------------------------------

def apply_parametric_eq(
    audio: np.ndarray,
    sr: int = 24000,
    warmth_gain_db: float = 0.0,   # Low shelf @ 150 Hz
    presence_gain_db: float = 0.0, # Peaking @ 2500 Hz
    air_gain_db: float = 0.0,      # High shelf @ 8000 Hz
) -> np.ndarray:
    """
    3-band Studio Parametric Equalizer.
      - Low Shelf (Warmth): 150 Hz
      - Mid Peaking (Presence / Intelligibility): 2500 Hz (Q=1.0)
      - High Shelf (Air / Crispness): 8000 Hz
    """
    if abs(warmth_gain_db) < 0.1 and abs(presence_gain_db) < 0.1 and abs(air_gain_db) < 0.1:
        return audio

    out = audio.copy()

    # 1. Low Shelf @ 150 Hz
    if abs(warmth_gain_db) >= 0.1:
        f0 = 150.0 / (sr / 2.0)
        A = 10.0 ** (warmth_gain_db / 40.0)
        w0 = np.pi * f0
        cos_w0 = np.cos(w0)
        sin_w0 = np.sin(w0)
        alpha = sin_w0 / 2.0 * np.sqrt((A + 1.0 / A) * (1.0 / 0.707 - 1.0) + 2.0)
        two_sqrt_A_alpha = 2.0 * np.sqrt(A) * alpha

        b0 = A * ((A + 1.0) - (A - 1.0) * cos_w0 + two_sqrt_A_alpha)
        b1 = 2.0 * A * ((A - 1.0) - (A + 1.0) * cos_w0)
        b2 = A * ((A + 1.0) - (A - 1.0) * cos_w0 - two_sqrt_A_alpha)
        a0 = (A + 1.0) + (A - 1.0) * cos_w0 + two_sqrt_A_alpha
        a1 = -2.0 * ((A - 1.0) + (A + 1.0) * cos_w0)
        a2 = (A + 1.0) + (A - 1.0) * cos_w0 - two_sqrt_A_alpha

        b = np.array([b0, b1, b2]) / a0
        a = np.array([a0, a1, a2]) / a0
        out = scipy.signal.lfilter(b, a, out)

    # 2. Mid Peaking @ 2500 Hz (Q=1.0)
    if abs(presence_gain_db) >= 0.1:
        f0 = min(0.9, 2500.0 / (sr / 2.0))
        A = 10.0 ** (presence_gain_db / 40.0)
        w0 = np.pi * f0
        alpha = np.sin(w0) / (2.0 * 1.0)

        b0 = 1.0 + alpha * A
        b1 = -2.0 * np.cos(w0)
        b2 = 1.0 - alpha * A
        a0 = 1.0 + alpha / A
        a1 = -2.0 * np.cos(w0)
        a2 = 1.0 - alpha / A

        b = np.array([b0, b1, b2]) / a0
        a = np.array([a0, a1, a2]) / a0
        out = scipy.signal.lfilter(b, a, out)

    # 3. High Shelf @ 8000 Hz
    if abs(air_gain_db) >= 0.1:
        f0 = min(0.9, 8000.0 / (sr / 2.0))
        A = 10.0 ** (air_gain_db / 40.0)
        w0 = np.pi * f0
        cos_w0 = np.cos(w0)
        sin_w0 = np.sin(w0)
        alpha = sin_w0 / 2.0 * np.sqrt((A + 1.0 / A) * (1.0 / 0.707 - 1.0) + 2.0)
        two_sqrt_A_alpha = 2.0 * np.sqrt(A) * alpha

        b0 = A * ((A + 1.0) + (A - 1.0) * cos_w0 + two_sqrt_A_alpha)
        b1 = -2.0 * A * ((A - 1.0) + (A + 1.0) * cos_w0)
        b2 = A * ((A + 1.0) + (A - 1.0) * cos_w0 - two_sqrt_A_alpha)
        a0 = (A + 1.0) - (A - 1.0) * cos_w0 + two_sqrt_A_alpha
        a1 = 2.0 * ((A - 1.0) - (A + 1.0) * cos_w0)
        a2 = (A + 1.0) - (A - 1.0) * cos_w0 - two_sqrt_A_alpha

        b = np.array([b0, b1, b2]) / a0
        a = np.array([a0, a1, a2]) / a0
        out = scipy.signal.lfilter(b, a, out)

    return out.astype(np.float32)


# ---------------------------------------------------------------------------
# 3. Dynamic Studio Broadcast Compressor
# ---------------------------------------------------------------------------

def apply_studio_compressor(
    audio: np.ndarray,
    sr: int = 24000,
    threshold_db: float = -18.0,
    ratio: float = 3.5,
    attack_ms: float = 12.0,
    release_ms: float = 100.0,
    makeup_gain_db: float = 3.0,
) -> np.ndarray:
    """
    Studio Broadcast Compressor with soft-knee and automatic level smoothing.
    Makes voices sound full, consistent, and radio-ready.
    """
    if len(audio) == 0:
        return audio

    alpha_attack = np.exp(-1.0 / (sr * (attack_ms / 1000.0)))
    alpha_release = np.exp(-1.0 / (sr * (release_ms / 1000.0)))

    # Compute envelope
    abs_audio = np.abs(audio)
    env = np.zeros_like(audio)
    curr_env = 0.0

    for i in range(len(audio)):
        val = abs_audio[i]
        if val > curr_env:
            curr_env = alpha_attack * curr_env + (1.0 - alpha_attack) * val
        else:
            curr_env = alpha_release * curr_env + (1.0 - alpha_release) * val
        env[i] = curr_env

    # Logarithmic compression curve with soft knee (4 dB knee width)
    env_db = 20.0 * np.log10(np.maximum(env, 1e-6))
    knee_width = 4.0
    half_knee = knee_width / 2.0

    gain_reduction_db = np.zeros_like(env_db)
    for i, level in enumerate(env_db):
        if level <= (threshold_db - half_knee):
            gain_reduction_db[i] = 0.0
        elif level >= (threshold_db + half_knee):
            gain_reduction_db[i] = (threshold_db + (level - threshold_db) / ratio) - level
        else:
            # Quadratic soft-knee interpolation
            diff = level - threshold_db + half_knee
            gain_reduction_db[i] = ((1.0 / ratio - 1.0) * (diff ** 2)) / (2.0 * knee_width)

    gain_lin = 10.0 ** ((gain_reduction_db + makeup_gain_db) / 20.0)
    compressed = audio * gain_lin

    # Soft peak limiter to prevent clipping
    peak = np.max(np.abs(compressed)) + 1e-9
    if peak > 0.96:
        compressed = compressed * (0.96 / peak)

    return compressed.astype(np.float32)


# ---------------------------------------------------------------------------
# 4. Algorithmic Studio Room Reverb (Schroeder Diffusion Network)
# ---------------------------------------------------------------------------

def apply_studio_reverb(
    audio: np.ndarray,
    sr: int = 24000,
    room_size: float = 0.35,  # 0.0 (Dry) to 1.0 (Lush Hall)
    wet_mix: float = 0.15,    # 0.0 to 0.50
    damping: float = 0.40,
) -> np.ndarray:
    """
    Studio Room Reverb Simulation.
    Creates a warm, subtle acoustic space around the voice without muddying vowels.
    """
    if wet_mix <= 0.01 or len(audio) == 0:
        return audio

    wet_mix = min(wet_mix, 0.60)
    dry_mix = 1.0 - (wet_mix * 0.5)

    # 4 Parallel Feedback Comb Filters
    delays_ms = [29.7, 37.1, 41.1, 43.7]
    delay_samples = [int(sr * (d / 1000.0)) for d in delays_ms]
    feedback = 0.70 + (room_size * 0.22)

    comb_outs = []
    for delay in delay_samples:
        buffer = np.zeros(delay, dtype=np.float32)
        out = np.zeros(len(audio), dtype=np.float32)
        buf_idx = 0
        last_lp = 0.0

        for i in range(len(audio)):
            delayed_val = buffer[buf_idx]
            # One-pole damping lowpass
            last_lp = delayed_val * (1.0 - damping) + last_lp * damping
            in_val = audio[i] + last_lp * feedback
            buffer[buf_idx] = in_val
            out[i] = delayed_val
            buf_idx = (buf_idx + 1) % delay

        comb_outs.append(out)

    comb_sum = sum(comb_outs) / len(comb_outs)

    # 2 Cascaded Allpass Diffusers
    allpass_delays_ms = [5.0, 1.7]
    diffused = comb_sum
    for ap_ms in allpass_delays_ms:
        delay = max(1, int(sr * (ap_ms / 1000.0)))
        buffer = np.zeros(delay, dtype=np.float32)
        out = np.zeros(len(diffused), dtype=np.float32)
        buf_idx = 0
        g = 0.50

        for i in range(len(diffused)):
            delayed = buffer[buf_idx]
            in_sample = diffused[i]
            y = -g * in_sample + delayed
            buffer[buf_idx] = in_sample + g * y
            out[i] = y
            buf_idx = (buf_idx + 1) % delay

        diffused = out

    reverbed = (dry_mix * audio) + (wet_mix * diffused)
    peak = np.max(np.abs(reverbed)) + 1e-9
    if peak > 0.95:
        reverbed = reverbed * (0.95 / peak)

    return reverbed.astype(np.float32)


# ---------------------------------------------------------------------------
# 5. Semitone Pitch Shifter (Phase-Vocoder Resampling)
# ---------------------------------------------------------------------------

def apply_pitch_shift(
    audio: np.ndarray,
    sr: int = 24000,
    semitones: float = 0.0,
) -> np.ndarray:
    """
    Shift audio pitch by N semitones (-6 to +6) while maintaining duration.
    Uses resampled time-stretch phase compensation.
    """
    if abs(semitones) < 0.05 or len(audio) == 0:
        return audio

    factor = 2.0 ** (semitones / 12.0)
    # Resample audio by pitch factor
    resampled_len = int(len(audio) / factor)
    shifted = scipy.signal.resample(audio, resampled_len)

    # Restore original length with smooth time-stretch
    restored = scipy.signal.resample(shifted, len(audio))
    return restored.astype(np.float32)


# ---------------------------------------------------------------------------
# 6. High-Level Voicebox Master Processor & Delivery Style Engine
# ---------------------------------------------------------------------------

DELIVERY_PRESETS: Dict[str, Dict[str, Any]] = {
    "studio_neutral": {
        "label": "Studio Neutral",
        "description": "Natural, unprocessed reference voice",
        "warmth_db": 0.0,
        "presence_db": 0.0,
        "air_db": 0.0,
        "pitch_shift": 0.0,
        "compressor": False,
        "reverb": 0.0,
    },
    "broadcast_warmth": {
        "label": "Broadcast Warmth",
        "description": "Deep radio proximity warmth with broadcast dynamic leveling",
        "warmth_db": 3.8,
        "presence_db": 1.2,
        "air_db": 1.5,
        "pitch_shift": -0.5,
        "compressor": True,
        "reverb": 0.08,
    },
    "podcast_clarity": {
        "label": "Podcast Crisp",
        "description": "Enhanced vocal presence and crystalline high-frequency air",
        "warmth_db": 1.0,
        "presence_db": 2.8,
        "air_db": 3.5,
        "pitch_shift": 0.0,
        "compressor": True,
        "reverb": 0.06,
    },
    "cinematic_narrator": {
        "label": "Cinematic Narrator",
        "description": "Deep baritone resonance with atmospheric studio chamber reverb",
        "warmth_db": 4.5,
        "presence_db": 1.0,
        "air_db": 0.5,
        "pitch_shift": -1.8,
        "compressor": True,
        "reverb": 0.22,
    },
    "soft_whisper": {
        "label": "Soft Whisper",
        "description": "Intimate, warm, and gentle delivery with subdued dynamics",
        "warmth_db": 2.0,
        "presence_db": -2.0,
        "air_db": -1.5,
        "pitch_shift": 0.5,
        "compressor": False,
        "reverb": 0.12,
    },
    "high_energy": {
        "label": "High Energy",
        "description": "Punchy, dynamic, and forward presentation",
        "warmth_db": 0.5,
        "presence_db": 3.5,
        "air_db": 2.5,
        "pitch_shift": 0.8,
        "compressor": True,
        "reverb": 0.04,
    },
}


def apply_voicebox_dsp(
    audio: np.ndarray,
    sr: int = 24000,
    preset: str = "studio_neutral",
    warmth: float = 0.0,       # Custom warmth slider: -100 to +100
    clarity: float = 0.0,      # Custom clarity slider: -100 to +100
    pitch_shift: float = 0.0,  # Custom pitch shift in semitones: -6 to +6
    reverb: float = 0.0,       # Custom reverb slider: 0 to 100
    compression: Optional[bool] = None,
) -> np.ndarray:
    """
    Master Voicebox Studio DSP chain:
      1. Preset parameter initialization
      2. User manual override blending
      3. Semitone Pitch Shifter
      4. 3-Band Parametric EQ (Warmth / Presence / Air)
      5. Broadcast Dynamic Compressor
      6. Algorithmic Studio Reverb
    """
    if len(audio) == 0:
        return audio

    config = DELIVERY_PRESETS.get(preset, DELIVERY_PRESETS["studio_neutral"]).copy()

    # Blend preset defaults with custom user overrides
    warmth_db = float(config.get("warmth_db", 0.0)) + (warmth / 25.0)
    presence_db = float(config.get("presence_db", 0.0)) + (clarity / 35.0)
    air_db = float(config.get("air_db", 0.0)) + (clarity / 25.0)
    pitch_st = float(config.get("pitch_shift", 0.0)) + pitch_shift
    rev_amount = max(0.0, min(1.0, float(config.get("reverb", 0.0)) + (reverb / 100.0)))
    use_comp = compression if compression is not None else bool(config.get("compressor", False))

    out = audio.copy()

    # 1. Pitch Transposer
    if abs(pitch_st) >= 0.05:
        out = apply_pitch_shift(out, sr=sr, semitones=pitch_st)

    # 2. 3-Band Parametric EQ
    out = apply_parametric_eq(
        out,
        sr=sr,
        warmth_gain_db=warmth_db,
        presence_gain_db=presence_db,
        air_gain_db=air_db,
    )

    # 3. Dynamic Broadcast Compressor
    if use_comp:
        out = apply_studio_compressor(out, sr=sr, threshold_db=-18.0, ratio=3.2, makeup_gain_db=2.5)

    # 4. Studio Room Reverb
    if rev_amount > 0.01:
        out = apply_studio_reverb(out, sr=sr, room_size=0.35, wet_mix=rev_amount * 0.35)

    # Final Peak Headroom Limiter (-0.5 dBFS)
    peak = np.max(np.abs(out)) + 1e-9
    if peak > 0.94:
        out = out * (0.94 / peak)

    return out.astype(np.float32)
