# ============================================================
# CARGAR CRM -- Script de inicio del entorno de desarrollo
# Uso: .\dev-start.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  CARGAR CRM -- Iniciando entorno de desarrollo" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# -- 1. Verificar / arrancar Docker Desktop ------------------
function Wait-DockerReady {
    $maxAttempts = 24
    $attempts = 0
    while ($attempts -lt $maxAttempts) {
        try {
            $null = docker info 2>&1
            if ($LASTEXITCODE -eq 0) { return $true }
        } catch {}
        $attempts++
        Write-Host "  Esperando Docker Desktop... ($($attempts * 5)s)" -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
    return $false
}

Write-Host "[1/4] Verificando Docker Desktop..." -ForegroundColor White
$dockerRunning = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerRunning = $true }
} catch {}

if (-not $dockerRunning) {
    Write-Host "  Docker no esta corriendo. Iniciando Docker Desktop..." -ForegroundColor Yellow
    $dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerPath) {
        Start-Process $dockerPath
    } else {
        Write-Host "  ERROR: No se encontro Docker Desktop en $dockerPath" -ForegroundColor Red
        Write-Host "         Abrelo manualmente y vuelve a ejecutar este script." -ForegroundColor Red
        exit 1
    }
    $ready = Wait-DockerReady
    if (-not $ready) {
        Write-Host "  ERROR: Docker Desktop tardo demasiado en arrancar." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  OK - Docker Desktop listo" -ForegroundColor Green

# -- 2. Levantar infraestructura (postgres, redis, minio) ----
Write-Host ""
Write-Host "[2/4] Levantando servicios de infraestructura..." -ForegroundColor White

# Detener contenedores de app si existen (evitar conflictos de puerto)
docker stop cargar_crm_backend cargar_crm_frontend 2>$null | Out-Null

Set-Location $rootDir
docker compose up -d postgres redis minio 2>&1 | ForEach-Object {
    if ($_ -notmatch "level=warning|obsolete") {
        Write-Host "  $_"
    }
}

# Esperar healthcheck de postgres
Write-Host ""
Write-Host "  Esperando que PostgreSQL este listo..." -ForegroundColor Yellow
$pgReady = $false
for ($i = 0; $i -lt 20; $i++) {
    $status = docker inspect --format="{{.State.Health.Status}}" cargar_crm_db 2>$null
    if ($status -eq "healthy") { $pgReady = $true; break }
    Start-Sleep -Seconds 3
}
if ($pgReady) {
    Write-Host "  OK - PostgreSQL listo" -ForegroundColor Green
} else {
    Write-Host "  WARN - PostgreSQL aun no esta healthy, continuando de todas formas..." -ForegroundColor Yellow
}

# -- 3. Liberar puertos locales ------------------------------
Write-Host ""
Write-Host "[3/4] Liberando puertos locales (3001, 4000)..." -ForegroundColor White
npx kill-port 3001 4000 2>$null | Out-Null
Write-Host "  OK - Puertos libres" -ForegroundColor Green

# -- 4. Abrir terminales para backend y frontend -------------
Write-Host ""
Write-Host "[4/4] Iniciando Backend y Frontend..." -ForegroundColor White

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$rootDir\backend'; Write-Host '--- BACKEND ---' -ForegroundColor Cyan; npm run dev"
)

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$rootDir\frontend'; Write-Host '--- FRONTEND ---' -ForegroundColor Magenta; npm run dev"
)

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Entorno iniciado correctamente" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend  -> http://localhost:3001" -ForegroundColor White
Write-Host "  Backend   -> http://localhost:4000/api/v1" -ForegroundColor White
Write-Host "  MinIO     -> http://localhost:9001" -ForegroundColor White
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
