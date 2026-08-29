[CmdletBinding()]
param (
    [switch]$Prod,
    [switch]$DryRun,
    [switch]$Open,
    [switch]$Help
)

# AutoTranscribe Launcher
# Usage: .\start.ps1 [-Prod] [-DryRun] [-Open] [-Help]

if ($Help) {
    Write-Host "AutoTranscribe Launcher"
    Write-Host "Usage: .\start.ps1 [-Prod] [-DryRun] [-Open] [-Help]"
    Write-Host "  -Prod   : Build and start Next.js frontend in production mode"
    Write-Host "  -DryRun : Verify prerequisites and dependencies without launching servers"
    Write-Host "  -Open   : Automatically open default browser when ready"
    Write-Host "  -Help   : Display this help message"
    exit 0
}

$Root = $PSScriptRoot

# ── Colours ──────────────────────────────────────────────────────────────────
function Write-Step($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "  +------------------------------+" -ForegroundColor Cyan
Write-Host "  |     AutoTranscribe  v1.0     |" -ForegroundColor Cyan
Write-Host "  +------------------------------+" -ForegroundColor Cyan
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
    Write-Step "Creating Python virtual environment (Python 3.12)..."
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3.12 -m venv $VenvDir 2>$null
    }
    if (-not (Test-Path $VenvPython)) {
        python -m venv $VenvDir
    }
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $VenvPython)) {
        Write-Err "Failed to create venv. Is Python 3.10+ installed?"
        exit 1
    }
    Write-Ok "Virtual environment created."
}

# Fast-check dependencies
& $VenvPython -c "import fastapi, uvicorn, whisperx, soundfile, librosa" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Step "Installing / verifying Python packages (TTS + WhisperX)..."
    & $VenvPython -m pip install -r $Requirements
    if ($LASTEXITCODE -ne 0) {
        Write-Err "pip install failed. See output above."
        exit 1
    }
}
Write-Ok "Python packages ready."
Write-Host ""

# ── 3. Frontend node_modules ─────────────────────────────────────────────────

$FrontendDir = Join-Path $Root "frontend"

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Step "Installing npm packages (first run)..."
    Push-Location $FrontendDir
    cmd.exe /c "npm install --silent"
    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm install failed. Is Node 18+ installed?"
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Ok "npm packages installed."
    Write-Host ""
}

# ── 4. Get Open Ports ────────────────────────────────────────────────────────
Write-Step "Finding open ports..."
function Get-FreePort {
    $tcp = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $tcp.Start()
    $port = $tcp.LocalEndpoint.Port
    $tcp.Stop()
    return $port
}
$BackendPort = Get-FreePort
$FrontendPort = Get-FreePort
$env:NEXT_PUBLIC_API_BASE = "http://localhost:$BackendPort"
$env:PORT = $FrontendPort

if ($DryRun) {
    Write-Host ""
    Write-Ok "Dry run complete. All prerequisites and dependencies are satisfied."
    Write-Host "  Backend Port  : $BackendPort"
    Write-Host "  Frontend Port : $FrontendPort"
    exit 0
}

# ── 5. Launch backend in a new window ───────────────────────────────────────

Write-Step "Starting backend  →  http://localhost:$BackendPort"

$backendCmd = "title AutoTranscribe Backend && cd /d ""$Root"" && ""$VenvPython"" -m uvicorn backend.main:app --reload --port $BackendPort"
Start-Process cmd.exe -ArgumentList "/k $backendCmd"

# ── 6. Launch frontend in a new window ──────────────────────────────────────

if ($Prod) {
    Write-Step "Building frontend for production..."
    $buildCmd = "title AutoTranscribe Frontend Build && cd /d ""$FrontendDir"" && set NEXT_PUBLIC_API_BASE=$env:NEXT_PUBLIC_API_BASE&& npm run build"
    Start-Process cmd.exe -ArgumentList "/c $buildCmd" -Wait
    
    Write-Step "Starting frontend (Production) →  http://localhost:$FrontendPort"
    $frontendCmd = "title AutoTranscribe Frontend && cd /d ""$FrontendDir"" && set PORT=$FrontendPort&& set NEXT_PUBLIC_API_BASE=$env:NEXT_PUBLIC_API_BASE&& npm start"
} else {
    Write-Step "Starting frontend (Dev) →  http://localhost:$FrontendPort"
    $frontendCmd = "title AutoTranscribe Frontend && cd /d ""$FrontendDir"" && set PORT=$FrontendPort&& set NEXT_PUBLIC_API_BASE=$env:NEXT_PUBLIC_API_BASE&& npm run dev"
}

Start-Process cmd.exe -ArgumentList "/k $frontendCmd"

if ($Open) {
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:$FrontendPort"
}

# ── 7. Done ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Ok "Both servers are launching in separate windows."
Write-Host ""
Write-Host "  Frontend  →  http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "  Backend   →  http://localhost:$BackendPort" -ForegroundColor White
Write-Host "  API docs  →  http://localhost:$BackendPort/docs" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Close the two terminal windows to stop the servers." -ForegroundColor DarkGray
Write-Host ""
