# AutoTranscribe — Quick Start (Windows PowerShell)
# Run this from the repo root: .\start.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  AutoTranscribe" -ForegroundColor Cyan
Write-Host "  Starting backend + frontend..." -ForegroundColor DarkGray
Write-Host ""

# ---------- Backend ----------
$backendDir = Join-Path $PSScriptRoot "backend"
$venvActivate = Join-Path $backendDir ".venv\Scripts\Activate.ps1"

if (-not (Test-Path $venvActivate)) {
    Write-Host "  [backend] Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv "$backendDir\.venv"
}

Write-Host "  [backend] Launching FastAPI on http://localhost:8000" -ForegroundColor Green

$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location (Split-Path $dir -Parent)
    & "$dir\.venv\Scripts\python.exe" -m uvicorn backend.main:app --reload --port 8000
} -ArgumentList $backendDir

# ---------- Frontend ----------
$frontendDir = Join-Path $PSScriptRoot "frontend"

if (-not (Test-Path "$frontendDir\node_modules")) {
    Write-Host "  [frontend] Installing npm packages..." -ForegroundColor Yellow
    Push-Location $frontendDir
    npm install
    Pop-Location
}

Write-Host "  [frontend] Launching Next.js on http://localhost:3000" -ForegroundColor Green

$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev
} -ArgumentList $frontendDir

Write-Host ""
Write-Host "  Both servers are starting..." -ForegroundColor DarkGray
Write-Host "  Open http://localhost:3000 in your browser." -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

try {
    while ($true) {
        $backendJob | Receive-Job | ForEach-Object { Write-Host "  [backend] $_" -ForegroundColor DarkGray }
        $frontendJob | Receive-Job | ForEach-Object { Write-Host "  [frontend] $_" -ForegroundColor DarkGray }
        Start-Sleep -Seconds 2
    }
} finally {
    Stop-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "  Servers stopped." -ForegroundColor DarkGray
}
