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

for /f %%i in ('backend\.venv\Scripts\python.exe -c "import socket; s=socket.socket(); s.bind(('', 0)); print(s.getsockname()[1]); s.close()"') do set BACKEND_PORT=%%i
for /f %%i in ('backend\.venv\Scripts\python.exe -c "import socket; s=socket.socket(); s.bind(('', 0)); print(s.getsockname()[1]); s.close()"') do set FRONTEND_PORT=%%i

echo.
echo Starting Backend on http://localhost:%BACKEND_PORT% ...
start "AutoTranscribe Backend" cmd /k "backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port %BACKEND_PORT%"

echo Starting Frontend on http://localhost:%FRONTEND_PORT% ...
start "AutoTranscribe Frontend" cmd /k "cd frontend && set NEXT_PUBLIC_API_BASE=http://localhost:%BACKEND_PORT%&& set PORT=%FRONTEND_PORT%&& npm run dev"

echo.
echo ==============================================
echo   AutoTranscribe is now running!
echo   Frontend : http://localhost:%FRONTEND_PORT%
echo   Backend  : http://localhost:%BACKEND_PORT%
echo   API Docs : http://localhost:%BACKEND_PORT%/docs
echo ==============================================
echo.
