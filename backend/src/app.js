import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { createServer } from 'http';

import { env } from './config/env.js';
import { checkConnection } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { initializePassport } from './config/passport.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter, uploadLimiter } from './middleware/rateLimiter.js';
import { requireAuth } from './middleware/auth.js';
import { logger } from './utils/logger.js';

// ─── Rutas ───────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes.js';
import companiesRoutes from './modules/companies/companies.routes.js';
import contactsRoutes from './modules/contacts/contacts.routes.js';
import pipelineRoutes from './modules/pipeline/pipeline.routes.js';
import opportunitiesRoutes from './modules/opportunities/opportunities.routes.js';
import tasksRoutes from './modules/tasks/tasks.routes.js';
import quotesRoutes from './modules/quotes/quotes.routes.js';
import leadsRoutes from './modules/leads/leads.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import campaignsRoutes from './modules/campaigns/campaigns.routes.js';
import supportRoutes  from './modules/support/support.routes.js';
import employeesRoutes from './modules/employees/employees.routes.js';
import equiposRoutes from './modules/equipos/equipos.routes.js';
import mantenimientoRoutes from './modules/mantenimiento/mantenimiento.routes.js';
import proveedoresRoutes from './modules/proveedores/proveedores.routes.js';
import comprasRoutes from './modules/compras/compras.routes.js';
import documentosRoutes from './modules/documentos/documentos.routes.js';
import webhooksRoutes from './modules/webhooks/webhooks.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import backupsRoutes from './modules/admin/backups.routes.js';
import facturacionRoutes from './modules/facturacion/facturacion.routes.js';
import catalogRoutes from './modules/inventory/catalog.routes.js';
import ubicacionesRoutes from './modules/inventory/ubicaciones.routes.js';
import movementsRoutes from './modules/inventory/movements.routes.js';
import catalogoServiciosRoutes from './modules/catalogo_servicios/catalogo_servicios.routes.js';
import serviciosRoutes from './modules/servicios/servicios.routes.js';
import turnosRoutes from './modules/turnos/turnos.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import locativoRoutes from './modules/locativo/locativo.routes.js';
import mantenimientosProgramadosRoutes from './modules/mantenimientos-programados/mantenimientosProgramados.routes.js';
import { iniciarJobCierreAutomatico } from './jobs/turnosCierreAutomatico.job.js';
import { inicializarFestivos } from './services/calendarioService.js';
import { initBackupCronJob } from './services/backupService.js';

const app = express();
const httpServer = createServer(app);
// ─── Seguridad ───────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// ─── CORS: orígenes permitidos ─────────────────────────────────
const corsOrigins = (() => {
  const origins = [env.FRONTEND_URL];
  if (env.CORS_ORIGINS) {
    env.CORS_ORIGINS.split(',').forEach(o => {
      const trimmed = o.trim();
      if (trimmed && !origins.includes(trimmed)) origins.push(trimmed);
    });
  }
  return origins;
})();

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (apps, curl, etc)
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));
app.use(generalLimiter);

// ─── Cookies ─────────────────────────────────────────────────
app.use(cookieParser());

// ─── Parsers ─────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging HTTP ────────────────────────────────────────────
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ─── Passport OAuth ──────────────────────────────────────────
initializePassport();
app.use(passport.initialize());

// ─── Health check ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: env.NODE_ENV, timestamp: new Date().toISOString() });
});

// ─── API v1 ──────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/webhooks`,      webhooksRoutes);
app.use(`${API}/admin`,         adminRoutes);
app.use(`/api/backups`,         backupsRoutes); // Ruta especificada en los requerimientos
app.use(`${API}/me`,            adminRoutes); // Reutilizamos el router para /me
app.use(`${API}/auth`,          authRoutes);
app.use(`${API}/companies`,     companiesRoutes);
app.use(`${API}/contacts`,      contactsRoutes);
app.use(`${API}/pipeline`,      pipelineRoutes);
app.use(`${API}/opportunities`, opportunitiesRoutes);
app.use(`${API}/tasks`,         tasksRoutes);
app.use(`${API}/quotes`,        quotesRoutes);
app.use(`${API}/leads`,         leadsRoutes);
app.use(`${API}/inventory`,     inventoryRoutes);
app.use(`${API}/catalogo`,      catalogRoutes);
app.use(`${API}/ubicaciones`,   ubicacionesRoutes);
app.use(`${API}/movements`,     movementsRoutes);

// Módulos adicionales — se irán agregando por sprint
app.use(`${API}/campaigns`,     campaignsRoutes);
app.use(`${API}/support`,     supportRoutes);
app.use(`${API}/employees`,   employeesRoutes);
app.use(`${API}/equipos`,     equiposRoutes);
app.use(`${API}/mantenimiento`, mantenimientoRoutes);
app.use(`${API}/proveedores`, proveedoresRoutes);
app.use(`${API}/compras`, comprasRoutes);
app.use(`${API}/documentos`, documentosRoutes);
app.use(`${API}/facturacion`, facturacionRoutes);
app.use(`${API}/catalogo-servicios`, catalogoServiciosRoutes);
app.use(`${API}/servicios`, serviciosRoutes);
app.use(`${API}/turnos`,   turnosRoutes);
// ─── Archivos estáticos públicos (avatares) ───────────────────
// Los avatares se sirven sin autenticación para que <img> tags funcionen
app.use('/uploads/avatars', express.static('uploads/avatars'));

// ─── Archivos estáticos protegidos ───────────────────────────
// Los demás uploads requieren autenticación JWT (vía cookie o header)
app.use('/uploads', requireAuth, express.static('uploads'));

// Atendiendo solicitud específica de ruta por empresa
app.get(`${API}/empresas/:id/equipos`, (req, res, next) => {
  req.url = `/by-company/${req.params.id}`;
  equiposRoutes(req, res, next);
});
// app.use(`${API}/automations`, automationsRoutes);
// app.use(`${API}/ai`,          aiRoutes);
// app.use(`${API}/telephony`,   telephonyRoutes);
app.use(`${API}/inventario/locativo`, locativoRoutes);
app.use(`${API}/dashboard`,  dashboardRoutes);
app.use(`${API}/reports`,     reportsRoutes);
app.use(`${API}/mantenimientos-programados`, mantenimientosProgramadosRoutes);

// ─── 404 y manejo de errores ─────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Bootstrap ───────────────────────────────────────────────
async function bootstrap() {
  const dbOk = await checkConnection();
  if (!dbOk) {
    logger.error('No se pudo iniciar: falla de conexión a PostgreSQL');
    process.exit(1);
  }

  await connectRedis();

  // Iniciar job de cierre automático de turnos (23:59 America/Bogota)
  iniciarJobCierreAutomatico();

  // Iniciar job de backups automático (02:00 AM)
  initBackupCronJob();

  // Inicializar festivos colombianos para año actual y siguiente
  inicializarFestivos().catch((err) =>
    logger.warn('[Festivos] No se pudieron inicializar los festivos', { error: err.message })
  );

  httpServer.listen(env.PORT, () => {
    logger.info(`🚀  CARGAR CRM API iniciada`, {
      port: env.PORT,
      env: env.NODE_ENV,
      url: `http://localhost:${env.PORT}/api/v1`,
    });
  });
}

bootstrap().catch((err) => {
  logger.error('Error fatal en bootstrap', { error: err.message });
  process.exit(1);
});

export default app;
