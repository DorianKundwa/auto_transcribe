# AutoTranscribe

A local web application that converts audio files into clean, timestamped transcripts using **WhisperX** with word-level alignment.

```
[0:00] You're standing in a checkout line.
[0:02] Your phone battery died two minutes ago.
[0:04] And now there's nothing left to look at but the tabloid rack...
```

## Features

- 🎤 **WhisperX transcription** with word-level alignment
- ⏱️ **Accurate sentence timestamps** — from the first spoken word's time
- ✏️ **Full transcript editor** with undo/redo, merge, split, delete
- 🎵 **Synchronized audio player** — click any line to seek; active line highlights during playback
- 📤 **Export** to TXT, SRT, VTT, JSON
- 🌍 **Auto language detection** or manual selection
- ⚡ **Model caching** — WhisperX stays loaded between jobs
- 🔒 **100% local** — no audio is sent to third-party services

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, uvicorn |
| Transcription | WhisperX |
| Audio | FFmpeg |

## Prerequisites

- **Python 3.9–3.11**
- **Node.js 18+**
- **FFmpeg** — must be on your `PATH`
- **CUDA** (optional) — for GPU acceleration

Install FFmpeg:
- Windows: `winget install ffmpeg` or download from https://ffmpeg.org
- macOS: `brew install ffmpeg`
- Linux: `sudo apt install ffmpeg`

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/DorianKundwa/auto_transcribe.git
cd auto_transcribe
```

### 2. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

> **GPU users**: Install PyTorch with CUDA first:
> ```bash
> pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
> ```

### 3. Frontend

```bash
cd frontend
npm install
```

## Running

### Windows (PowerShell)

```powershell
.\start.ps1
```

### Manual

Terminal 1 — Backend:
```bash
cd backend
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
cd ..
python -m uvicorn backend.main:app --reload --port 8000
```

Terminal 2 — Frontend:
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000**

## Usage

1. **Upload** an audio file (MP3, WAV, M4A, AAC, FLAC, OGG)
2. **Configure** the WhisperX model, language, and compute device
3. Click **Transcribe**
4. Watch the pipeline progress: Upload → Load model → Transcribe → Align → Segment
5. **Click any timestamp** to jump to that moment in the audio
6. **Edit** transcript lines inline; undo/redo your changes
7. **Export** to TXT, SRT, VTT, or JSON

## Models

| Model | VRAM | Speed | Quality |
|-------|------|-------|---------|
| tiny | ~1 GB | Fastest | ★★☆☆☆ |
| base | ~1 GB | Fast | ★★★☆☆ |
| small | ~2 GB | Balanced | ★★★★☆ |
| medium | ~5 GB | Slow | ★★★★☆ |
| large-v2 | ~10 GB | Slowest | ★★★★★ |
| large-v3 | ~10 GB | Slowest | ★★★★★ |

On CPU, `base` or `small` is recommended.

## Sentence Segmentation

AutoTranscribe does **not** split sentences at arbitrary intervals. It:

1. Gets word-level timestamps from WhisperX alignment
2. Detects sentence boundaries using punctuation (`.`, `?`, `!`)
3. Detects long pauses between words (configurable threshold, default 0.75s)
4. Groups words into natural sentences
5. Sets each sentence's timestamp to the **first word's start time**

## Export Formats

**TXT**
```
[0:00] You're standing in a checkout line.
[0:02] Your phone battery died two minutes ago.
```

**SRT**
```
1
00:00:00,000 --> 00:00:01,200
You're standing in a checkout line.
```

**JSON**
```json
{
  "segments": [
    {
      "start": 0.00,
      "end": 1.20,
      "text": "You're standing in a checkout line.",
      "words": [{"word": "You're", "start": 0.0, "end": 0.27}, ...]
    }
  ]
}
```

## Project Structure

```
auto_transcribe/
├── backend/
│   ├── main.py          # FastAPI app, routes, SSE progress
│   ├── transcribe.py    # WhisperX pipeline + model cache
│   ├── segmentation.py  # Word → sentence grouping
│   └── requirements.txt
├── frontend/
│   ├── app/             # Next.js App Router pages
│   ├── components/      # React UI components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Types, API client, formatters
├── start.ps1            # Windows quick-start script
└── README.md
```

## License

MIT
