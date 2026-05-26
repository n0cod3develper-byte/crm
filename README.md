# CARGAR CRM

Un CRM a medida para CARGAR SAS, empresa del sector logístico.

## Requisitos Previos

- Node.js >= 20.0
- npm >= 10.0
- PostgreSQL 16+ (corriendo localmente)
- Redis 7+ (corriendo localmente)
- MinIO o almacenamiento S3 compatible (opcional para desarrollo local)

## Inicio Rápido (Desarrollo)

### 1. Variables de entorno

Duplicar el archivo `.env.example` como `.env` dentro de `backend/`:
```bash
cp backend/.env.example backend/.env
```

### 2. Base de datos

Asegúrate de tener PostgreSQL corriendo en `localhost:5432` y ejecuta las migraciones:

```bash
cd backend
node migrations/runner.js
```

### 3. Iniciar servicios

**Backend** (terminal 1):
```bash
cd backend
npm run dev
```

**Frontend** (terminal 2):
```bash
cd frontend
npm run dev
```

O usa el script de inicio (abre ambas terminales automáticamente):
```powershell
.\dev-start.ps1
```

### 4. Accesos

- **Frontend App:** [http://localhost:3001](http://localhost:3001)
- **Backend API:** [http://localhost:4000/api/v1](http://localhost:4000/api/v1)

## Integraciones Clave

- **Base de Datos:** PostgreSQL
- **Caché & Colas:** Redis + BullMQ
- **Almacenamiento Archivos/Grabaciones:** S3 Compatible (MinIO en local / AWS en Prod)
- **Central Telefónica:** Asterisk vía AMI/ARI
- **AI Sugerencias:** OpenAI GPT-4o

### Asterisk (Central Telefónica)

El módulo de Asterisk está preparado pero desactivado por defecto (`ASTERISK_ENABLED=false` en el `.env`). Para usarlo, configura las credenciales de tu PBX y activa la variable.

## Estado Actual del Desarrollo

Sprint 1 completado. El monorepo cuenta con:
- Base de datos modelada (Migraciones SQL secuenciales).
- Servicios base y sistema de autenticación OAuth integrado (Google y Microsoft).
- Frontend Vite + React montado con el Design System inicial.
- Vista de Dashboard con KPIs y Pipeline.
- Módulo de Empresas con vista de tabla parametrizada.
