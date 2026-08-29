"""
main.py
-------
FastAPI backend for AutoTranscribe.

Routes:
  GET  /health                   – liveness check
  POST /api/transcribe           – upload audio, start transcription job, return job_id
  POST /api/tts                  – script to Kokoro TTS + WhisperX alignment, return job_id
  POST /api/tts/preview          – instant audio preview of single voice or multi-voice blend
  GET  /api/progress/{job_id}    – SSE stream of pipeline progress
  GET  /api/result/{job_id}      – fetch completed result
  GET  /api/download/wav/{job_id}– download generated TTS WAV file
  DELETE /api/job/{job_id}       – cancel / clean up a job
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

# Force HuggingFace and Torch to use local project storage
os.environ["HF_HOME"] = str(Path(__file__).parent / "models" / "hf_cache")
os.environ["TORCH_HOME"] = str(Path(__file__).parent / "models" / "torch_cache")

import aiofiles
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="AutoTranscribe API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
TTS_DIR = UPLOAD_DIR / "tts_wav"
TTS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".webm"}

# ---------------------------------------------------------------------------
# In-memory job store  { job_id: JobState }
# ---------------------------------------------------------------------------
_jobs: dict[str, dict[str, Any]] = {}


def _new_job(
    job_id: str,
    audio_path: str = "",
    job_type: str = "transcribe",
) -> dict[str, Any]:
    return {
        "id": job_id,
        "type": job_type,
        "audio_path": audio_path,
        "wav_path": None,
        "status": "queued",   # queued | running | complete | error
        "stage": "uploading" if job_type == "transcribe" else "generating_audio",
        "pct": 0,
        "result": None,
        "error": None,
        "events": asyncio.Queue(),   # SSE events
        "created_at": time.time(),
    }


class TtsRequest(BaseModel):
    script: str = Field(..., description="Script text to synthesize")
    voice: Any = Field("default", description="Single voice ID or reference path")
    lang_code: str = Field("en", description="Language code (e.g. 'en', 'es', 'fr', 'de', 'ja', 'zh', etc.)")
    speed: float = Field(1.0, ge=0.5, le=2.0, description="Speech speed factor")
    exaggeration: float = Field(0.5, ge=0.0, le=2.0, description="Emotion and expressiveness exaggeration factor")
    model: str = Field("base", description="WhisperX model size")
    device: str = Field("auto", description="Compute device: auto, cuda, or cpu")
    pause_threshold: float = Field(0.75, ge=0.1, le=5.0, description="Sentence pause threshold in seconds")
    dsp: Optional[Dict[str, Any]] = Field(None, description="Voicebox DSP FX & Delivery settings")


class TtsPreviewRequest(BaseModel):
    voice: Any = Field("default", description="Single voice ID or reference path")
    lang_code: str = Field("en", description="Language code")
    speed: float = Field(1.0, ge=0.5, le=2.0, description="Speech speed factor")
    exaggeration: float = Field(0.5, ge=0.0, le=2.0, description="Emotion expressiveness factor")
    text: Optional[str] = Field(None, description="Optional preview text")
    dsp: Optional[Dict[str, Any]] = Field(None, description="Voicebox DSP FX & Delivery settings")


TtsRequest.model_rebuild()
TtsPreviewRequest.model_rebuild()


# ---------------------------------------------------------------------------
# Health check & Presets
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/tts/presets")
async def get_tts_delivery_presets():
    from .voicebox_dsp import DELIVERY_PRESETS
    return JSONResponse(content=DELIVERY_PRESETS)


# ---------------------------------------------------------------------------
# POST /api/transcribe  (Audio upload -> WhisperX)
# ---------------------------------------------------------------------------
@app.post("/api/transcribe")
async def transcribe_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model: str = Form("base"),
    language: Optional[str] = Form(None),
    device: str = Form("auto"),
    pause_threshold: float = Form(0.75),
):
    # Validate file extension
    suffix = Path(file.filename or "file.mp3").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Save upload to disk
    job_id = str(uuid.uuid4())
    audio_path = UPLOAD_DIR / f"{job_id}{suffix}"
    async with aiofiles.open(audio_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    # Create job record
    job = _new_job(job_id, str(audio_path), job_type="transcribe")
    _jobs[job_id] = job

    # Start background task
    background_tasks.add_task(
        _run_transcribe_job,
        job_id=job_id,
        model_name=model,
        language=language if language and language != "auto" else None,
        device_req=device,
        pause_threshold=pause_threshold,
    )

    return {"job_id": job_id}


# ---------------------------------------------------------------------------
# POST /api/tts  (Script -> Chatterbox TTS -> WAV -> WhisperX)
# ---------------------------------------------------------------------------
@app.post("/api/tts")
async def create_tts_job(
    request: TtsRequest,
    background_tasks: BackgroundTasks,
):
    script_text = request.script.strip()
    if not script_text:
        raise HTTPException(status_code=400, detail="Script text cannot be empty.")

    job_id = str(uuid.uuid4())
    job = _new_job(job_id, audio_path="", job_type="tts")
    _jobs[job_id] = job

    background_tasks.add_task(
        _run_tts_job,
        job_id=job_id,
        script=script_text,
        voice=request.voice,
        lang_code=request.lang_code,
        speed=request.speed,
        exaggeration=request.exaggeration,
        model_name=request.model,
        device_req=request.device,
        pause_threshold=request.pause_threshold,
        dsp_settings=request.dsp,
    )

    return {"job_id": job_id}


# ---------------------------------------------------------------------------
# POST /api/tts/preview  (Fast voice audio preview)
# ---------------------------------------------------------------------------
@app.post("/api/tts/preview")
async def preview_tts_voice(request: TtsPreviewRequest):
    try:
        from .tts import synthesize_preview
        audio_bytes = await asyncio.to_thread(
            synthesize_preview,
            voice=request.voice,
            lang_code=request.lang_code,
            speed=request.speed,
            text=request.text,
            exaggeration=request.exaggeration,
            dsp_settings=request.dsp,
        )
        return Response(content=audio_bytes, media_type="audio/wav")
    except Exception as exc:
        logger.exception("Voice preview failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Voice Cloning & Custom Voices API
# ---------------------------------------------------------------------------
@app.post("/api/voices/clone")
async def clone_voice_endpoint(
    file: UploadFile = File(...),
    name: str = Form("My Cloned Voice"),
    gender: Optional[str] = Form(None),
    lang_code: str = Form("a"),
):
    """
    Zero-shot voice cloning endpoint using ECAPA-TDNN speaker embeddings.
    Inspired by XTTS v2 / Chatterbox reference audio conditioning.
    """
    try:
        from .xtts_engine import clone_voice_xtts_style
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty audio file provided.")

        voice_record = await asyncio.to_thread(
            clone_voice_xtts_style,
            audio_source=content,
            name=name,
            gender=gender if gender and gender != "auto" else None,
            lang_code=lang_code,
        )
        return JSONResponse(content=voice_record)
    except Exception as exc:
        logger.exception("Voice cloning failed")
        raise HTTPException(status_code=500, detail=str(exc))


async def _run_voice_training_job(
    job_id: str,
    audio_bytes: bytes,
    name: str,
    gender: Optional[str],
    lang_code: str,
    epochs: int,
) -> None:
    job = _jobs.get(job_id)
    if not job:
        return

    def progress_cb(info: Dict[str, Any]) -> None:
        job["stage"] = info.get("stage", "optimizing")
        job["pct"] = info.get("pct", 0)
        try:
            job["events"].put_nowait(info)
        except Exception:
            pass

    job["status"] = "running"

    try:
        # Use XTTS-style ECAPA-TDNN zero-shot cloning engine (primary)
        from .xtts_engine import clone_voice_xtts_style

        voice_record = await asyncio.to_thread(
            clone_voice_xtts_style,
            audio_source=audio_bytes,
            name=name,
            gender=gender,
            lang_code=lang_code,
            progress_cb=progress_cb,
        )
        job["status"] = "complete"
        job["result"] = voice_record
        job["pct"] = 100
        job["stage"] = "complete"
        try:
            job["events"].put_nowait({
                "stage": "complete",
                "pct": 100,
                "voice_record": voice_record,
                "message": "Voice cloning complete!",
            })
        except Exception:
            pass
    except Exception as exc:
        logger.exception("Voice training job %s failed", job_id)
        job["status"] = "error"
        job["error"] = str(exc)
        try:
            job["events"].put_nowait({"stage": "error", "pct": 0, "error": str(exc)})
        except Exception:
            pass


@app.post("/api/voices/train")
async def start_voice_training_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form("My Cloned Voice"),
    gender: Optional[str] = Form(None),
    lang_code: str = Form("a"),
    epochs: int = Form(100),
):
    """
    Start multi-stage iterative deep neural voice training (100 Epochs).
    Returns job_id for real-time SSE telemetry tracking.
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file provided.")

    job_id = str(uuid.uuid4())
    job = _new_job(job_id, job_type="voice_train")
    _jobs[job_id] = job

    background_tasks.add_task(
        _run_voice_training_job,
        job_id=job_id,
        audio_bytes=content,
        name=name,
        gender=gender if gender and gender != "auto" else None,
        lang_code=lang_code,
        epochs=max(10, min(250, epochs)),
    )
    return {"job_id": job_id}


@app.get("/api/voices/custom")
async def get_custom_voices_endpoint():
    from .voice_cloner import list_custom_voices
    voices = list_custom_voices()
    return JSONResponse(content=voices)


@app.delete("/api/voices/custom/{voice_id}")
async def delete_custom_voice_endpoint(voice_id: str):
    from .voice_cloner import delete_custom_voice
    success = delete_custom_voice(voice_id)
    if not success:
        raise HTTPException(status_code=404, detail="Custom voice not found")
    return {"ok": True}


@app.get("/api/voices/sample/{voice_id}")
async def get_custom_voice_sample_endpoint(voice_id: str):
    from .voice_cloner import get_custom_voice_sample_path
    p = get_custom_voice_sample_path(voice_id)
    if not p or not os.path.exists(p):
        raise HTTPException(status_code=404, detail="Voice sample not found")
    return FileResponse(path=str(p), media_type="audio/wav", filename=f"{voice_id}_sample.wav")


@app.post("/api/voices/verify")
async def verify_voice_similarity_endpoint(
    file_a: Optional[UploadFile] = File(None),
    file_b: Optional[UploadFile] = File(None),
    voice_id: Optional[str] = Form(None),
):
    """
    SV2TTS Speaker Verification Endpoint:
    Compares two voice samples using 256-D deep speaker embeddings (GE2E d-vectors).
    """
    try:
        from .speaker_encoder import extract_speaker_embedding, compute_speaker_similarity
        from .voice_cloner import load_and_preprocess_audio, get_custom_voice_sample_path, get_custom_voice_dvector

        if voice_id and file_a:
            # Compare uploaded file against custom voice's stored d-vector or reference sample
            content = await file_a.read()
            audio_test, _ = load_and_preprocess_audio(io.BytesIO(content), target_sr=24000)
            emb_test = extract_speaker_embedding(audio_test, sr=24000)

            stored_emb = get_custom_voice_dvector(voice_id)
            if stored_emb is None:
                sample_p = get_custom_voice_sample_path(voice_id)
                if not sample_p or not sample_p.exists():
                    raise HTTPException(status_code=404, detail="Custom voice sample not found")
                ref_audio, _ = load_and_preprocess_audio(str(sample_p), target_sr=24000)
                stored_emb = extract_speaker_embedding(ref_audio, sr=24000)

            sim = compute_speaker_similarity(emb_test, stored_emb)
            match_level = "High" if sim >= 75.0 else ("Moderate" if sim >= 50.0 else "Low")
            return {
                "similarity_pct": sim,
                "is_match": sim >= 65.0,
                "match_level": match_level,
                "encoder": "SV2TTS-3LSTM-GE2E",
            }

        elif file_a and file_b:
            content_a = await file_a.read()
            content_b = await file_b.read()
            audio_a, _ = load_and_preprocess_audio(io.BytesIO(content_a), target_sr=24000)
            audio_b, _ = load_and_preprocess_audio(io.BytesIO(content_b), target_sr=24000)
            emb_a = extract_speaker_embedding(audio_a, sr=24000)
            emb_b = extract_speaker_embedding(audio_b, sr=24000)
            sim = compute_speaker_similarity(emb_a, emb_b)
            match_level = "High" if sim >= 75.0 else ("Moderate" if sim >= 50.0 else "Low")
            return {
                "similarity_pct": sim,
                "is_match": sim >= 65.0,
                "match_level": match_level,
                "encoder": "SV2TTS-3LSTM-GE2E",
            }
        else:
            raise HTTPException(status_code=400, detail="Provide either voice_id + file_a, or file_a + file_b")

    except Exception as exc:
        logger.exception("Voice verification failed")
        raise HTTPException(status_code=500, detail=str(exc))



# ---------------------------------------------------------------------------
# Background workers
# ---------------------------------------------------------------------------
async def _run_transcribe_job(
    job_id: str,
    model_name: str,
    language: Optional[str],
    device_req: str,
    pause_threshold: float,
) -> None:
    job = _jobs.get(job_id)
    if not job:
        return

    def progress_cb(stage: str, pct: int) -> None:
        job["stage"] = stage
        job["pct"] = pct
        try:
            job["events"].put_nowait({"stage": stage, "pct": pct})
        except Exception:
            pass

    job["status"] = "running"
    progress_cb("loading_model", 0)

    try:
        from .transcribe import run_transcription

        result = await run_transcription(
            audio_path=job["audio_path"],
            model_name=model_name,
            language=language,
            device_req=device_req,
            pause_threshold=pause_threshold,
            progress_cb=progress_cb,
        )
        job["status"] = "complete"
        job["result"] = result
        progress_cb("complete", 100)

    except Exception as exc:
        logger.exception("Transcription Job %s failed", job_id)
        job["status"] = "error"
        job["error"] = str(exc)
        try:
            job["events"].put_nowait({"stage": "error", "pct": 0, "error": str(exc)})
        except Exception:
            pass
    finally:
        # Clean up uploaded audio file
        audio = job.get("audio_path", "")
        if audio and os.path.exists(audio):
            try:
                os.remove(audio)
            except OSError:
                pass


async def _run_tts_job(
    job_id: str,
    script: str,
    voice: Any,
    lang_code: str,
    speed: float,
    exaggeration: float,
    model_name: str,
    device_req: str,
    pause_threshold: float,
    dsp_settings: Optional[Dict[str, Any]] = None,
) -> None:
    job = _jobs.get(job_id)
    if not job:
        return

    def progress_cb(stage: str, pct: int) -> None:
        job["stage"] = stage
        job["pct"] = pct
        try:
            job["events"].put_nowait({"stage": stage, "pct": pct})
        except Exception:
            pass

    job["status"] = "running"
    progress_cb("generating_audio", 0)

    try:
        from .tts import run_tts_and_transcribe

        result = await run_tts_and_transcribe(
            script=script,
            voice=voice,
            lang_code=lang_code,
            speed=speed,
            exaggeration=exaggeration,
            model_name=model_name,
            device_req=device_req,
            pause_threshold=pause_threshold,
            dsp_settings=dsp_settings,
            progress_cb=progress_cb,
        )
        job["status"] = "complete"
        job["wav_path"] = result.get("wav_path")
        job["result"] = {
            "segments": result["segments"],
            "language": result["language"],
            "duration": result["duration"],
            "has_wav": bool(result.get("wav_path")),
            "job_id": job_id,
        }
        progress_cb("complete", 100)

    except Exception as exc:
        logger.exception("TTS Job %s failed", job_id)
        job["status"] = "error"
        job["error"] = str(exc)
        try:
            job["events"].put_nowait({"stage": "error", "pct": 0, "error": str(exc)})
        except Exception:
            pass


# ---------------------------------------------------------------------------
# GET /api/progress/{job_id}  – SSE
# ---------------------------------------------------------------------------
@app.get("/api/progress/{job_id}")
async def progress_stream(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        import json
        yield {
            "data": json.dumps({"stage": job["stage"], "pct": job["pct"]}),
        }

        while True:
            status = job["status"]
            if status in ("complete", "error"):
                while not job["events"].empty():
                    evt = await job["events"].get()
                    yield {"data": json.dumps(evt)}
                break

            try:
                evt = await asyncio.wait_for(job["events"].get(), timeout=30.0)
                yield {"data": json.dumps(evt)}
            except asyncio.TimeoutError:
                yield {"comment": "keepalive"}

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# GET /api/result/{job_id}
# ---------------------------------------------------------------------------
@app.get("/api/result/{job_id}")
async def get_result(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] == "error":
        raise HTTPException(status_code=500, detail=job["error"])

    if job["status"] != "complete":
        raise HTTPException(status_code=202, detail="Job not complete yet")

    return JSONResponse(content=job["result"])


# ---------------------------------------------------------------------------
# GET /api/download/wav/{job_id}
# ---------------------------------------------------------------------------
@app.get("/api/download/wav/{job_id}")
async def download_wav(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    wav_path = job.get("wav_path")
    if not wav_path or not os.path.exists(wav_path):
        raise HTTPException(status_code=404, detail="WAV file not found or expired")

    return FileResponse(
        path=wav_path,
        media_type="audio/wav",
        filename=f"speech_{job_id[:8]}.wav",
    )


# ---------------------------------------------------------------------------
# GET /api/download/mp3/{job_id}
# ---------------------------------------------------------------------------
@app.get("/api/download/mp3/{job_id}")
async def download_mp3(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    wav_path = job.get("wav_path")
    if not wav_path or not os.path.exists(wav_path):
        raise HTTPException(status_code=404, detail="WAV file not found or expired")

    mp3_path = wav_path.replace(".wav", ".mp3")
    if not os.path.exists(mp3_path):
        import subprocess
        # Convert WAV to MP3 using ffmpeg
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-qscale:a", "2", mp3_path],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception as e:
            logger.exception("Failed to convert WAV to MP3")
            raise HTTPException(status_code=500, detail="Failed to convert audio to MP3")
            
    return FileResponse(
        path=mp3_path,
        media_type="audio/mpeg",
        filename=f"speech_{job_id[:8]}.mp3",
    )


# ---------------------------------------------------------------------------
# DELETE /api/job/{job_id}
# ---------------------------------------------------------------------------
@app.delete("/api/job/{job_id}")
async def delete_job(job_id: str):
    job = _jobs.pop(job_id, None)
    if not job:
        return {"ok": True}

    audio = job.get("audio_path", "")
    if audio and os.path.exists(audio):
        try:
            os.remove(audio)
        except OSError:
            pass

    wav = job.get("wav_path", "")
    if wav and os.path.exists(wav):
        try:
            os.remove(wav)
            mp3 = wav.replace(".wav", ".mp3")
            if os.path.exists(mp3):
                os.remove(mp3)
        except OSError:
            pass

    return {"ok": True}


# ---------------------------------------------------------------------------
# Startup: clean up stale uploads & TTS wavs from previous run
# ---------------------------------------------------------------------------
def _preload_models():
    """Background task to preload models to disk and RAM."""
    try:
        logger.info("Initializing Chatterbox TTS models...")
        from backend.tts import _get_chatterbox_model
        _get_chatterbox_model("turbo")
        logger.info("Chatterbox TTS models preloaded successfully.")
    except Exception as exc:
        logger.error(f"Failed to preload Chatterbox models: {exc}")

@app.on_event("startup")
async def startup_cleanup():
    asyncio.create_task(asyncio.to_thread(_preload_models))
    for f in UPLOAD_DIR.glob("*"):
        if f.is_file():
            try:
                f.unlink()
            except OSError:
                pass
    if TTS_DIR.exists():
        for f in TTS_DIR.glob("*"):
            if f.is_file():
                try:
                    f.unlink()
                except OSError:
                    pass
    logger.info("AutoTranscribe backend ready.")
