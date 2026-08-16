# AutoTranscribe Launcher
# Usage: .\start.ps1
# Opens two terminal windows: one for the backend, one for the frontend.

$Root = $PSScriptRoot

# ── Colours ──────────────────────────────────────────────────────────────────
function Write-Step($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "  ╔══════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║     AutoTranscribe  v1.0     ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Check prerequisites ───────────────────────────────────────────────────

Write-Step "Checking prerequisites..."

$missing = @()

if (-not (Get-Command python  -ErrorAction SilentlyContinue)) { $missing += "python" }
if (-not (Get-Command node    -ErrorAction SilentlyContinue)) { $missing += "node" }
if (-not (Get-Command ffmpeg  -ErrorAction SilentlyContinue)) { $missing += "ffmpeg" }

if ($missing.Count -gt 0) {
    Write-Err "Missing required tools: $($missing -join ', ')"
    Write-Err "Install them and re-run this script."
    Write-Host ""
    exit 1
}

Write-Ok "python, node, ffmpeg found."
Write-Host ""

# ── 2. Backend venv ──────────────────────────────────────────────────────────

$BackendDir   = Join-Path $Root "backend"
$VenvDir      = Join-Path $BackendDir ".venv"
$VenvPython   = Join-Path $VenvDir "Scripts\python.exe"
$VenvActivate = Join-Path $VenvDir "Scripts\Activate.ps1"
$Requirements = Join-Path $BackendDir "requirements.txt"

if (-not (Test-Path $VenvPython)) {
    Write-Step "Creating Python virtual environment..."
    python -m venv $VenvDir
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to create venv. Is Python 3.9+ installed?"
        exit 1
    }
    Write-Ok "Virtual environment created."
}

# Always check / install requirements
Write-Step "Installing / verifying Python packages..."
& $VenvPython -m pip install -q -r $Requirements
if ($LASTEXITCODE -ne 0) {
    Write-Err "pip install failed. See output above."
    exit 1
}
Write-Ok "Python packages ready."
Write-Host ""

# ── 3. Frontend node_modules ─────────────────────────────────────────────────

$FrontendDir = Join-Path $Root "frontend"

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Step "Installing npm packages (first run)..."
    Push-Location $FrontendDir
    npm install --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm install failed. Is Node 18+ installed?"
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Ok "npm packages installed."
    Write-Host ""
}

# ── 4. Launch backend in a new window ───────────────────────────────────────

Write-Step "Starting backend  →  http://localhost:8000"

$backendCmd = "title AutoTranscribe Backend && cd /d `"$Root`" && `"$VenvPython`" -m uvicorn backend.main:app --reload --port 8000"
Start-Process cmd.exe -ArgumentList "/k", "`"$backendCmd`""

# ── 5. Launch frontend in a new window ──────────────────────────────────────

Write-Step "Starting frontend  →  http://localhost:3000"

$frontendCmd = "title AutoTranscribe Frontend && cd /d `"$FrontendDir`" && npm run dev"
Start-Process cmd.exe -ArgumentList "/k", "`"$frontendCmd`""

# ── 6. Done ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Ok "Both servers are launching in separate windows."
Write-Host ""
Write-Host "  Frontend  →  http://localhost:3000" -ForegroundColor White
Write-Host "  Backend   →  http://localhost:8000" -ForegroundColor White
Write-Host "  API docs  →  http://localhost:8000/docs" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Close the two terminal windows to stop the servers." -ForegroundColor DarkGray
Write-Host ""
