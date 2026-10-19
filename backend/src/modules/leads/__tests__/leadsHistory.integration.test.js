import 'dotenv/config';
import { jest } from '@jest/globals';

/**
 * Pruebas de INTEGRACIÓN del historial de Leads contra PostgreSQL real.
 *
 * Se requiere base de datos: estas pruebas verifican garantías que un mock no
 * puede demostrar (atomicidad, rollback y orden real de la línea de tiempo).
 * Se ejecutan SOLO si la base conectada es de prueba.
 */

const modulo = await import('../../../config/database.js');
const db = modulo.db;

// ── Guarda anti-producción: no se escribe nunca en una base que no sea de prueba
let disponible = false;
let nombreBase = '';
try {
  const r = await db.query(`SELECT current_database() AS db`);
  nombreBase = r.rows[0].db;
  disponible = /(prueba|test|dev|local|sandbox|tmp)/i.test(nombreBase);
} catch {
  disponible = false;
}

if (!disponible) {
  const motivo = nombreBase
    ? `la base "${nombreBase}" no parece ser de prueba`
    : 'no hay conexión a la base de datos';
  console.warn(`\n⚠️  Suite de integración de lead_history OMITIDA: ${motivo}.\n`);
}

const cond = disponible ? describe : describe.skip;

const {
  LeadsRepository,
} = await import('../leads.repository.js');
const {
  LeadsHistoryRepository,
  diffLead,
} = await import('../leadsHistory.repository.js');
const {
  LeadGestionesRepository,
} = await import('../leadGestiones.repository.js');

const repo = new LeadsRepository();
const hist = new LeadsHistoryRepository();
const gestiones = new LeadGestionesRepository();

const CTX = { userId: '00000000-0000-0000-0000-000000000042', userName: 'Tester Historial' };
const creados = [];
const creadosContactos = [];

async function crearLead(extra = {}) {
  const { lead } = await repo.createConHistorial(
    { first_name: 'Lead', last_name: 'Prueba', status: 'new', ...extra },
    CTX
  );
  creados.push(lead.id);
  return lead;
}

/** Empleados activos, para asignarlos a gestiones y a la asignación. */
async function empleadosActivos(n) {
  const r = await db.query(
    `SELECT id, full_name FROM employees WHERE status = 'Activo' ORDER BY id LIMIT ${n}`
  );
  return r.rows;
}

afterEach(async () => {
  while (creados.length) {
    const id = creados.pop();
    // Desde la migración 140 la FK de lead_history es RESTRICT: la trazabilidad
    // NO se puede destruir borrando el lead. Estas filas son de PRUEBAS, así que
    // se retira su historial de forma explícita y acotada antes de purgarlas.
    // Sin `catch` silencioso: un fallo aquí debe salir a la superficie.
    await db.query(`DELETE FROM lead_gestiones WHERE lead_id = $1`, [id]);
    await db.query(`DELETE FROM lead_history WHERE lead_id = $1`, [id]);
    await db.query(`DELETE FROM lead_asignacion_notificaciones WHERE lead_id = $1`, [id]);
    await db.query(`DELETE FROM leads WHERE id = $1`, [id]);
  }
  // Los contactos creados por la conversión se retiran DESPUÉS del lead,
  // porque leads.converted_contact_id apunta a ellos.
  while (creadosContactos.length) {
    const id = creadosContactos.pop();
    await db.query(`DELETE FROM contacts WHERE id = $1`, [id]);
  }
});

// ─────────────────────────────────────────────────────────────────────
cond('Historial de Leads (integración con PostgreSQL)', () => {

  test('1. La creación registra el evento CREACION con el usuario autenticado', async () => {
    const lead = await crearLead();
    const { data } = await hist.findEvents({ leadId: lead.id });

    expect(data).toHaveLength(1);
    expect(data[0].tipo).toBe('CREACION');
    expect(data[0].usuario).toBe('Tester Historial');
    expect(data[0].valorNuevo).toBe('new');
  });

  test('2. La primera asignación registra un evento ASIGNACION con el empleado', async () => {
    // Se toma un empleado activo real de la base de pruebas
    const emp = await db.query(`SELECT id, full_name FROM employees WHERE status = 'Activo' LIMIT 1`);
    if (!emp.rows.length) {
      console.warn('   (sin empleados activos: prueba de asignación omitida)');
      return;
    }
    const empleado = emp.rows[0];

    const lead = await crearLead();
    await repo.updateConHistorial(lead.id, { assigned_employee_id: empleado.id }, CTX);

    const { data } = await hist.findEvents({ leadId: lead.id, eventType: 'ASIGNACION' });
    expect(data).toHaveLength(1);
    expect(data[0].valorNuevo).toBe(empleado.full_name);
    expect(data[0].descripcion).toMatch(/Asignado a/);
  });

  test('4. El cambio de estado genera CAMBIO_ESTADO con valor anterior y nuevo', async () => {
    const lead = await crearLead();
    await repo.updateConHistorial(lead.id, { status: 'contacted' }, CTX);

    const { data } = await hist.findEvents({ leadId: lead.id, eventType: 'CAMBIO_ESTADO' });
    expect(data).toHaveLength(1);
    expect(data[0].valorAnterior).toBe('new');
    expect(data[0].valorNuevo).toBe('contacted');
    expect(data[0].usuario).toBe('Tester Historial');
  });

  test('5. Modificar varios campos genera un evento por campo y el estado va aparte', async () => {
    const lead = await crearLead();
    await repo.updateConHistorial(
      lead.id,
      { phone: '3001112233', notes: 'nueva descripcion', company_name: 'Otra SAS', status: 'qualified' },
      CTX
    );

    const { data } = await hist.findEvents({ leadId: lead.id, limit: 50 });
    const modificaciones = data.filter((e) => e.tipo === 'MODIFICACION').map((e) => e.campo).sort();
    expect(modificaciones).toEqual(['company_name', 'notes', 'phone']);

    const estado = data.find((e) => e.tipo === 'CAMBIO_ESTADO');
    expect(estado).toBeTruthy();
    expect(estado.valorAnterior).toBe('new');
    expect(estado.valorNuevo).toBe('qualified');
  });

  test('6. Guardar sin cambios reales NO genera eventos', async () => {
    const lead = await crearLead({ phone: '3001112233', notes: 'igual' });
    const antes = (await hist.findEvents({ leadId: lead.id, limit: 100 })).data.length;

    // Reenviar exactamente los mismos valores
    const r = await repo.updateConHistorial(
      lead.id, { phone: '3001112233', notes: 'igual', status: 'new' }, CTX
    );
    expect(r.cambios).toHaveLength(0);

    const despues = (await hist.findEvents({ leadId: lead.id, limit: 100 })).data.length;
    expect(despues).toBe(antes);
  });

  test('5b. El estado terminal dead genera además el evento CIERRE', async () => {
    const lead = await crearLead();
    await repo.updateConHistorial(lead.id, { status: 'dead' }, CTX);

    const { data } = await hist.findEvents({ leadId: lead.id, eventType: 'CIERRE' });
    expect(data).toHaveLength(1);
    expect(data[0].valorNuevo).toBe('dead');
  });

  test('7. El nombre del empleado queda guardado de forma histórica', async () => {
    // El nombre se persiste denormalizado en el evento, de modo que el historial
    // sigue siendo comprensible aunque el empleado se desactive o se elimine.
    const emp = await db.query(`SELECT id, full_name FROM employees WHERE status = 'Activo' LIMIT 1`);
    if (!emp.rows.length) {
      console.warn('   (sin empleados activos: prueba de nombre histórico omitida)');
      return;
    }

    const lead = await crearLead();
    await repo.updateConHistorial(lead.id, { assigned_employee_id: emp.rows[0].id }, CTX);

    const { data } = await hist.findEvents({ leadId: lead.id, eventType: 'ASIGNACION' });
    expect(data).toHaveLength(1);
    expect(data[0].empleado).toBe(emp.rows[0].full_name);
  });

  test('8. La línea de tiempo ordena de más reciente a más antigua', async () => {
    const lead = await crearLead();
    await repo.updateConHistorial(lead.id, { phone: '111' }, CTX);
    await repo.updateConHistorial(lead.id, { phone: '222' }, CTX);
    await repo.updateConHistorial(lead.id, { status: 'contacted' }, CTX);

    const { data } = await hist.findEvents({ leadId: lead.id, limit: 50 });
    expect(data.length).toBeGreaterThanOrEqual(4);

    for (let i = 1; i < data.length; i++) {
      const anterior = new Date(data[i - 1].fecha);
      const posterior = new Date(data[i].fecha);
      expect(anterior.getTime()).toBeGreaterThanOrEqual(posterior.getTime());
    }
    // El primer evento debe ser el cambio más reciente
    expect(data[0].tipo).toBe('CAMBIO_ESTADO');
    expect(data[0].valorNuevo).toBe('contacted');
  });

  test('10. Dos actualizaciones concurrentes no pierden eventos', async () => {
    const lead = await crearLead();

    await Promise.all([
      repo.updateConHistorial(lead.id, { phone: 'CONCURRENTE-A' }, CTX),
      repo.updateConHistorial(lead.id, { notes: 'CONCURRENTE-B' }, CTX),
    ]);

    const { data } = await hist.findEvents({ leadId: lead.id, limit: 100 });
    const campos = data.filter((e) => e.tipo === 'MODIFICACION').map((e) => e.campo);
    expect(campos).toContain('phone');
    expect(campos).toContain('notes');

    // Ambos valores quedaron escritos en el lead (ninguna escritura se perdió)
    const tras = await repo.findById(lead.id);
    expect(tras.phone).toBe('CONCURRENTE-A');
    expect(tras.notes).toBe('CONCURRENTE-B');
  });

  test('11. Si la auditoría FALLA, la modificación del lead se revierte', async () => {
    const lead = await crearLead({ phone: '3000000000' });

    // Se instala un trigger que simula un fallo de escritura en la auditoría
    await db.query(`
      CREATE OR REPLACE FUNCTION _falla_auditoria() RETURNS trigger AS $fn$
      BEGIN RAISE EXCEPTION 'Fallo simulado de auditoria'; END;
      $fn$ LANGUAGE plpgsql;
      CREATE TRIGGER _trg_falla_auditoria BEFORE INSERT ON lead_history
      FOR EACH ROW EXECUTE FUNCTION _falla_auditoria();
    `);

    try {
      await expect(
        repo.updateConHistorial(lead.id, { phone: '3099999999', status: 'contacted' }, CTX)
      ).rejects.toThrow(/auditoria/i);

      // La modificación NO debe haber quedado a medias
      const trasError = await repo.findById(lead.id);
      expect(trasError.phone).toBe('3000000000');
      expect(trasError.status).toBe('new');

      // Tampoco debe quedar ningún evento huérfano
      const { data } = await hist.findEvents({ leadId: lead.id, limit: 100 });
      expect(data.filter((e) => e.tipo !== 'CREACION')).toHaveLength(0);
    } finally {
      await db.query(`DROP TRIGGER IF EXISTS _trg_falla_auditoria ON lead_history`);
      await db.query(`DROP FUNCTION IF EXISTS _falla_auditoria()`);
    }
  });

  test('12. Un lead antiguo sin historial devuelve lista vacía, no errores', async () => {
    // Se inserta un lead directamente en SQL, como si viniera de antes de la auditoría
    const r = await db.query(
      `INSERT INTO leads (first_name, status) VALUES ('Antiguo', 'new') RETURNING id`
    );
    creados.push(r.rows[0].id);

    const { data, pagination } = await hist.findEvents({ leadId: r.rows[0].id });
    expect(data).toHaveLength(0);
    expect(pagination.hasMore).toBe(false);

    // El resumen sí responde, y distingue que no hay historial
    const resumen = await hist.findSummary(r.rows[0].id);
    expect(resumen).toBeTruthy();
    expect(resumen.total_eventos).toBe(0);
    expect(resumen.fecha_creacion).toBeTruthy();
  });

  test('El filtro por rango de fechas acota los eventos', async () => {
    const lead = await crearLead();
    await repo.updateConHistorial(lead.id, { phone: '999' }, CTX);

    const futuro = new Date(Date.now() + 86400000).toISOString();
    const { data } = await hist.findEvents({ leadId: lead.id, desde: futuro });
    expect(data).toHaveLength(0);

    const pasado = new Date(Date.now() - 86400000).toISOString();
    const { data: conPasado } = await hist.findEvents({ leadId: lead.id, desde: pasado });
    expect(conPasado.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
cond('diffLead', () => {

  test('no reporta cambios cuando los valores son equivalentes', () => {
    const antes = { first_name: 'Ana', email: '', phone: null, notes: 'x' };
    const despues = { first_name: 'Ana', email: null, phone: '', notes: 'x' };
    expect(diffLead(antes, despues)).toHaveLength(0);
  });

  test('reporta únicamente los campos que cambiaron', () => {
    const antes = { first_name: 'Ana', phone: '111' };
    const despues = { first_name: 'Ana', phone: '222', email: 'nuevo@x.com' };
    const eventos = diffLead(antes, despues);
    expect(eventos.map((e) => e.fieldName).sort()).toEqual(['email', 'phone']);
    expect(eventos.find((e) => e.fieldName === 'phone')).toMatchObject({
      oldValue: '111', newValue: '222',
    });
  });

  test('el estado y la asignación los trata aparte el repositorio, no el diff', () => {
    const antes = { status: 'new' };
    const despues = { status: 'contacted' };
    expect(diffLead(antes, despues).map((e) => e.fieldName)).toEqual(['status']);
  });
});

// ─────────────────────────────────────────────────────────────
// Integración Fase 2 (asignación + notificación) con Fase 3 (historial)
// ─────────────────────────────────────────────────────────────
cond('Integración Fase 2 + Fase 3', () => {

  test('I1. Crear un lead CON empleado asignado genera CREACION y ASIGNACION', async () => {
    const [emp] = await empleadosActivos(1);
    if (!emp) return console.warn('   (sin empleados activos: prueba I1 omitida)');

    const { lead, eventoAsignacionId } = await repo.createConHistorial(
      { first_name: 'Asignado', status: 'new', assigned_employee_id: emp.id },
      CTX
    );
    creados.push(lead.id);

    expect(eventoAsignacionId).toBeTruthy();

    const { data } = await hist.findEvents({ leadId: lead.id, limit: 50 });
    const tipos = data.map((e) => e.tipo);
    expect(tipos).toContain('CREACION');
    expect(tipos).toContain('ASIGNACION');

    const asig = data.find((e) => e.tipo === 'ASIGNACION');
    expect(asig.valorAnterior).toBeNull();
    expect(asig.valorNuevo).toBe(emp.full_name);
    expect(asig.empleado).toBe(emp.full_name);
    expect(asig.usuario).toBe('Tester Historial');
  });

  test('I2. Reasignar registra el empleado ANTERIOR y el NUEVO', async () => {
    const emps = await empleadosActivos(2);
    if (emps.length < 2) return console.warn('   (menos de 2 empleados activos: prueba I2 omitida)');
    const [a, b] = emps;

    const lead = await crearLead({ assigned_employee_id: a.id });
    await repo.updateConHistorial(lead.id, { assigned_employee_id: b.id }, CTX);

    const { data } = await hist.findEvents({ leadId: lead.id, eventType: 'ASIGNACION' });
    // DOS eventos: la asignación inicial al crear el lead + la reasignación
    expect(data).toHaveLength(2);

    // El más reciente es la reasignación: conserva ANTERIOR y NUEVO
    expect(data[0].valorAnterior).toBe(a.full_name);
    expect(data[0].valorNuevo).toBe(b.full_name);
    expect(data[0].descripcion).toContain('Reasignado de');
    expect(data[0].usuario).toBe('Tester Historial');

    // Y el inicial queda intacto al pie
    expect(data[1].valorAnterior).toBeNull();
    expect(data[1].valorNuevo).toBe(a.full_name);
    expect(data[1].descripcion).toContain('al crear el lead');
  });

  test('I3. Reasignar DOS veces conserva el historial completo, sin sobrescribir', async () => {
    const emps = await empleadosActivos(3);
    if (emps.length < 3) return console.warn('   (menos de 3 empleados activos: prueba I3 omitida)');

    const lead = await crearLead({ assigned_employee_id: emps[0].id });
    await repo.updateConHistorial(lead.id, { assigned_employee_id: emps[1].id }, CTX);
    await repo.updateConHistorial(lead.id, { assigned_employee_id: emps[2].id }, CTX);

    const { data } = await hist.findEvents({ leadId: lead.id, eventType: 'ASIGNACION' });
    // TRES eventos: asignación inicial + dos reasignaciones, sin sobrescribir nada
    expect(data).toHaveLength(3);

    // Cada eslabón enlaza con el anterior: emps[0] -> emps[1] -> emps[2]
    expect(data[0].valorAnterior).toBe(emps[1].full_name);
    expect(data[0].valorNuevo).toBe(emps[2].full_name);
    expect(data[1].valorAnterior).toBe(emps[0].full_name);
    expect(data[1].valorNuevo).toBe(emps[1].full_name);
    expect(data[2].valorAnterior).toBeNull();
    expect(data[2].valorNuevo).toBe(emps[0].full_name);
  });

  test('I7. La conversión a contacto registra CAMBIO_ESTADO y CIERRE', async () => {
    const lead = await crearLead({ status: 'qualified' });   // sin empresa: solo crea contacto
    const r = await repo.convertToContact(lead.id, CTX);
    expect(r.contact).toBeTruthy();
    creadosContactos.push(r.contact.id);

    const { data } = await hist.findEvents({ leadId: lead.id, limit: 50 });
    const tipos = data.map((e) => e.tipo);
    expect(tipos).toContain('CAMBIO_ESTADO');
    expect(tipos).toContain('CIERRE');

    const cierre = data.find((e) => e.tipo === 'CIERRE');
    expect(cierre.valorNuevo).toBe('converted');
    expect(cierre.metadata?.contacto_id).toBe(r.contact.id);
  });

  // Punto 4 del encargo: la última gestión NO puede ser "cualquier modificación"
  test('I4. La última gestión comercial es NULL pese a haber modificaciones', async () => {
    const lead = await crearLead();
    await repo.updateConHistorial(
      lead.id, { phone: '3001112233', status: 'contacted' }, CTX
    );

    const resumen = await hist.findSummary(lead.id);

    expect(resumen.total_eventos).toBeGreaterThan(1);   // sí hubo actividad registrada
    expect(resumen.ultima_modificacion).toBeTruthy();   // la última modificación sí cambia
    expect(resumen.ultima_gestion).toBeNull();          // pero NO es gestión comercial
  });
});

// ─────────────────────────────────────────────────────────────
// Conservación permanente de la trazabilidad (migración 140)
// ─────────────────────────────────────────────────────────────
cond('Archivado lógico y trazabilidad permanente', () => {

  test('A1. Archivar conserva el lead, lo retira del listado y añade su evento', async () => {
    const lead = await crearLead();
    await repo.updateConHistorial(lead.id, { phone: '3000000001' }, CTX);
    const antes = (await hist.findEvents({ leadId: lead.id, limit: 50 })).data;
    expect(antes.length).toBeGreaterThan(1);

    const archivado = await repo.delete(lead.id, CTX);
    expect(archivado.id).toBe(lead.id);

    // Ya NO aparece en el listado de leads activos
    const lista = await repo.findAll({ limit: 300 });
    expect(lista.data.some((l) => l.id === lead.id)).toBe(false);

    // PERO el lead sigue existiendo y es legible
    const visible = await repo.findByIdIncluyendoArchivado(lead.id);
    expect(visible).toBeTruthy();
    expect(visible.deleted_at).toBeTruthy();
    expect(visible.phone).toBe('3000000001');

    // Y su historial está íntegro, con el evento de archivado
    const despues = (await hist.findEvents({ leadId: lead.id, limit: 50 })).data;
    expect(despues).toHaveLength(antes.length + 1);

    const ev = despues.find((e) => e.campo === 'deleted_at');
    expect(ev).toBeTruthy();
    expect(ev.tipo).toBe('MODIFICACION');
    expect(ev.etiquetaCampo).toBe('Archivado');
    expect(ev.usuario).toBe('Tester Historial');
    expect(ev.valorNuevo).toBeTruthy();
  });

  test('A2. El historial de un lead ARCHIVADO sigue siendo consultable', async () => {
    const lead = await crearLead();
    await repo.delete(lead.id, CTX);

    const { data, pagination } = await hist.findEvents({ leadId: lead.id, limit: 50 });
    expect(data.length).toBeGreaterThan(0);
    expect(pagination.hasMore).toBe(false);

    const resumen = await hist.findSummary(lead.id);
    expect(resumen).toBeTruthy();
    expect(resumen.archivado_en).toBeTruthy();
    expect(resumen.total_eventos).toBeGreaterThan(0);
  });

  test('A3. Un lead archivado NO se puede editar ni archivar otra vez', async () => {
    const lead = await crearLead();
    await repo.delete(lead.id, CTX);

    // findById (rutas de escritura) lo trata como inexistente
    expect(await repo.findById(lead.id)).toBeNull();
    expect(await repo.updateConHistorial(lead.id, { phone: '3009999999' }, CTX)).toBeNull();

    // Segundo archivado: 404, no hay doble evento
    expect(await repo.delete(lead.id, CTX)).toBeNull();
    const { data } = await hist.findEvents({ leadId: lead.id, eventType: 'MODIFICACION' });
    expect(data.filter((e) => e.campo === 'deleted_at')).toHaveLength(1);
  });

  // Garantía central del punto 1 del encargo: la trazabilidad no se destruye
  test('A4. El borrado FÍSICO de un lead con historial queda BLOQUEADO', async () => {
    const lead = await crearLead();

    await expect(db.query(`DELETE FROM leads WHERE id = $1`, [lead.id]))
      .rejects.toThrow(/violates foreign key|lead_history/i);

    const tras = await db.query(`SELECT COUNT(*)::int AS n FROM leads WHERE id = $1`, [lead.id]);
    expect(tras.rows[0].n).toBe(1);

    // Y el historial sigue ahí
    const { data } = await hist.findEvents({ leadId: lead.id });
    expect(data.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Gestiones comerciales (tabla lead_gestiones, migración 141)
// ─────────────────────────────────────────────────────────────
cond('Gestiones comerciales', () => {

  test('G1. Registrar una gestión la asocia al lead y entra a la línea de tiempo', async () => {
    const [emp] = await empleadosActivos(1);
    const lead = await crearLead();

    const g = await gestiones.create(lead.id, {
      tipo: 'llamada',
      observaciones: 'Hablé con el dueño, le interesa el plan anual',
      resultado: 'Pidió cotización',
      employee_id: emp?.id,
      employee_name: emp?.full_name,
    }, CTX);

    expect(g.tipo).toBe('llamada');
    expect(g.etiquetaTipo).toBe('Llamada');
    expect(g.empleado).toBe(emp?.full_name || null);
    expect(g.creadoPor).toBe('Tester Historial');

    // Aparece en la línea de tiempo como ACTIVIDAD, no como evento de auditoría
    const { data } = await hist.findEvents({ leadId: lead.id, limit: 50 });
    const act = data.find((e) => e.tipo === 'ACTIVIDAD');
    expect(act).toBeTruthy();
    expect(act.fuente).toBe('ACTIVIDAD');
    expect(act.empleado).toBe(emp?.full_name || null);
    expect(act.usuario).toBe('Tester Historial');
    expect(act.descripcion).toContain('Llamada');
    expect(act.descripcion).toContain('le interesa el plan anual');
    expect(act.valorNuevo).toBe('Pidió cotización');
  });

  // Punto 2 del encargo: la última gestión SOLO de actividades reales
  test('G2. La última gestión comercial ignora las modificaciones del lead', async () => {
    const lead = await crearLead();

    // Modificaciones que NO son gestión comercial
    await repo.updateConHistorial(
      lead.id, { phone: '3001234567', status: 'contacted', score: 60 }, CTX
    );

    let r = await hist.findSummary(lead.id);
    expect(r.total_eventos).toBeGreaterThan(1);   // sí hubo actividad registrada
    expect(r.ultima_gestion).toBeNull();          // pero NINGUNA gestión comercial
    expect(r.total_gestiones).toBe(0);

    // Al registrar una gestión real, sí se llena
    await gestiones.create(lead.id, { tipo: 'correo', resultado: 'Enviada' }, CTX);

    r = await hist.findSummary(lead.id);
    expect(r.total_gestiones).toBe(1);
    expect(r.ultima_gestion).toBeTruthy();
    // total_eventos suma auditoría + gestiones
    expect(r.total_eventos).toBeGreaterThan(1);
  });

  test('G3. La fecha de la gestión es la de OCURRENCIA, no la de registro', async () => {
    const lead = await crearLead();
    const ocurrioHaceUnaSemana = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    await gestiones.create(lead.id, {
      tipo: 'reunion',
      fecha_gestion: ocurrioHaceUnaSemana,
    }, CTX);

    const r = await hist.findSummary(lead.id);
    const diferenciaMs = Math.abs(new Date(r.ultima_gestion) - ocurrioHaceUnaSemana);
    // Tolerancia de 2 s por la serialización
    expect(diferenciaMs).toBeLessThan(2000);
  });

  test('G4. Filtros por tipo y rango de fechas sobre las gestiones', async () => {
    const lead = await crearLead();
    await gestiones.create(lead.id, { tipo: 'llamada' }, CTX);
    await gestiones.create(lead.id, { tipo: 'reunion' }, CTX);
    await gestiones.create(lead.id, { tipo: 'llamada', fecha_gestion: new Date('2026-01-15T12:00:00Z') }, CTX);

    const porTipo = await gestiones.findByLead(lead.id, { tipo: 'llamada' });
    expect(porTipo.data).toHaveLength(2);
    expect(porTipo.data.every((g) => g.tipo === 'llamada')).toBe(true);

    const porFecha = await gestiones.findByLead(lead.id, {
      desde: new Date('2026-01-01T00:00:00Z'),
      hasta: new Date('2026-02-01T00:00:00Z'),
    });
    expect(porFecha.data).toHaveLength(1);
    expect(porFecha.data[0].tipo).toBe('llamada');

    // Paginación con cursor
    const paginada = await gestiones.findByLead(lead.id, { limit: 2 });
    expect(paginada.data).toHaveLength(2);
    expect(paginada.pagination.hasMore).toBe(true);
    expect(paginada.pagination.nextCursor).toBeTruthy();
  });

  test('G5. Las gestiones NO se destruyen al archivar el lead', async () => {
    const lead = await crearLead();
    await gestiones.create(lead.id, { tipo: 'llamada', resultado: 'Hecha' }, CTX);
    await repo.delete(lead.id, CTX);

    // Siguen consultables aunque el lead esté archivado
    const lista = await gestiones.findByLead(lead.id);
    expect(lista.data).toHaveLength(1);
    expect(lista.data[0].resultado).toBe('Hecha');

    const r = await hist.findSummary(lead.id);
    expect(r.total_gestiones).toBe(1);
    expect(r.ultima_gestion).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// Restauración de leads archivados
// ─────────────────────────────────────────────────────────────
cond('Restauración de leads archivados', () => {

  test('R1. Restaurar registra RESTAURACION y devuelve el lead al listado', async () => {
    const lead = await crearLead();
    await repo.delete(lead.id, CTX);
    expect((await repo.findAll({ limit: 300 })).data.some((l) => l.id === lead.id)).toBe(false);

    const restaurado = await repo.restaurar(lead.id, CTX);
    expect(restaurado.id).toBe(lead.id);
    expect(restaurado.deleted_at).toBeNull();
    expect(restaurado.deleted_by).toBeNull();

    // Vuelve a aparecer en el listado activo
    const activos = await repo.findAll({ limit: 300 });
    expect(activos.data.some((l) => l.id === lead.id)).toBe(true);

    // Y sale de la vista de archivados
    const archivados = await repo.findAll({ limit: 300, archivados: true });
    expect(archivados.data.some((l) => l.id === lead.id)).toBe(false);

    const { data } = await hist.findEvents({ leadId: lead.id, eventType: 'RESTAURACION' });
    expect(data).toHaveLength(1);
    expect(data[0].usuario).toBe('Tester Historial');
  });

  // Validación explícita del punto 4 del encargo
  test('R2. El lead restaurado conserva estado y responsable previos', async () => {
    const [emp] = await empleadosActivos(1);
    const lead = await crearLead({ status: 'qualified', assigned_employee_id: emp?.id });
    await repo.updateConHistorial(lead.id, { phone: '3007778899' }, CTX);

    await repo.delete(lead.id, CTX);
    const restaurado = await repo.restaurar(lead.id, CTX);

    // Estado y responsable intactos
    expect(restaurado.status).toBe('qualified');
    expect(restaurado.assigned_employee_id).toBe(emp?.id);
    expect(restaurado.phone).toBe('3007778899');

    // Y el evento deja constancia de lo conservado
    const { data } = await hist.findEvents({ leadId: lead.id, eventType: 'RESTAURACION' });
    expect(data[0].metadata.estado_anterior).toBe('qualified');
    expect(data[0].metadata.estado_actual).toBe('qualified');
    expect(data[0].empleado).toBe(emp?.full_name || null);
    expect(data[0].metadata.archivado_en).toBeTruthy();
  });

  test('R3. Restaurar un lead NO archivado devuelve null', async () => {
    const lead = await crearLead();
    expect(await repo.restaurar(lead.id, CTX)).toBeNull();
    expect(await repo.restaurar('00000000-0000-4000-8000-000000000000', CTX)).toBeNull();
  });

  // Garantía del punto 1 del encargo: conservar el historial COMPLETO
  test('R4. Archivar y restaurar conserva TODO el historial', async () => {
    const [emp] = await empleadosActivos(1);
    const lead = await crearLead({ assigned_employee_id: emp?.id });
    await repo.updateConHistorial(lead.id, { phone: '3001119988', status: 'contacted' }, CTX);
    await gestiones.create(lead.id, { tipo: 'reunion', resultado: 'Agenda demo' }, CTX);

    const antes = (await hist.findEvents({ leadId: lead.id, limit: 100 })).data;
    expect(antes.length).toBeGreaterThan(2);

    await repo.delete(lead.id, CTX);
    await repo.restaurar(lead.id, CTX);

    const despues = (await hist.findEvents({ leadId: lead.id, limit: 100 })).data;
    // Se añaden el evento de archivado y el de restauración
    expect(despues).toHaveLength(antes.length + 2);

    // Cada evento anterior sigue intacto, por id
    const idsAntes = new Set(antes.map((e) => e.id));
    expect(despues.filter((e) => idsAntes.has(e.id))).toHaveLength(antes.length);

    // Y la gestión comercial también
    expect((await gestiones.findByLead(lead.id)).data).toHaveLength(1);
    expect((await hist.findSummary(lead.id)).total_gestiones).toBe(1);
  });

  test('R5. Archivar y restaurar varias veces deja la cadena completa', async () => {
    const lead = await crearLead();
    for (let n = 0; n < 3; n++) {
      await repo.delete(lead.id, CTX);
      await repo.restaurar(lead.id, CTX);
    }

    const archivados = await hist.findEvents({ leadId: lead.id, eventType: 'MODIFICACION' });
    expect(archivados.data.filter((e) => e.campo === 'deleted_at')).toHaveLength(3);

    const restauraciones = await hist.findEvents({ leadId: lead.id, eventType: 'RESTAURACION' });
    expect(restauraciones.data).toHaveLength(3);
  });

  test('R6. La vista de archivados muestra fecha y usuario responsable', async () => {
    const lead = await crearLead();
    await repo.delete(lead.id, CTX);

    const { data } = await repo.findAll({ limit: 300, archivados: true });
    const fila = data.find((l) => l.id === lead.id);

    expect(fila).toBeTruthy();
    expect(fila.deleted_at).toBeTruthy();
    // Nombre denormalizado: el usuario no tiene por qué existir en `users`
    expect(fila.deleted_by_name).toBe('Tester Historial');
  });

  // Garantía transaccional: o se restaura y se registra, o no ocurre nada.
  test('R7. Si el registro del evento falla, el restore se revierte entero', async () => {
    const lead = await crearLead();
    await repo.delete(lead.id, CTX);

    // Fuerzo el fallo del INSERT en lead_history con un CHECK temporal.
    await db.query(`
      ALTER TABLE lead_history ADD CONSTRAINT _test_bloquea_restauracion
      CHECK (event_type <> 'RESTAURACION')`);
    try {
      await expect(repo.restaurar(lead.id, CTX)).rejects.toThrow();
    } finally {
      await db.query(
        `ALTER TABLE lead_history DROP CONSTRAINT IF EXISTS _test_bloquea_restauracion`
      );
    }

    // El lead sigue ARCHIVADO: no quedó restaurado a medias
    const trasFallo = await repo.findByIdIncluyendoArchivado(lead.id);
    expect(trasFallo.deleted_at).toBeTruthy();

    // Y no hay evento RESTAURACION huérfano
    const { data } = await hist.findEvents({ leadId: lead.id, eventType: 'RESTAURACION' });
    expect(data).toHaveLength(0);

    // Con la restricción levantada, el mismo restore sí funciona
    const ok = await repo.restaurar(lead.id, CTX);
    expect(ok.deleted_at).toBeNull();
  });

  // Tras 139/140/141 nada puede destruir la trazabilidad borrando el lead.
  test('R8. Un DELETE físico del lead no destruye historial ni gestiones (RESTRICT)', async () => {
    const lead = await crearLead();
    await gestiones.create(lead.id, { tipo: 'llamada', resultado: 'Hecha' }, CTX);

    await expect(
      db.query(`DELETE FROM leads WHERE id = $1`, [lead.id])
    ).rejects.toMatchObject({ code: '23503' });   // foreign_key_violation

    // Ambas cosas siguen intactas
    expect((await gestiones.findByLead(lead.id)).data).toHaveLength(1);
    expect((await hist.findEvents({ leadId: lead.id })).data.length).toBeGreaterThan(0);
  });
});
