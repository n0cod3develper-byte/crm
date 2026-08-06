import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { emailMarketingController as ctrl } from './email-marketing.controller.js';

const router = Router();

// ─── Rutas PÚBLICAS (sin auth) — tracking y unsubscribe ──────
// IMPORTANTE: Deben registrarse ANTES del middleware de auth
router.get('/track/open/:envio_id',    ctrl.trackOpen);
router.get('/track/click/:envio_id',   ctrl.trackClick);
router.get('/unsubscribe/:token',      ctrl.unsubscribePage);
router.post('/unsubscribe/:token',     ctrl.confirmarUnsubscribe);

// ─── Rutas protegidas ────────────────────────────────────────
router.use(requireAuth);

// Listas
router.get('/listas',                            ctrl.getListas);
router.post('/listas',                           ctrl.createLista);
router.get('/listas/:id',                        ctrl.getListaById);
router.put('/listas/:id',                        ctrl.updateLista);
router.delete('/listas/:id',                     ctrl.deleteLista);
router.get('/listas/:id/contactos',              ctrl.getContactosDeLista);
router.post('/listas/:id/contactos',             ctrl.agregarContactoALista);
router.delete('/listas/:id/contactos/:contactoId', ctrl.quitarContactoDeLista);
router.post('/listas/:id/importar',              ctrl.importarContactosEmpresa);

// Contactos
router.get('/contactos',     ctrl.getContactos);
router.post('/contactos',    ctrl.createContacto);
router.get('/contactos/:id', ctrl.getContactoById);
router.put('/contactos/:id', ctrl.updateContacto);
router.delete('/contactos/:id', ctrl.deleteContacto);

// Plantillas
router.get('/plantillas',     ctrl.getPlantillas);
router.post('/plantillas',    ctrl.createPlantilla);
router.get('/plantillas/:id', ctrl.getPlantillaById);
router.put('/plantillas/:id', ctrl.updatePlantilla);
router.delete('/plantillas/:id', ctrl.deletePlantilla);

// Campañas
router.get('/campanas',           ctrl.getCampanas);
router.post('/campanas',          ctrl.createCampana);
router.get('/campanas/:id',       ctrl.getCampanaById);
router.put('/campanas/:id',       ctrl.updateCampana);
router.delete('/campanas/:id',    ctrl.deleteCampana);
router.post('/campanas/:id/enviar',   ctrl.enviarCampana);
router.post('/campanas/:id/cancelar', ctrl.cancelarCampana);
router.get('/campanas/:id/envios',    ctrl.getEnviosDeCampana);
router.post('/campanas/:id/prueba',   ctrl.enviarPruebaDeCampana);

// Plantillas — prueba
router.post('/plantillas/:id/prueba', ctrl.enviarPruebaDePlantilla);


export default router;
