"""
main.py
-------
FastAPI backend for AutoTranscribe.

Routes:
  GET  /health                   – liveness check
  POST /api/transcribe           – upload audio, start job, return job_id
  GET  /api/progress/{job_id}    – SSE stream of pipeline progress
  GET  /api/result/{job_id}      – fetch completed result
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
from typing import Any, Optional

import aiofiles
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="AutoTranscribe API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".webm"}

# ---------------------------------------------------------------------------
# In-memory job store  { job_id: JobState }
# ---------------------------------------------------------------------------
_jobs: dict[str, dict[str, Any]] = {}


def _new_job(job_id: str, audio_path: str) -> dict[str, Any]:
    return {
        "id": job_id,
        "audio_path": audio_path,
        "status": "queued",   # queued | running | complete | error
        "stage": "uploading",
        "pct": 0,
        "result": None,
        "error": None,
        "events": asyncio.Queue(),   # SSE events
        "created_at": time.time(),
    }


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# POST /api/transcribe
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
    job = _new_job(job_id, str(audio_path))
    _jobs[job_id] = job

    # Start background task
    background_tasks.add_task(
        _run_job,
        job_id=job_id,
        model_name=model,
        language=language if language and language != "auto" else None,
        device_req=device,
        pause_threshold=pause_threshold,
    )

    return {"job_id": job_id}


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------
async def _run_job(
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
        logger.exception("Job %s failed", job_id)
        job["status"] = "error"
        job["error"] = str(exc)
        try:
            job["events"].put_nowait({"stage": "error", "pct": 0, "error": str(exc)})
        except Exception:
            pass
    finally:
        # Clean up audio file
        audio = job.get("audio_path", "")
        if audio and os.path.exists(audio):
            try:
                os.remove(audio)
            except OSError:
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
        # Immediately emit current state
        import json
        yield {
            "data": json.dumps({"stage": job["stage"], "pct": job["pct"]}),
        }

        while True:
            status = job["status"]
            if status in ("complete", "error"):
                # Drain remaining events
                while not job["events"].empty():
                    evt = await job["events"].get()
                    yield {"data": json.dumps(evt)}
                break

            try:
                evt = await asyncio.wait_for(job["events"].get(), timeout=30.0)
                yield {"data": json.dumps(evt)}
            except asyncio.TimeoutError:
                # Send a keepalive comment
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

    return {"ok": True}


# ---------------------------------------------------------------------------
# Startup: clean up stale uploads from previous run
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup_cleanup():
    for f in UPLOAD_DIR.glob("*"):
        if f.is_file():
            try:
                f.unlink()
            except OSError:
                pass
    logger.info("AutoTranscribe backend ready.")
