#!/bin/bash
# ============================================================
# deploy.sh — Script de despliegue para CARGAR CRM
# Uso: ./deploy.sh [frontend|backend|all]
# Ejemplo: ./deploy.sh all
# ============================================================

set -e  # Detener si cualquier comando falla

# ── Configuración ────────────────────────────────────────────
SERVER="root@app0code.cloud"
FRONTEND_LOCAL="./frontend"
BACKEND_LOCAL="./backend"
FRONTEND_REMOTE="/var/www/crm/frontend"
BACKEND_REMOTE="/var/www/crm/backend"
PM2_APP="crm-backend"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sin color

log()     { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Funciones ────────────────────────────────────────────────

deploy_frontend() {
    log "Iniciando despliegue del FRONTEND..."

    # Guardar ruta raíz del proyecto
    PROJECT_ROOT=$(pwd)

    [ -d "$FRONTEND_LOCAL" ] || error "No se encontró la carpeta: $FRONTEND_LOCAL"
    [ -f "$FRONTEND_LOCAL/.env.production" ] || error "No se encontró .env.production en el frontend"

    log "Instalando dependencias..."
    cd "$PROJECT_ROOT/$FRONTEND_LOCAL"
    npm run build

    log "Generando build de producción..."
    npm run build

    [ -d "dist" ] || error "El build falló — no se generó la carpeta dist/"

    if grep -r "app0code.cloud" dist/assets/ > /dev/null 2>&1; then
        success "URL de producción verificada en el bundle"
    else
        warn "No se encontró app0code.cloud en el bundle — revisa .env.production"
    fi

    log "Limpiando frontend anterior en el servidor..."
    ssh "$SERVER" "rm -rf ${FRONTEND_REMOTE}/*"

    log "Subiendo nuevo build al servidor..."
    scp -r dist/* "${SERVER}:${FRONTEND_REMOTE}/"

    ssh "$SERVER" "chmod -R 755 ${FRONTEND_REMOTE}/ && chown -R www-data:www-data ${FRONTEND_REMOTE}/"

    cd "$PROJECT_ROOT"
    success "Frontend desplegado correctamente"
}

deploy_backend() {
    log "Iniciando despliegue del BACKEND..."

    # Verificar que existe el directorio
    [ -d "$BACKEND_LOCAL" ] || error "No se encontró la carpeta: $BACKEND_LOCAL"

    # Subir archivos del backend (excluyendo node_modules y .env)
    log "Subiendo archivos del backend..."
    scp -r "${BACKEND_LOCAL}/src" "${SERVER}:${BACKEND_REMOTE}/"
    scp -r "${BACKEND_LOCAL}/migrations" "${SERVER}:${BACKEND_REMOTE}/"
    scp "${BACKEND_LOCAL}/package.json" "${SERVER}:${BACKEND_REMOTE}/"
    scp "${BACKEND_LOCAL}/package-lock.json" "${SERVER}:${BACKEND_REMOTE}/" 2>/dev/null || true

    # Instalar dependencias en el servidor
    log "Instalando dependencias en el servidor..."
    ssh "$SERVER" "cd ${BACKEND_REMOTE} && npm install --omit=dev"

    # Ejecutar migraciones
    log "Ejecutando migraciones en el servidor..."
    ssh "$SERVER" "cd ${BACKEND_REMOTE} && node migrations/runner.js"

    # Reiniciar con PM2
    log "Reiniciando el servicio con PM2..."
    ssh "$SERVER" "pm2 restart ${PM2_APP} --update-env && pm2 save"

    # Esperar 3 segundos y verificar que arrancó
    sleep 10
    STATUS=$(ssh "$SERVER" "pm2 jlist" | python3 -c "
import sys, json
procs = json.load(sys.stdin)
for p in procs:
    if p['name'] == '${PM2_APP}':
        print(p['pm2_env']['status'])
" 2>/dev/null || echo "unknown")

    if [ "$STATUS" = "online" ]; then
        success "Backend corriendo correctamente (status: online)"
    else
        error "El backend no arrancó correctamente. Revisa: pm2 logs ${PM2_APP}"
    fi

    success "Backend desplegado correctamente"
}

reload_nginx() {
    log "Recargando Nginx..."
    ssh "$SERVER" "nginx -t && systemctl reload nginx"
    success "Nginx recargado"
}

# ── Main ─────────────────────────────────────────────────────

OPTION="${1:-all}"

echo ""
echo "============================================"
echo "   CARGAR CRM — Despliegue a Producción"
echo "   Servidor: $SERVER"
echo "   Opción:   $OPTION"
echo "============================================"
echo ""

case "$OPTION" in
    frontend)
        reload_nginx
        ;;
    backend)
        deploy_backend
        ;;
    all)
        deploy_backend
        reload_nginx
        ;;
    *)
        echo "Uso: ./deploy.sh [frontend|backend|all]"
        exit 1
        ;;
esac

echo ""
echo "============================================"
success "Despliegue completado — https://app0code.cloud/crm"
echo "============================================"
echo ""
