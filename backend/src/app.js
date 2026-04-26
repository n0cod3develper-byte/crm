import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';
import { createServer } from 'http';

import { env } from './config/env.js';
import { checkConnection } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { initializePassport } from './config/passport.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';
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

const app = express();
const httpServer = createServer(app);
// ─── Seguridad ───────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));
app.use(generalLimiter);

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

// Módulos adicionales — se irán agregando por sprint
app.use(`${API}/campaigns`,     campaignsRoutes);
app.use(`${API}/support`,     supportRoutes);
app.use(`${API}/employees`,   employeesRoutes);
app.use(`${API}/equipos`,     equiposRoutes);
app.use(`${API}/mantenimiento`, mantenimientoRoutes);
app.use(`${API}/proveedores`, proveedoresRoutes);
app.use(`${API}/compras`, comprasRoutes);
app.use(`${API}/documentos`, documentosRoutes);
// Atendiendo solicitud específica de ruta por empresa
app.get(`${API}/empresas/:id/equipos`, (req, res, next) => {
  req.url = `/by-company/${req.params.id}`;
  equiposRoutes(req, res, next);
});
// app.use(`${API}/automations`, automationsRoutes);
// app.use(`${API}/ai`,          aiRoutes);
// app.use(`${API}/telephony`,   telephonyRoutes);
// app.use(`${API}/reports`,     reportsRoutes);

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
