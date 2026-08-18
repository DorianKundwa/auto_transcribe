import sys
import os

# Ensure backend module can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.tts import _synthesize

def main():
    script_path = 'adam_script.txt'
    with open(script_path, 'r', encoding='utf-8') as f:
        script = f.read()

    output_path = "adam_audio.wav"
    print("Synthesizing audio using Kokoro 'am_adam' voice...")
    
    _synthesize(
        script=script,
        voice="am_adam",
        lang_code="a",
        speed=1.0,
        output_path=output_path
    )
    print(f"Done! Audio saved to {output_path}")

if __name__ == "__main__":
    main()
