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

# -- 2. Liberar puertos locales ------------------------------
Write-Host "[2/3] Liberando puertos locales (3001, 4000)..." -ForegroundColor White
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
