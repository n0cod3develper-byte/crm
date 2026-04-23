# CARGAR CRM

Un CRM a medida para CARGAR SAS, empresa del sector logístico.

## Requisitos Previos
- Docker y Docker Compose
- Node.js >= 20.0
- npm >= 10.0

## Inicio Rápido (Desarrollo)

### 1. Variables de entorno
Duplicar el archivo `.env.example` como `.env`.
\`\`\`bash
cp .env.example .env
\`\`\`

### 2. Iniciar Infraestructura Base
Arrancar PostgreSQL, Redis y MinIO junto con los servicios del backend y frontend empaquetados:
\`\`\`bash
docker-compose up -d --build
\`\`\`
*(La base de datos se inicializa automáticamente en el primer arranque mediante el archivo `backend/migrations/001_initial_schema.sql`)*

### 3. Accesos
- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- **MinIO Console (S3):** [http://localhost:9001](http://localhost:9001) *(admin / minioadmin123)*

## Integraciones Clave

- **Base de Datos:** PostgreSQL
- **Caché & Colas:** Redis + BullMQ
- **Almacenamiento Archivos/Grabaciones:** S3 Compatible (MinIO en local / AWS en Prod)
- **Central Telefónica:** Asterisk vía AMI/ARI
- **AI Sugerencias:** OpenAI GPT-4o

### Asterisk (Central Telefónica)
El módulo de Asterisk está preparado pero desactivado por defecto (`ASTERISK_ENABLED=false` en el `.env`). Para usarlo, configura las credenciales de tu PBX y activa la variable.

## Comandos Útiles

**Ver logs de todos los servicios:**
\`\`\`bash
docker-compose logs -f
\`\`\`

**Reiniciar un servicio específico (ej: backend):**
\`\`\`bash
docker-compose restart backend
\`\`\`

**Reconstruir servicios si cambian las dependencias:**
\`\`\`bash
docker-compose up -d --build
\`\`\`

## Estado Actual del Desarrollo
Sprint 1 completado. El monorepo cuenta con:
- Infraestructura Docker completa.
- Base de datos modelada (Migración SQL `001_initial_schema`).
- Servicios base y sistema de autenticación OAuth integrado (Google y Microsoft).
- Frontend Vite + React montado con el Design System inicial.
- Vista de Dashboard con KPIs y Pipeline.
- Módulo de Empresas con vista de tabla parametrizada.
