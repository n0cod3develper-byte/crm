/**
 * turnos.routes.js
 * Router Express del módulo de Control de Turnos.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as ctrl from './turnos.controller.js';

const router = Router();
router.use(authenticate);

// ─── Turno del técnico autenticado ──────────────────────────
// GET  /api/v1/turnos/activo
router.get('/activo', ctrl.getTurnoActivo);

// ─── Supervisor: listado y resumen ──────────────────────────
// GET  /api/v1/turnos
router.get('/', ctrl.listarTurnos);

// GET  /api/v1/turnos/resumen-semana
router.get('/resumen-semana', ctrl.resumenSemana);

// PATCH /api/v1/turnos/:id/aprobar-extras
router.patch('/:id/aprobar-extras', ctrl.aprobarExtras);

// POST  /api/v1/turnos/:id/cerrar
router.post('/:id/cerrar', ctrl.cerrarTurno);

// ─── Servicios (salidas a campo) ─────────────────────────────
// GET  /api/v1/turnos/servicios/ots-disponibles
router.get('/servicios/ots-disponibles', ctrl.getOTsDisponibles);

// POST /api/v1/turnos/servicios/iniciar
router.post('/servicios/iniciar', ctrl.iniciarServicio);

// PATCH /api/v1/turnos/servicios/:id/inicio-servicio
router.patch('/servicios/:id/inicio-servicio', ctrl.registrarInicioServicio);

// PATCH /api/v1/turnos/servicios/:id/fin-servicio
router.patch('/servicios/:id/fin-servicio', ctrl.registrarFinServicio);

// PATCH /api/v1/turnos/servicios/:id/ingreso-cargar
router.patch('/servicios/:id/ingreso-cargar', ctrl.registrarIngresoCargar);

// ─── Festivos colombianos ────────────────────────────────────
// GET  /api/v1/turnos/festivos/:anio
router.get('/festivos/:anio', ctrl.listarFestivos);

// POST /api/v1/admin/festivos
router.post('/admin/festivos', ctrl.crearFestivo);

// DELETE /api/v1/admin/festivos/:id
router.delete('/admin/festivos/:id', ctrl.eliminarFestivo);

// ─── Reabrir turno ──────────────────────────────────────────
// PATCH /api/v1/turnos/:id/reabrir
router.patch('/:id/reabrir', ctrl.reabrirTurno);

// ─── Desglose de recargos CST ────────────────────────────────
// GET  /api/v1/turnos/:id/desglose-recargos
router.get('/:id/desglose-recargos', ctrl.getDesgloseRecargos);

export default router;
