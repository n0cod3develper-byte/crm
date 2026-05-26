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

# -- 1. Verificar servicios locales ---------------------------
Write-Host "[1/3] Verificando servicios locales..." -ForegroundColor White
Write-Host "  Asegúrate de que PostgreSQL, Redis y MinIO estén corriendo." -ForegroundColor Yellow
Write-Host "  PostgreSQL -> localhost:5432" -ForegroundColor Gray
Write-Host "  Redis      -> localhost:6379" -ForegroundColor Gray
Write-Host "  MinIO      -> localhost:9000" -ForegroundColor Gray
Write-Host ""

# Detener contenedores de app si existen (evitar conflictos de puerto)
try { docker stop cargar_crm_backend cargar_crm_frontend 2>$null | Out-Null } catch {}

Set-Location $rootDir
$oldErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker compose up -d postgres redis minio 2>&1 | ForEach-Object {
    if ($_ -notmatch "level=warning|obsolete") {
        Write-Host "  $_"
    }
}
$ErrorActionPreference = $oldErrorActionPreference

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

# -- 3. Abrir terminales para backend y frontend -------------
Write-Host ""
Write-Host "[3/3] Iniciando Backend y Frontend..." -ForegroundColor White

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
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
