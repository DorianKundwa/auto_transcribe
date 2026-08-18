@echo off
setlocal enabledelayedexpansion
title AutoTranscribe Launcher
cd /d "%~dp0"

echo.
echo   ==============================
echo      AutoTranscribe  v1.0
echo   ==============================
echo.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found on PATH. Please install Python 3.9+.
    pause
    exit /b 1
)

where ffmpeg >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] FFmpeg not found on PATH. Please install FFmpeg.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js/npm not found on PATH. Please install Node.js 18+.
    pause
    exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
    echo [1/3] Creating Python virtual environment...
    python -m venv backend\.venv
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

echo [2/3] Checking backend dependencies...
backend\.venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt

if not exist "frontend\node_modules" (
    echo [3/3] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo.
echo Starting Backend on http://localhost:8000 ...
start "AutoTranscribe Backend" cmd /k "backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000"

echo Starting Frontend on http://localhost:3000 ...
start "AutoTranscribe Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ==============================================
echo   AutoTranscribe is now running!
echo   Frontend : http://localhost:3000
echo   Backend  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo ==============================================
echo.
