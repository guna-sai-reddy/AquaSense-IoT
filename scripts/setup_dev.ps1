<#
.SYNOPSIS
    AquaSense-IoT Developer Environment Initializer for Windows PowerShell.
.DESCRIPTION
    Creates Python virtual environments, copies .env files, and initializes frontend packages.
#>

param(
    [switch]$SkipFrontend = $false,
    [switch]$SkipBackend = $false,
    [switch]$SkipML = $false
)

$ErrorActionPreference = "Stop"
$RootDir = Get-Location

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AquaSense-IoT: Initializing Development Environment     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Backend Setup
if (-not $SkipBackend) {
    Write-Host "`n[1/3] Setting up Backend..." -ForegroundColor Yellow
    Set-Location "$RootDir\backend"
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Host "Created backend/.env from .env.example" -ForegroundColor Green
    }
    if (-not (Test-Path ".venv")) {
        Write-Host "Creating Python virtual environment in backend/.venv..."
        python -m venv .venv
    }
}

# 2. Frontend Setup
if (-not $SkipFrontend) {
    Write-Host "`n[2/3] Setting up Frontend..." -ForegroundColor Yellow
    Set-Location "$RootDir\frontend"
    if (-not (Test-Path ".env.local")) {
        Copy-Item ".env.local.example" ".env.local"
        Write-Host "Created frontend/.env.local from .env.local.example" -ForegroundColor Green
    }
}

# 3. ML Engine Setup
if (-not $SkipML) {
    Write-Host "`n[3/3] Setting up ML Engine..." -ForegroundColor Yellow
    Set-Location "$RootDir\ml_engine"
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Host "Created ml_engine/.env from .env.example" -ForegroundColor Green
    }
    if (-not (Test-Path ".venv")) {
        Write-Host "Creating Python virtual environment in ml_engine/.venv..."
        python -m venv .venv
    }
}

Set-Location $RootDir
Write-Host "`nEnvironment initialization completed successfully!" -ForegroundColor Green
Write-Host "Refer to README.md for installation commands." -ForegroundColor Cyan
