# ============================================================
# CARGAR CRM -- Setup de base de datos (EJECUTAR COMO ADMIN)
# Click derecho en PowerShell -> "Ejecutar como administrador"
# ============================================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CARGAR CRM -- Setup Base de Datos" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# -- 1. Reiniciar PostgreSQL --
Write-Host "[1/3] Reiniciando servicio PostgreSQL..." -ForegroundColor White
try {
    Restart-Service postgresql-x64-18 -Force
    Start-Sleep -Seconds 4
    $status = (Get-Service postgresql-x64-18).Status
    if ($status -eq "Running") {
        Write-Host "  OK - PostgreSQL corriendo en puerto 5434" -ForegroundColor Green
    } else {
        Write-Host "  ERROR - PostgreSQL no arranco. Estado: $status" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# -- 2. Crear usuario y base de datos --
Write-Host ""
Write-Host "[2/3] Configurando usuario y base de datos..." -ForegroundColor White

$env:PGPASSWORD = "postgres"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

$setupSql = @"
-- Crear usuario crm_user si no existe
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'crm_user') THEN
    CREATE USER crm_user WITH PASSWORD 'crm_dev_password';
    RAISE NOTICE 'Usuario crm_user creado';
  ELSE
    ALTER USER crm_user WITH PASSWORD 'crm_dev_password';
    RAISE NOTICE 'Contrasena de crm_user actualizada';
  END IF;
END
`$`$;
"@

# Ejecutar como postgres
$setupSql | & $psql -U postgres -h localhost -p 5434 2>&1 | Write-Host

# Crear base de datos si no existe
$dbExists = & $psql -U postgres -h localhost -p 5434 -tAc "SELECT 1 FROM pg_database WHERE datname='cargar_crm'" 2>&1
if ($dbExists -notmatch "1") {
    & $psql -U postgres -h localhost -p 5434 -c "CREATE DATABASE cargar_crm OWNER crm_user ENCODING 'UTF8' LC_COLLATE='es-CO-x-icu' LC_CTYPE='es-CO-x-icu' LOCALE_PROVIDER=icu ICU_LOCALE='es-CO' TEMPLATE=template0;" 2>&1 | Write-Host
    Write-Host "  OK - Base de datos cargar_crm creada" -ForegroundColor Green
} else {
    Write-Host "  OK - Base de datos cargar_crm ya existe" -ForegroundColor Green
}

# Dar permisos
& $psql -U postgres -h localhost -p 5434 -c "GRANT ALL PRIVILEGES ON DATABASE cargar_crm TO crm_user;" 2>&1 | Out-Null
& $psql -U postgres -h localhost -p 5434 -d cargar_crm -c "GRANT ALL ON SCHEMA public TO crm_user;" 2>&1 | Out-Null
Write-Host "  OK - Permisos asignados a crm_user" -ForegroundColor Green

# -- 3. Verificar conexion con crm_user --
Write-Host ""
Write-Host "[3/3] Verificando conexion con crm_user..." -ForegroundColor White
$env:PGPASSWORD = "crm_dev_password"
$testResult = & $psql -U crm_user -h localhost -p 5434 -d cargar_crm -c "SELECT 'Conexion exitosa' AS resultado;" 2>&1
if ($testResult -match "exitosa") {
    Write-Host "  OK - crm_user puede conectarse a cargar_crm" -ForegroundColor Green
} else {
    Write-Host "  WARN - Verificar conexion manualmente: $testResult" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Setup completado!" -ForegroundColor Green
Write-Host ""
Write-Host "  Ahora ejecuta las migraciones:" -ForegroundColor White
Write-Host "  cd C:\Users\Sistemas\CRM\crm" -ForegroundColor White
Write-Host "  npm run db:migrate" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
