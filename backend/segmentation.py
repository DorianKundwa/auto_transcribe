"""
segmentation.py
---------------
Converts a flat list of word-level timestamps produced by WhisperX alignment
into natural sentences, using punctuation boundaries, silence gaps, and a
max-word-count fallback.
"""

from __future__ import annotations

import re
from typing import Any

# Punctuation that ends a sentence
_SENTENCE_ENDINGS = re.compile(r"[.?!…]+$")

# Abbreviation safeguard – don't break on these even if they end with a period
_ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "rev", "gen", "rep",
    "sen", "st", "ave", "blvd", "dept", "approx", "vol", "vs", "etc",
    "e.g", "i.e", "jan", "feb", "mar", "apr", "jun", "jul", "aug",
    "sep", "oct", "nov", "dec",
}


def _ends_sentence(word_text: str) -> bool:
    """Return True if this word text marks a sentence boundary."""
    cleaned = word_text.strip().rstrip("'\")")
    if not _SENTENCE_ENDINGS.search(cleaned):
        return False
    # Skip abbreviations
    base = cleaned.rstrip(".?!…").lower()
    if base in _ABBREVIATIONS:
        return False
    return True


def _make_segment(words: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a segment dict from a list of word dicts."""
    text = " ".join(w.get("word", "").strip() for w in words).strip()
    # Remove double spaces
    text = re.sub(r"\s+", " ", text)
    start = words[0].get("start", 0.0)
    end = words[-1].get("end", start)
    return {
        "start": round(float(start), 3),
        "end": round(float(end), 3),
        "text": text,
        "words": words,
    }


def segment_words(
    words: list[dict[str, Any]],
    pause_threshold: float = 0.75,
    max_words: int = 50,
) -> list[dict[str, Any]]:
    """
    Group aligned words into sentence segments.

    Strategy (in priority order):
    1. Sentence-ending punctuation (.  ?  !  …)
    2. Silence gap > pause_threshold between consecutive words
    3. max_words guard to avoid run-on segments

    The timestamp of each segment is the `start` of its first word.
    """
    if not words:
        return []

    segments: list[dict[str, Any]] = []
    bucket: list[dict[str, Any]] = []

    for i, word in enumerate(words):
        bucket.append(word)
        word_text = word.get("word", "").strip()
        is_last = i == len(words) - 1

        # Check pause to next word
        long_pause = False
        if not is_last:
            nxt = words[i + 1]
            gap = float(nxt.get("start", 0)) - float(word.get("end", 0))
            long_pause = gap > pause_threshold

        hit_max = len(bucket) >= max_words
        end_punct = _ends_sentence(word_text)

        if end_punct or long_pause or hit_max or is_last:
            if bucket:
                segments.append(_make_segment(bucket))
                bucket = []

    return segments


def merge_whisperx_segments(
    whisperx_segments: list[dict[str, Any]],
    pause_threshold: float = 0.75,
    max_words: int = 50,
) -> list[dict[str, Any]]:
    """
    Top-level helper: flatten all words from WhisperX segments and re-segment.

    WhisperX already splits by utterance, but its segments don't always align
    with natural sentences.  This function collects every word across all
    WhisperX segments and applies our own sentence boundary detection.
    """
    all_words: list[dict[str, Any]] = []
    for seg in whisperx_segments:
        for w in seg.get("words", []):
            # Some words may lack timestamps after alignment — skip them
            if "start" in w and "word" in w:
                all_words.append(w)

    # Fallback: if alignment produced no word-level data, use segment-level text
    if not all_words:
        return [
            {
                "start": round(float(s.get("start", 0)), 3),
                "end": round(float(s.get("end", 0)), 3),
                "text": s.get("text", "").strip(),
                "words": [],
            }
            for s in whisperx_segments
        ]

    return segment_words(all_words, pause_threshold=pause_threshold, max_words=max_words)
