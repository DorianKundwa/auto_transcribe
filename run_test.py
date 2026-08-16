import asyncio
import os
import sys
import time
from backend.transcribe import run_transcription

def format_ts(seconds):
    total = int(max(0, seconds))
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    if h > 0:
        return f"[{h}:{m:02d}:{s:02d}]"
    return f"[{m}:{s:02d}]"

async def main():
    audio_path = os.path.abspath("test_audio/untitled.mp3")
    print(f"File: {audio_path}")
    print("Engine: WhisperX (model=base, device=cpu, vad=silero)")
    print()

    def progress_cb(stage, pct):
        t = time.strftime("%H:%M:%S")
        print(f"  [{t}] {stage:<15} ({pct:>3}%)")

    start_time = time.time()
    res = await run_transcription(
        audio_path=audio_path,
        model_name="base",
        language=None,
        device_req="cpu",
        pause_threshold=0.75,
        progress_cb=progress_cb,
    )
    elapsed = time.time() - start_time

    print()
    print("=" * 60)
    print(f"Transcribed in : {elapsed:.1f} seconds")
    print(f"Detected Lang  : {res.get('language')}")
    print(f"Audio Duration : {res.get('duration', 0):.2f}s")
    print(f"Sentence Count : {len(res.get('segments', []))}")
    print("=" * 60)
    print()
    print("--- FULL TRANSCRIPT ---")
    for s in res.get("segments", []):
        print(f"{format_ts(s['start'])} {s['text']}")

if __name__ == "__main__":
    asyncio.run(main())
