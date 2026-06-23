import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Copy, Save, Check, Trash2, Eye, FileText, Plus,
  Search, ChevronLeft, ChevronRight, AlertCircle,
  RefreshCw, MessageSquareCode,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { promptSpecService } from '../../services/promptSpecService';
import { useAuth } from '../../contexts/AuthContext';
import { Topbar } from '../../components/layout/Topbar';

// ─── Constantes ────────────────────────────────────────────────
const AREAS = [
  'Sistemas', 'Inventario', 'Facturacion', 'Servicios',
  'Mantenimiento', 'Compras', 'Logistica', 'SST',
  'Gerencia', 'RH', 'Contabilidad', 'Tesorería',
  'Comercial', 'Marketing',
];

const MODULOS_EXISTENTES = [
  'Inventario (FIFO)', 'Facturacion', 'Soporte', 'Empleados',
  'Equipos', 'Mantenimiento', 'Turnos', 'Catalogo Servicios',
  'Servicios / Remisiones', 'Proveedores', 'Compras', 'Empresas',
  'Contactos', 'Pipeline', 'Tareas', 'Cotizaciones', 'Leads',
  'Campanas', 'Dashboard', 'Presupuestos', 'Informes Dinamicos',
  'Locativo', 'SST', 'Mantenimientos Programados',
];

const PLANTILLA_BASE = [
  'Contexto fijo del proyecto (no negociable)',
  '',
  'Eres un desarrollador senior full-stack trabajando sobre el CRM interno de CARGAR S.A.S.',
  '',
  'Frontend: React',
  'Backend: Node.js + Express',
  'Base de datos: PostgreSQL',
  'Despliegue: VPS Hostinger, Nginx, PM2, GitHub Actions CI/CD',
  'Autenticacion: JWT custom propio. NO usar Clerk, NO usar Auth0, NO usar NextAuth.',
  'NO usar Docker bajo ninguna circunstancia.',
  'Sigue la estructura de carpetas ya existente en el repo.',
  'Codigo completo y funcional. Cero placeholders, cero // TODO.',
  'Comentarios solo donde no sea obvio.',
  'Responde en espanol; codigo y nombres de variables en ingles.',
].join('\n');

function buildPrompt(data) {
  const {
    nombreModulo, area, objetivo, entidades, reglasNegocio,
    relaciones = [], datosSensibles = false, requiereUI = true, notasExtra = '',
  } = data;

  const lines = [PLANTILLA_BASE, ''];
  lines.push('---', '## MODULO SOLICITADO', nombreModulo || '(por definir)', '');
  lines.push('## AREA RESPONSABLE', area || '(por definir)', '');
  lines.push('## OBJETIVO', objetivo || '(por definir)', '');
  if (entidades) lines.push('## ENTIDADES', entidades, '');
  if (reglasNegocio) lines.push('## REGLAS DE NEGOCIO', reglasNegocio, '');
  if (relaciones.length > 0) {
    lines.push('## INTEGRACION CON OTROS MODULOS');
    lines.push('Este modulo se integra con los siguientes modulos existentes del CRM:');
    relaciones.forEach((m) => lines.push('- ' + m));
    lines.push('');
  }
  lines.push('## ALCANCE TECNICO');
  lines.push('- Backend: Nuevo modulo (rutas, controlador, servicio, repository).');
  lines.push('- Frontend: Nueva pagina con componentes, hooks y servicios.');
  lines.push('- Base de datos: Migracion numerada con CREATE TABLE + indices.');
  lines.push('- Autenticacion: JWT custom.');
  lines.push('- Roles: Middleware `authorize`.');
  if (requiereUI) {
    lines.push('- UI: Componentes React responsivos, lucide-react, temas existentes.');
    lines.push('- Paginacion: Patrones existentes del CRM.');
  } else {
    lines.push('- UI: Sin interfaz grafica - solo API REST.');
  }
  if (datosSensibles) {
    lines.push('', '## MANEJO DE DATOS SENSIBLES');
    lines.push('ESTE MODULO MANEJA DATOS PERSONALES O SENSIBLES.');
    lines.push('- Almacenar segun estandares de seguridad del CRM actual.');
    lines.push('- No introducir mecanismos de cifrado nuevos sin aprobacion.');
    lines.push('- Validar logs (solo IDs, no contenido).');
  }
  if (notasExtra) lines.push('', '## NOTAS ADICIONALES', notasExtra, '');
  return lines.join('\n');
}

const EMPTY_FORM = {
  nombreModulo: '', area: '', objetivo: '',
  entidades: '', reglasNegocio: '', relaciones: [],
  datosSensibles: false, requiereUI: true, notasExtra: '', clonadoDe: null,
};

// ═══════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════
export function PromptGeneratorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const tab = searchParams.get('tab') || 'generador';
  const isAdmin = ['admin', 'superadmin'].includes(user?.rol_slug);
  const isDev = user?.rol_slug === 'developer';

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [isDirty, setIsDirty] = useState(false);
  const [savedId, setSavedId] = useState(null);

  const promptPreview = useMemo(() => buildPrompt(form), [form]);

  const handleChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  const handleRelacionToggle = useCallback((mod) => {
    setForm((prev) => ({
      ...prev,
      relaciones: prev.relaciones.includes(mod)
        ? prev.relaciones.filter((r) => r !== mod)
        : [...prev.relaciones, mod],
    }));
    setIsDirty(true);
  }, []);

  const resetForm = useCallback(() => {
    setForm({ ...EMPTY_FORM });
    setSavedId(null);
    setIsDirty(false);
  }, []);

  const loadFormFromRecord = useCallback((record) => {
    setForm({
      nombreModulo: record.nombre_modulo,
      area: record.area,
      objetivo: record.objetivo,
      entidades: record.entidades || '',
      reglasNegocio: record.reglas_negocio || '',
      relaciones: record.relaciones || [],
      datosSensibles: record.datos_sensibles,
      requiereUI: record.requiere_ui,
      notasExtra: record.notas_extra || '',
      clonadoDe: record.id,
    });
    setSavedId(null);
    setIsDirty(true);
    setSearchParams({ tab: 'generador' });
  }, [setSearchParams]);

  const saveMutation = useMutation({
    mutationFn: (data) => promptSpecService.create(data),
    onSuccess: (record) => {
      toast.success('Prompt spec guardado correctamente');
      setSavedId(record.id);
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['promptSpecs'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message || 'Error al guardar';
      toast.error(msg);
    },
  });

  const handleSave = useCallback(() => {
    if (!form.nombreModulo.trim() || !form.area.trim() || !form.objetivo.trim()) {
      toast.error('Completa los campos obligatorios: Modulo, Area y Objetivo');
      return;
    }
    saveMutation.mutate(form);
  }, [form, saveMutation]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(promptPreview);
      toast.success('Prompt copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar el prompt');
    }
  }, [promptPreview]);

  const canDelete = useCallback((record) => {
    if (isAdmin) return true;
    if (isDev && record.creado_por === user?.id) return true;
    return false;
  }, [isAdmin, isDev, user]);

  return (
    <div className="app-layout">
      <Topbar
        title="Generador de Prompts"
        subtitle="Crea y gestiona especificaciones para nuevos modulos del CRM"
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={'tab-btn' + (tab === 'generador' ? ' tab-btn--active' : '')}
              onClick={() => setSearchParams({ tab: 'generador' })}
            >
              <MessageSquareCode size={16} />
              Generador
            </button>
            <button
              className={'tab-btn' + (tab === 'historial' ? ' tab-btn--active' : '')}
              onClick={() => setSearchParams({ tab: 'historial' })}
            >
              <FileText size={16} />
              Historial
            </button>
          </div>
        }
      />

      <main className="main-content">
        {tab === 'generador' ? (
          <GeneratorView
            form={form}
            onChange={handleChange}
            onRelacionToggle={handleRelacionToggle}
            promptPreview={promptPreview}
            onSave={handleSave}
            onCopy={handleCopy}
            onReset={resetForm}
            savedId={savedId}
            isDirty={isDirty}
            isSaving={saveMutation.isPending}
          />
        ) : (
          <HistoryView
            onLoadRecord={loadFormFromRecord}
            canDelete={canDelete}
          />
        )}
      </main>

      <style>{`
        .tab-btn {
          display: inline-flex; align-items: center; gap: 0.375rem;
          padding: 0.5rem 1rem; border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background: var(--bg-elevated); color: var(--text-secondary);
          font-size: 0.8125rem; font-weight: 500; cursor: pointer;
          transition: all 0.15s ease;
        }
        .tab-btn:hover { border-color: var(--primary-300); color: var(--text-primary); }
        .tab-btn--active {
          background: var(--primary-10); border-color: var(--primary-400);
          color: var(--primary-700);
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GENERATOR VIEW (two panels)
// ═══════════════════════════════════════════════════════════════
function GeneratorView({
  form, onChange, onRelacionToggle, promptPreview,
  onSave, onCopy, onReset, savedId, isDirty, isSaving,
}) {
  return (
    <div className="generator-layout">
      {/* LEFT: Formulario */}
      <div className="card generator-form">
        <div className="card__header">
          <h3 className="card__title">Especificacion del Modulo</h3>
        </div>
        <div className="card__body generator-form__body">
          <div className="form-group">
            <label className="form-label">
              Nombre del Modulo <span className="text-danger">*</span>
            </label>
            <input
              className="form-input"
              placeholder="Ej: Recordatorios de certificacion SST"
              value={form.nombreModulo}
              onChange={(e) => onChange('nombreModulo', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Area Responsable <span className="text-danger">*</span>
            </label>
            <select
              className="form-input"
              value={form.area}
              onChange={(e) => onChange('area', e.target.value)}
            >
              <option value="">Seleccionar area...</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              Objetivo <span className="text-danger">*</span>
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Describe el objetivo del modulo..."
              value={form.objetivo}
              onChange={(e) => onChange('objetivo', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Entidades</label>
            <input
              className="form-input"
              placeholder="Ej: Operario, Certificacion, FechaVencimiento"
              value={form.entidades}
              onChange={(e) => onChange('entidades', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reglas de Negocio</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Ej: Alertar 30 y 7 dias antes del vencimiento"
              value={form.reglasNegocio}
              onChange={(e) => onChange('reglasNegocio', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Integracion con otros modulos</label>
            <div className="relaciones-grid">
              {MODULOS_EXISTENTES.map((mod) => {
                const selected = form.relaciones.includes(mod);
                return (
                  <button
                    key={mod}
                    type="button"
                    className={'relacion-chip' + (selected ? ' relacion-chip--active' : '')}
                    onClick={() => onRelacionToggle(mod)}
                  >
                    {selected && <Check size={12} />}
                    {mod}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-row">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={form.datosSensibles}
                onChange={(e) => onChange('datosSensibles', e.target.checked)}
              />
              <span>Maneja datos sensibles</span>
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={form.requiereUI}
                onChange={(e) => onChange('requiereUI', e.target.checked)}
              />
              <span>Requiere interfaz de usuario</span>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Notas Adicionales</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Cualquier informacion extra..."
              value={form.notasExtra}
              onChange={(e) => onChange('notasExtra', e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button
              className="btn btn--primary"
              onClick={onSave}
              disabled={isSaving || !isDirty}
            >
              {isSaving ? (
                <RefreshCw className="spinner" size={16} />
              ) : savedId && !isDirty ? (
                <Check size={16} />
              ) : (
                <Save size={16} />
              )}
              <span>
                {isSaving
                  ? 'Guardando...'
                  : savedId && !isDirty
                    ? 'Guardado \u2713'
                    : 'Guardar'}
              </span>
            </button>
            <button className="btn btn--ghost" onClick={onReset}>
              <Plus size={16} />
              <span>Nuevo</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Prompt Ticket */}
      <div className="card generator-preview">
        <div className="card__header">
          <h3 className="card__title">Prompt Generado</h3>
          <button className="btn btn--ghost btn--sm" onClick={onCopy} title="Copiar prompt">
            <Copy size={14} />
            <span>Copiar prompt</span>
          </button>
        </div>
        <div className="card__body">
          <pre className="prompt-ticket">{promptPreview}</pre>
        </div>
      </div>

      <style>{`
        .generator-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .generator-layout { grid-template-columns: 1fr; }
        }
        .generator-form__body { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label {
          font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary);
        }
        .form-input {
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-app);
          color: var(--text-primary);
          font-size: 0.875rem;
          width: 100%;
          transition: border-color 0.15s;
        }
        .form-input:focus {
          outline: none;
          border-color: var(--primary-400);
          box-shadow: 0 0 0 3px var(--primary-10);
        }
        textarea.form-input { resize: vertical; font-family: inherit; }
        select.form-input { cursor: pointer; }
        .form-row { display: flex; gap: 1.5rem; flex-wrap: wrap; }
        .toggle-label {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.875rem; color: var(--text-primary); cursor: pointer;
        }
        .toggle-label input[type="checkbox"] {
          width: 1rem; height: 1rem; accent-color: var(--primary-600);
        }
        .form-actions {
          display: flex; gap: 0.75rem; margin-top: 0.5rem;
          padding-top: 1rem; border-top: 1px solid var(--border-color);
        }
        .relaciones-grid { display: flex; flex-wrap: wrap; gap: 0.375rem; }
        .relacion-chip {
          display: inline-flex; align-items: center; gap: 0.25rem;
          padding: 0.25rem 0.625rem; border-radius: 9999px;
          border: 1px solid var(--border-color);
          background: var(--bg-elevated); color: var(--text-secondary);
          font-size: 0.75rem; cursor: pointer; transition: all 0.15s;
        }
        .relacion-chip:hover { border-color: var(--primary-300); color: var(--text-primary); }
        .relacion-chip--active {
          background: var(--primary-10); border-color: var(--primary-400);
          color: var(--primary-700);
        }
        .generator-preview { position: sticky; top: 1rem; }
        .prompt-ticket {
          white-space: pre-wrap; word-break: break-word;
          font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
          font-size: 0.75rem; line-height: 1.6;
          color: var(--text-primary); background: var(--bg-app);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md); padding: 1rem;
          max-height: 70vh; overflow-y: auto;
        }
        .text-danger { color: var(--clr-danger, #ef4444); }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HISTORY VIEW
// ═══════════════════════════════════════════════════════════════
function HistoryView({ onLoadRecord, canDelete }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [areaFilter, setAreaFilter] = useState('');
  const [search, setSearch] = useState('');
  const [viewData, setViewData] = useState(null);

  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['promptSpecs', { page, limit, area: areaFilter, search }],
    queryFn: () => promptSpecService.list({ page, limit, area: areaFilter, search }),
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => promptSpecService.remove(id),
    onSuccess: () => {
      toast.success('Prompt spec eliminado');
      queryClient.invalidateQueries({ queryKey: ['promptSpecs'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.error || 'Error al eliminar';
      toast.error(msg);
    },
  });

  const handleClone = useCallback(async (id) => {
    try {
      const record = await promptSpecService.clone(id);
      onLoadRecord(record);
    } catch {
      toast.error('Error al clonar el prompt spec');
    }
  }, [onLoadRecord]);

  const handleView = useCallback(async (id) => {
    try {
      const record = await promptSpecService.getById(id);
      setViewData(record);
    } catch {
      toast.error('Error al cargar el prompt spec');
    }
  }, []);

  const handleDelete = useCallback((id, nombre) => {
    if (window.confirm('¿Seguro que quieres eliminar el prompt spec "' + nombre + '"?')) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  // View modal
  if (viewData) {
    return (
      <ViewModal
        record={viewData}
        onClose={() => setViewData(null)}
        onClone={() => { handleClone(viewData.id); setViewData(null); }}
        canDelete={canDelete(viewData)}
        onDelete={() => { handleDelete(viewData.id, viewData.nombre_modulo); setViewData(null); }}
      />
    );
  }

  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title">Historial de Prompt Specs</h3>
      </div>

      <div className="history-filters">
        <div className="search-box">
          <Search size={16} className="search-box__icon" />
          <input
            className="search-box__input"
            placeholder="Buscar por nombre de modulo..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="form-input filter-select"
          value={areaFilter}
          onChange={(e) => { setAreaFilter(e.target.value); setPage(1); }}
        >
          <option value="">Todas las areas</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="table-loader">
          <RefreshCw className="spinner" size={24} />
        </div>
      ) : isError ? (
        <div className="empty-state">
          <AlertCircle size={32} style={{ color: 'var(--clr-danger)' }} />
          <p>Error al cargar el historial</p>
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="empty-state">
          <FileText size={32} style={{ color: 'var(--text-muted)' }} />
          <p>
            {search || areaFilter
              ? 'No se encontraron resultados con esos filtros'
              : 'Aun no hay prompt specs guardados'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Modulo</th>
                  <th>Area</th>
                  <th>Creado por</th>
                  <th>Fecha</th>
                  <th style={{ width: '180px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data?.data?.map((record) => (
                  <tr key={record.id}>
                    <td className="font-medium">{record.nombre_modulo}</td>
                    <td><span className="badge badge--area">{record.area}</span></td>
                    <td className="text-muted">{record.creador_nombre || '-'}</td>
                    <td className="text-muted text-sm">
                      {new Date(record.created_at).toLocaleDateString('es-CO', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="btn btn--ghost btn--sm"
                          title="Ver prompt"
                          onClick={() => handleView(record.id)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          title="Clonar"
                          onClick={() => handleClone(record.id)}
                        >
                          <Copy size={14} />
                        </button>
                        {canDelete(record) && (
                          <button
                            className="btn btn--ghost btn--sm btn--danger"
                            title="Eliminar"
                            onClick={() => handleDelete(record.id, record.nombre_modulo)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && totalPages > 1 && (
            <div className="pagination">
              <span className="pagination__info">
                Pg. {data.page} de {totalPages} ({data.total} registros)
              </span>
              <div className="pagination__buttons">
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={data.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={data.page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .history-filters {
          display: flex; gap: 0.75rem; padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border-color);
        }
        .search-box { flex: 1; position: relative; display: flex; align-items: center; }
        .search-box__icon {
          position: absolute; left: 0.75rem;
          color: var(--text-muted); pointer-events: none;
        }
        .search-box__input {
          width: 100%; padding: 0.5rem 0.75rem 0.5rem 2.25rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-app); color: var(--text-primary);
          font-size: 0.875rem;
        }
        .search-box__input:focus { outline: none; border-color: var(--primary-400); }
        .filter-select { width: auto; min-width: 160px; }
        .table-loader { display: flex; justify-content: center; padding: 3rem; }
        .empty-state {
          display: flex; flex-direction: column; align-items: center;
          gap: 0.75rem; padding: 3rem; color: var(--text-muted);
        }
        .table-wrapper { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; }
        .table th {
          text-align: left; padding: 0.75rem 1rem;
          font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.05em; color: var(--text-muted);
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-elevated);
        }
        .table td { padding: 0.75rem 1rem; font-size: 0.875rem; border-bottom: 1px solid var(--border-color); }
        .table tbody tr:hover { background: var(--bg-hover); }
        .font-medium { font-weight: 500; }
        .text-muted { color: var(--text-muted); }
        .text-sm { font-size: 0.8125rem; }
        .badge {
          display: inline-block; padding: 0.125rem 0.5rem;
          border-radius: 9999px; font-size: 0.75rem; font-weight: 500;
        }
        .badge--area { background: var(--primary-10); color: var(--primary-700); }
        .actions-cell { display: flex; gap: 0.25rem; }
        .btn--danger { color: var(--clr-danger, #ef4444); }
        .btn--danger:hover { background: rgba(239, 68, 68, 0.1); }
        .pagination {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 1.25rem; border-top: 1px solid var(--border-color);
        }
        .pagination__info { font-size: 0.8125rem; color: var(--text-muted); }
        .pagination__buttons { display: flex; gap: 0.25rem; }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEW MODAL
// ═══════════════════════════════════════════════════════════════
function ViewModal({ record, onClose, onClone, canDelete, onDelete }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(record.prompt_generado);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Prompt copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar');
    }
  }, [record.prompt_generado]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h3 className="modal__title">{record.nombre_modulo}</h3>
            <span className="badge badge--area" style={{ marginTop: '0.25rem', display: 'inline-block' }}>
              {record.area}
            </span>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal__meta">
          <div className="meta-item">
            <span className="meta-label">Creado por:</span>
            <span>{record.creador_nombre || '-'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Fecha:</span>
            <span>{new Date(record.created_at).toLocaleDateString('es-CO', { dateStyle: 'long' })}</span>
          </div>
          {record.clonado_de && (
            <div className="meta-item">
              <span className="meta-label">Clonado de:</span>
              <span>ID {record.clonado_de}</span>
            </div>
          )}
        </div>

        <pre className="prompt-ticket" style={{ margin: '1rem 0' }}>
          {record.prompt_generado}
        </pre>

        <div className="modal__actions">
          <button className="btn btn--primary" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copiado' : 'Copiar prompt'}</span>
          </button>
          <button className="btn btn--secondary" onClick={onClone}>
            <Copy size={16} />
            <span>Clonar y editar</span>
          </button>
          {canDelete && (
            <button className="btn btn--danger-outline" onClick={onDelete}>
              <Trash2 size={16} />
              <span>Eliminar</span>
            </button>
          )}
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 1rem;
        }
        .modal-content {
          background: var(--bg-elevated);
          border-radius: var(--radius-lg); padding: 1.5rem;
          max-width: 900px; width: 100%; max-height: 90vh;
          overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        }
        .modal__header { display: flex; justify-content: space-between; align-items: flex-start; }
        .modal__title { font-size: 1.125rem; font-weight: 700; margin: 0; }
        .modal__meta {
          display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 1rem 0;
          padding: 0.75rem; background: var(--bg-app);
          border-radius: var(--radius-md); font-size: 0.8125rem;
        }
        .meta-item { display: flex; gap: 0.375rem; }
        .meta-label { color: var(--text-muted); font-weight: 500; }
        .modal__actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .btn--danger-outline {
          border: 1px solid var(--clr-danger, #ef4444);
          color: var(--clr-danger, #ef4444); background: transparent;
        }
        .btn--danger-outline:hover { background: rgba(239, 68, 68, 0.1); }
      `}</style>
    </div>
  );
}
