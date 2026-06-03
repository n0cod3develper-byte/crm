import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import api from '../../lib/api';

const label = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' };
const section = { fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '1.25rem 0 0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' };

const READ_ONLY_ESTADOS = ['LIQUIDADA', 'ANULADO'];

const EMPTY = {
  fecha_servicio: new Date().toISOString().split('T')[0],
  hora_acordada: '',
  forma_pago: 'Contado',
  company_id: '', catalogo_servicio_id: '', equipo_id: '', operario_id: '', operario_2_id: '',
  solicitado_por: '', direccion_servicio: '', numero_maquina: '',
  hora_salida_cargar: '', hora_llegada_cliente: '', hora_salida_cliente: '', hora_llegada_cargar: '',
  segundo_fecha_acordada: '', segundo_hora_salida_cargar: '', segundo_hora_llegada_cliente: '', segundo_hora_salida_cliente: '', segundo_hora_llegada_cargar: '', segundo_horometro_salida: '', segundo_horometro_regreso: '',
  horometro_salida: '', horometro_regreso: '',
  cantidad_horas: 1, valor_hora: 0,
  horas_diurnas: 0, valor_hora_diurna: 0,
  horas_nocturnas: 0, valor_hora_nocturna: 0,
  horas_fest_diurnas: 0, valor_hora_fest_dia: 0,
  horas_fest_nocturnas: 0, valor_hora_fest_noc: 0,
  horas_otras: 0, valor_hora_otras: 0,
  total_bruto: 0, iva_pct: 19, iva_valor: 0, descuentos: 0, total_neto: 0,
  observaciones: '',
  estado: 'BORRADOR',
};

/**
 * Calcula horas a partir de horómetros.
 * diff = regreso - salida (en horas decimales)
 * mínimo 1 hora, redondeado a 2 decimales.
 */
function calcularHoras(salida, regreso) {
  const s = parseFloat(salida);
  const r = parseFloat(regreso);
  if (isNaN(s) || isNaN(r) || r <= s) return null;
  const diff = r - s;
  return Math.max(1, Math.round(diff * 100) / 100);
}

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
}

export function RemisionFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const qc = useQueryClient();
  const isEditing = !!id;

  const [form, setForm] = React.useState(EMPTY);
  const [equiposFiltrados, setEquiposFiltrados] = React.useState([]);
  const [catalogoMap, setCatalogoMap] = React.useState({});
  const [horasManual, setHorasManual] = React.useState(false);
  const [currentEstado, setCurrentEstado] = React.useState(null);
  const [estadoManual, setEstadoManual] = React.useState(false);

  const isReadOnly = isEditing && READ_ONLY_ESTADOS.includes(currentEstado);

  // ─── Datos maestros ─────────────────────────────────────────
  const searchCompanies = React.useCallback(async (searchTerm) => {
    const { data } = await api.get('/companies', { params: { search: searchTerm || undefined, limit: 20 } });
    return data.data || [];
  }, []);

  const { data: selectedCompany } = useQuery({
    queryKey: ['company', form.company_id],
    queryFn: async () => { const { data } = await api.get(`/companies/${form.company_id}`); return data.data; },
    enabled: !!form.company_id && isEditing,
  });

  const { data: catalogoItems = [] } = useQuery({
    queryKey: ['catalogo-pro-servicios'],
    queryFn: async () => {
      const { data } = await api.get('/catalogo', { params: { tipo: 'SERVICIO', limit: 200 } });
      // El catálogo PRO devuelve { items: [] }
      return data.items || [];
    },
  });

  const { data: operariosDisp = [] } = useQuery({
    queryKey: ['operarios-disponibles'],
    queryFn: async () => { const { data } = await api.get('/servicios/operarios-disponibles'); return data.data || []; },
  });

  React.useEffect(() => {
    if (catalogoItems.length) {
      const map = {};
      catalogoItems.forEach(s => { map[s.id] = s; });
      setCatalogoMap(map);
    }
  }, [catalogoItems]);

  // ─── Cargar remisión existente (edición) ────────────────────
  const { data: existingData, isLoading: loadingExisting } = useQuery({
    queryKey: ['servicios-edit', id],
    queryFn: async () => { const { data } = await api.get(`/servicios/${id}`); return data.data; },
    enabled: isEditing,
  });

  const { data: horasLaborales = [] } = useQuery({
    queryKey: ['horas-laborales', id],
    queryFn: async () => { const { data } = await api.get(`/servicios/${id}/horas-laborales`); return data.data || []; },
    enabled: isEditing,
  });
  const totalLiquidacion = React.useMemo(() => horasLaborales.reduce((s, h) => s + parseFloat(h.total_liquidado || 0), 0), [horasLaborales]);

  React.useEffect(() => {
    if (existingData && isEditing) {
      const loadedEstado = existingData.estado;
      setCurrentEstado(loadedEstado);
      const f = { ...EMPTY };
      Object.keys(EMPTY).forEach(k => {
        if (existingData[k] !== undefined && existingData[k] !== null) f[k] = existingData[k];
      });
      if (existingData.fecha_servicio) f.fecha_servicio = existingData.fecha_servicio.split('T')[0];
      if (existingData.hora_acordada) {
        f.hora_acordada = new Date(existingData.hora_acordada).toISOString().slice(0, 16);
      }
      if (existingData.operarios && existingData.operarios.length > 0) {
        f.operario_id = existingData.operarios[0]?.empleado_id || '';
        f.operario_2_id = existingData.operarios[1]?.empleado_id || '';
      }
      if (existingData.estado) f.estado = existingData.estado;
      setForm(f);
      setHorasManual(true);
      // Solo bloquear auto-cálculo si la remisión ya está LIQUIDADA o ANULADA (modo solo lectura)
      // PENDIENTE y REALIZADA deben seguir respondiendo al auto-cálculo al editar los tiempos
      if (['LIQUIDADA', 'ANULADO'].includes(loadedEstado)) {
        setEstadoManual(true);
      }
    }
  }, [existingData, isEditing]);

  // ─── Al cambiar empresa: cargar equipos y forma de pago ──────
  React.useEffect(() => {
    if (!form.company_id) { setEquiposFiltrados([]); return; }

    api.get(`/equipos/by-company/${form.company_id}`)
      .then(res => setEquiposFiltrados(res.data?.data || res.data || []))
      .catch(() => setEquiposFiltrados([]));

    // Auto‑rellenar la dirección del cliente con la dirección de la empresa
    const empresa = empresas.find(e => e.id === form.company_id);
    if (empresa && empresa.address && !form.direccion_servicio) {
      setForm(prev => ({ ...prev, direccion_servicio: empresa.address }));
    }

    // Traer la forma de pago de la última remisión FIRMADO para esta empresa
    if (!isEditing || !existingData) {
      api.get(`/servicios/last-forma-pago/${form.company_id}`)
        .then(res => {
          if (res.data?.data) {
            setForm(prev => ({ ...prev, forma_pago: res.data.data }));
          }
        })
        .catch(() => { });
    }
  }, [form.company_id, empresas]);

  // ─── Al cambiar servicio: autocompletar valor_hora ───────────
  React.useEffect(() => {
    if (form.catalogo_servicio_id && catalogoMap[form.catalogo_servicio_id]) {
      // catalogo_completo view expone precio_venta; fallbacks para compatibilidad
      const item = catalogoMap[form.catalogo_servicio_id];
      const precio = parseFloat(item.precio_venta || item.precio_servicio || item.precio_base || 0);
      if (precio > 0) {
        setForm(prev => ({ ...prev, valor_hora: precio }));
      }
      // Determinar si el servicio está exento de IVA
      // Servicios de MONTACARGAS CON OPERARIO, ALQUILER DE GRUA, GAS no tienen IVA
      const tipo = (item.tipo || '').toString().toUpperCase();
      const nombre = (item.nombre_comercial || item.nombre || item.name || '').toString().toUpperCase();
      const esExentoIVA =
        ['GRUA', 'GAS', 'MONTACARGAS'].includes(tipo) ||
        nombre.includes('MONTACARGAS') ||
        nombre.includes('GRUA') || nombre.includes('GRÚA') ||
        nombre.includes('GAS');
      if (esExentoIVA) {
        setForm(prev => ({ ...prev, iva_pct: 0 }));
      } else {
        setForm(prev => ({ ...prev, iva_pct: prev.iva_pct || 19 }));
      }
    }
  }, [form.catalogo_servicio_id, catalogoMap, form.operario_id, form.operario_2_id]);

  // ─── Auto-calcular valor_hora_fest_dia al 125% del valor_hora ──
  React.useEffect(() => {
    const valorHora = parseFloat(form.valor_hora || 0);
    const festDia = Math.round(valorHora * 1.25);
    setForm(prev => ({ ...prev, valor_hora_fest_dia: festDia }));
  }, [form.valor_hora]);


  // ─── Auto-calcular Estado ──────────────────────────────────────
  React.useEffect(() => {
    if (estadoManual || isReadOnly) return;

    // Obligatorios mínimos
    const hasObligatorios = form.company_id && form.catalogo_servicio_id && form.equipo_id && form.fecha_servicio;
    if (!hasObligatorios) return;

    const hasSalida = !!(form.hora_salida_cargar);
    const hasAll = hasSalida && form.hora_llegada_cliente && form.hora_salida_cliente && form.hora_llegada_cargar;

    let newEstado = 'BORRADOR';
    if (hasAll) newEstado = 'REALIZADA';
    else if (hasSalida) newEstado = 'PENDIENTE';

    setForm(prev => prev.estado === newEstado ? prev : { ...prev, estado: newEstado });
  }, [
    form.company_id, form.catalogo_servicio_id, form.equipo_id, form.fecha_servicio,
    form.hora_salida_cargar, form.hora_llegada_cliente, form.hora_salida_cliente,
    form.hora_llegada_cargar,
    estadoManual, isReadOnly
  ]);

  // ─── Al cambiar equipo: autocompletar numero_maquina ─────────
  React.useEffect(() => {
    if (form.equipo_id && equiposFiltrados.length) {
      const eq = equiposFiltrados.find(e => e.id === form.equipo_id);
      if (eq) {
        setForm(prev => ({ ...prev, numero_maquina: eq.serial }));
      }
      // Obtener el último horómetro de regreso de la última remisión de esta máquina
      // Solo para nuevas remisiones (no al editar)
      if (!isEditing) {
        api.get(`/servicios/last-horometro/${form.equipo_id}`)
          .then(res => {
            if (res.data?.data) {
              setForm(prev => ({ ...prev, horometro_salida: res.data.data }));
            }
          })
          .catch(() => { });
      }
    }
  }, [form.equipo_id, equiposFiltrados]);

  // ─── Auto-calcular horas por tiempos (Ambos operarios) ─────────────────────
  React.useEffect(() => {
    if (horasManual) return;

    const calcHorasFromTimes = (salida, llegada) => {
      if (!salida || !llegada) return 0;
      const ts = (t) => t.length > 5 ? t.substring(0, 5) : t;
      const s = new Date(`1970-01-01T${ts(salida)}:00`);
      const l = new Date(`1970-01-01T${ts(llegada)}:00`);
      if (isNaN(s.getTime()) || isNaN(l.getTime())) return 0;
      if (l < s) l.setDate(l.getDate() + 1); // cruza medianoche
      return Math.max(0, (l - s) / (1000 * 60 * 60));
    };

    // Horas operario 1
    let horas1 = 0;
    if (form.hora_salida_cargar && form.hora_llegada_cargar) {
      horas1 = calcHorasFromTimes(form.hora_salida_cargar, form.hora_llegada_cargar);
    } else if (form.horometro_salida && form.horometro_regreso) {
      horas1 = Math.max(0, parseFloat(form.horometro_regreso) - parseFloat(form.horometro_salida));
    }

    // Horas operario 2
    let horas2 = 0;
    if (form.operario_2_id && form.segundo_hora_salida_cargar && form.segundo_hora_llegada_cargar) {
      horas2 = calcHorasFromTimes(form.segundo_hora_salida_cargar, form.segundo_hora_llegada_cargar);
    } else if (form.operario_2_id && form.segundo_horometro_salida && form.segundo_horometro_regreso) {
      horas2 = Math.max(0, parseFloat(form.segundo_horometro_regreso) - parseFloat(form.segundo_horometro_salida));
    }

    const totalHoras = parseFloat((horas1 + horas2).toFixed(2));

    if (totalHoras > 0) {
      setForm(prev => ({ ...prev, cantidad_horas: Math.max(1, totalHoras) }));
    } else if (!form.cantidad_horas || form.cantidad_horas < 1) {
      setForm(prev => ({ ...prev, cantidad_horas: 1 }));
    }
  }, [
    form.hora_salida_cargar, form.hora_llegada_cargar,
    form.horometro_salida, form.horometro_regreso,
    form.segundo_hora_salida_cargar, form.segundo_hora_llegada_cargar,
    form.segundo_horometro_salida, form.segundo_horometro_regreso,
    form.operario_2_id, horasManual
  ]);

  // ─── Auto-calcular totales ───────────────────────────────────
  React.useEffect(() => {
    const bruto = parseFloat(form.cantidad_horas || 0) * parseFloat(form.valor_hora || 0);
    const iva = bruto * (parseFloat(form.iva_pct || 19) / 100);
    const neto = bruto + iva - parseFloat(form.descuentos || 0) + totalLiquidacion;
    setForm(prev => ({
      ...prev,
      total_bruto: Math.round(bruto),
      iva_valor: Math.round(iva),
      total_neto: Math.round(neto),
    }));
  }, [form.cantidad_horas, form.valor_hora, form.iva_pct, form.descuentos, totalLiquidacion]);

  // ─── Mutation ────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (payload) =>
      isEditing ? api.put(`/servicios/${id}`, payload) : api.post('/servicios', payload),
    onSuccess: (res) => {
      toast.success(isEditing ? 'Remisión actualizada' : 'Remisión creada');
      qc.invalidateQueries({ queryKey: ['servicios'] });
      qc.invalidateQueries({ queryKey: ['servicios-edit', id] });
      navigate(`/servicios/${isEditing ? id : res.data.data.id}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'estado') setEstadoManual(true);

    // Validar operarios duplicados
    if (name === 'operario_id' && value && value === form.operario_2_id) {
      toast.error('El operario inicial no puede ser el mismo que el segundo operario.');
      return;
    }
    if (name === 'operario_2_id' && value && value === form.operario_id) {
      toast.error('El segundo operario no puede ser el mismo que el operario inicial.');
      return;
    }

    // Al cambiar campos de hora de inicio/fin, resetear el flag manual
    // para que el auto-cálculo de estado pueda actuar (BORRADOR → PENDIENTE → REALIZADA)
    if (['hora_salida_cargar', 'hora_llegada_cargar', 'horometro_salida', 'horometro_regreso',
         'segundo_hora_salida_cargar', 'segundo_hora_llegada_cargar', 'segundo_horometro_salida', 'segundo_horometro_regreso'].includes(name)) {
      setHorasManual(false);
    }
    // Al cambiar CUALQUIER campo de tiempo (los 4 de tiempos del servicio),
    // reactivar el auto-cálculo de estado si no estamos en un estado bloqueado
    const timeFields = ['hora_salida_cargar', 'hora_llegada_cliente', 'hora_salida_cliente', 'hora_llegada_cargar'];
    if (timeFields.includes(name) && !READ_ONLY_ESTADOS.includes(currentEstado)) {
      setEstadoManual(false);
    }

    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleHorasChange = (e) => {
    setHorasManual(true);
    setForm(prev => ({ ...prev, cantidad_horas: e.target.value }));
  };

  const handleHorometroChange = (e) => {
    const { name, value } = e.target;
    setHorasManual(false); // resetear para que recalcule al cambiar horómetros
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.company_id || !form.catalogo_servicio_id || !form.equipo_id || !form.fecha_servicio || (!isEditing && !form.operario_id)) {
      toast.error('Faltan campos obligatorios');
      return;
    }
    mutation.mutate(form);
  };

  // ─── Modo solo lectura ───────────────────────────────────────

  if (isEditing && loadingExisting) {
    return (
      <div className="app-layout">
        <div className="empty-state"><div className="spinner" /></div>
      </div>
    );
  }

  const inputProps = (name, extra = {}) => ({
    name,
    className: 'input',
    style: { width: '100%', ...(isReadOnly ? { background: 'var(--bg-secondary)', color: 'var(--text-muted)' } : {}) },
    value: form[name] ?? '',
    onChange: isReadOnly ? undefined : handleChange,
    readOnly: isReadOnly,
    ...extra,
  });

  const horarioRows = [
    { label: 'DIURNO', nh: 'horas_diurnas', nv: 'valor_hora_diurna' },
    { label: 'NOCTURNO', nh: 'horas_nocturnas', nv: 'valor_hora_nocturna' },
    { label: 'FESTIVO DIURNO', nh: 'horas_fest_diurnas', nv: 'valor_hora_fest_dia' },
    { label: 'FESTIVO NOCTURNO', nh: 'horas_fest_nocturnas', nv: 'valor_hora_fest_noc' },
    { label: 'OTRO', nh: 'horas_otras', nv: 'valor_hora_otras' },
  ];

  return (
    <div className="app-layout">
      <Topbar
        title={isEditing ? `Editar Remisión${form.numero_remision ? ` No. ${form.numero_remision}` : ''}` : 'Nueva Remisión'}
        subtitle={isReadOnly ? 'Remisión en solo lectura' : (isEditing ? 'Editando datos de la remisión' : 'Registrar un nuevo servicio prestado')}
      />

      <main className="main-content">
        <button className="btn btn--ghost btn--sm" style={{ marginBottom: '1.5rem' }} onClick={() => navigate(isEditing ? `/servicios/${id}` : '/servicios')}>
          <ArrowLeft size={14} /> Volver
        </button>

        {isReadOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#f59e0b', fontWeight: 600, fontSize: '13px' }}>
            <Lock size={16} /> Esta remisión está en estado <strong>{currentEstado}</strong> y no puede ser editada.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ maxWidth: 960 }}>

          {/* — Información General — */}
          <p style={section}>Información General</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={label}>Fecha del Servicio *</label>
              <input type="date" {...inputProps('fecha_servicio')} required />
            </div>
            <div>
              <label style={label}>Hora Acordada</label>
              <input type="datetime-local" {...inputProps('hora_acordada')} />
            </div>
            <div>
              <label style={label}>Forma de Pago</label>
              {isReadOnly ? (
                <input {...inputProps('forma_pago')} />
              ) : (
                <select name="forma_pago" className="input" style={{ width: '100%' }} value={form.forma_pago} onChange={handleChange}>
                  <option value="Contado">Contado</option>
                  <option value="Credito">Crédito</option>
                </select>
              )}
            </div>
            <div style={{ gridColumn: '1 / span 2' }}>
              <label style={label}>Empresa / Cliente *</label>
              <SearchableSelect
                fetchFn={searchCompanies}
                value={form.company_id}
                initialItem={selectedCompany}
                onChange={(val) => {
                  handleChange({ target: { name: 'company_id', value: val } });
                }}
                placeholder="Buscar cliente por nombre o NIT..."
                noOptionsMessage="No se encontraron empresas con ese nombre o NIT"
                errorMessage="Error al buscar empresas. Verifica la conexión."
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label style={label}>Estado (Auto / Manual)</label>
              <select
                {...inputProps('estado')}
                style={{ width: '100%', fontWeight: 700, color: 'var(--clr-primary-600)' }}
              >
                <option value="BORRADOR">Borrador</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="REALIZADA">Realizada</option>
                <option value="LIQUIDADA">Liquidada</option>
                <option value="ANULADO">Anulada</option>
              </select>
            </div>
            <div>
              <label style={label}>Solicitado Por</label>
              <input placeholder="Nombre del contacto" {...inputProps('solicitado_por')} />
            </div>
            <div style={{ gridColumn: '2 / -1' }}>
              <label style={label}>Dirección de Servicio</label>
              <input placeholder="Dirección donde se presta el servicio" {...inputProps('direccion_servicio')} />
            </div>
          </div>

          {/* — Servicio y Equipo — */}
          <p style={section}>Servicio y Equipo</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>Tipo de Servicio (Catálogo) *</label>
              {isReadOnly ? (
                <input {...inputProps('catalogo_servicio_id')} value={`[${existingData?.servicio_codigo}] ${existingData?.servicio_nombre}`} />
              ) : (
                <select name="catalogo_servicio_id" className="input" style={{ width: '100%' }} value={form.catalogo_servicio_id} onChange={handleChange} required>
                  <option value="">Seleccionar servicio del catálogo PRO...</option>
                  {catalogoItems.map(s => <option key={s.id} value={s.id}>[{s.codigo_interno}] {s.nombre_comercial}</option>)}
                </select>
              )}
            </div>
            <div style={{ gridColumn: '1 / 3' }}>
              <label style={label}>Equipo *</label>
              {isReadOnly ? (
                <input {...inputProps('equipo_id')} value={`${existingData?.equipo_marca} ${existingData?.equipo_modelo} — ${existingData?.equipo_serial}`} />
              ) : (
                <select name="equipo_id" className="input" style={{ width: '100%' }} value={form.equipo_id} onChange={handleChange} required disabled={!form.company_id}>
                  <option value="">{form.company_id ? 'Seleccionar equipo...' : 'Primero selecciona la empresa'}</option>
                  {equiposFiltrados.map(e => <option key={e.id} value={e.id}>{e.marca} {e.modelo} — {e.serial}</option>)}
                </select>
              )}
            </div>
            <div>
              <label style={label}>No. Máquina</label>
              <input placeholder="Ej: 73" {...inputProps('numero_maquina')} />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={label}>Operario Inicial *</label>
                {isReadOnly ? (
                  <input className="input" style={{ width: '100%' }} disabled value={existingData?.operarios?.[0]?.full_name || '—'} />
                ) : (
                  <select name="operario_id" className="input" style={{ width: '100%' }} value={form.operario_id} onChange={handleChange} required>
                    <option value="">Seleccionar operario...</option>
                    {operariosDisp.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label style={label}>Segundo Operario (Opcional)</label>
                {isReadOnly ? (
                  <input className="input" style={{ width: '100%' }} disabled value={existingData?.operarios?.[1]?.full_name || '—'} />
                ) : (
                  <select name="operario_2_id" className="input" style={{ width: '100%' }} value={form.operario_2_id || ''} onChange={handleChange}>
                    <option value="">Seleccionar segundo operario...</option>
                    {operariosDisp.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* — Tiempos del Servicio (Primer Operario) — */}
          <p style={section}>Tiempos del Servicio (Operario Inicial)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {[
              { name: 'hora_salida_cargar', label: 'Hora Salida CARGAR' },
              { name: 'hora_llegada_cliente', label: 'Hora Llegada Cliente' },
              { name: 'hora_salida_cliente', label: 'Hora Salida Cliente' },
              { name: 'hora_llegada_cargar', label: 'Hora Llegada CARGAR' },
            ].map(({ name, label: lbl }) => (
              <div key={name}>
                <label style={label}>{lbl}</label>
                <input type="time" {...inputProps(name)} />
              </div>
            ))}
            <div>
              <label style={label}>Horómetro Salida {form.operario_2_id ? '(Op. 1)' : ''}</label>
              <input
                type="number" step="0.01" name="horometro_salida" className="input" style={{ width: '100%' }}
                value={form.horometro_salida}
                onChange={isReadOnly ? undefined : handleHorometroChange}
                readOnly={isReadOnly}
                placeholder="Ej: 1250.5"
              />
            </div>
            <div>
              <label style={label}>Horómetro Regreso {form.operario_2_id ? '(Op. 1)' : ''}</label>
              <input
                type="number" step="0.01" name="horometro_regreso" className="input" style={{ width: '100%' }}
                value={form.horometro_regreso}
                onChange={isReadOnly ? undefined : handleHorometroChange}
                readOnly={isReadOnly}
                placeholder="Ej: 1252.42"
              />
            </div>
          </div>

          {form.operario_2_id && (
            <>
              <p style={section}>Tiempos del Servicio (Segundo Operario)</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={label}>Fecha Acordada (Op. 2)</label>
                  <input type="date" {...inputProps('segundo_fecha_acordada')} />
                </div>
                {[
                  { name: 'segundo_hora_salida_cargar', label: 'Hora Salida CARGAR' },
                  { name: 'segundo_hora_llegada_cliente', label: 'Hora Llegada Cliente' },
                  { name: 'segundo_hora_salida_cliente', label: 'Hora Salida Cliente' },
                  { name: 'segundo_hora_llegada_cargar', label: 'Hora Llegada CARGAR' },
                ].map(({ name, label: lbl }) => (
                  <div key={name}>
                    <label style={label}>{lbl}</label>
                    <input type="time" {...inputProps(name)} />
                  </div>
                ))}
                <div>
                  <label style={label}>Horómetro Salida (Op. 2)</label>
                  <input
                    type="number" step="0.01" name="segundo_horometro_salida" className="input" style={{ width: '100%' }}
                    value={form.segundo_horometro_salida}
                    onChange={isReadOnly ? undefined : handleHorometroChange}
                    readOnly={isReadOnly}
                    placeholder="Ej: 1250.5"
                  />
                </div>
                <div>
                  <label style={label}>Horómetro Regreso (Op. 2)</label>
                  <input
                    type="number" step="0.01" name="segundo_horometro_regreso" className="input" style={{ width: '100%' }}
                    value={form.segundo_horometro_regreso}
                    onChange={isReadOnly ? undefined : handleHorometroChange}
                    readOnly={isReadOnly}
                    placeholder="Ej: 1252.42"
                  />
                </div>
              </div>
            </>
          )}

          {/* — Descripción del Servicio — */}
          <p style={section}>Descripción del Servicio — Valores</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={label}>
                Cantidad / Horas{form.operario_2_id ? ' (Op.1 + Op.2)' : ''}
                {!isReadOnly && !horasManual && (
                  (form.hora_salida_cargar && form.hora_llegada_cargar) ||
                  (form.horometro_salida && form.horometro_regreso)
                ) && (
                  <span style={{ color: 'var(--clr-primary-500)', marginLeft: 4, fontWeight: 400 }}>(auto)</span>
                )}
              </label>
              <input
                type="number" step="0.01" min={0} name="cantidad_horas" className="input" style={{ width: '100%' }}
                value={form.cantidad_horas}
                onChange={isReadOnly ? undefined : handleHorasChange}
                readOnly={isReadOnly}
                title="Se calcula automáticamente. Mínimo 1 hora."
              />
              {!isReadOnly && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
                  Llegada − Salida CARGAR (mín. 1 h) — editable manualmente
                </div>
              )}
            </div>
            <div>
              <label style={label}>
                Valor por Hora (COP)
                {!isReadOnly && form.catalogo_servicio_id && (
                  (catalogoMap[form.catalogo_servicio_id]?.precio_venta > 0 ||
                   catalogoMap[form.catalogo_servicio_id]?.precio_servicio > 0 ||
                   catalogoMap[form.catalogo_servicio_id]?.precio_base > 0) && (
                  <span style={{ color: 'var(--clr-primary-500)', marginLeft: 4, fontWeight: 400 }}>(del catálogo)</span>
                ))}
              </label>
              <input type="number" min={0} {...inputProps('valor_hora')} />
            </div>
            <div>
              <label style={label}>IVA (%)</label>
              <input type="number" min={0} max={100} {...inputProps('iva_pct')} />
            </div>
            <div>
              <label style={label}>Descuentos (COP)</label>
              <input type="number" min={0} {...inputProps('descuentos')} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ flex: 1 }}><span style={{ ...label, display: 'block' }}>Total Bruto</span><span style={{ fontWeight: 700 }}>{formatCOP(form.total_bruto)}</span></div>
            <div style={{ flex: 1 }}><span style={{ ...label, display: 'block' }}>IVA</span><span style={{ fontWeight: 700 }}>{formatCOP(form.iva_valor)}</span></div>
            <div style={{ flex: 1 }}><span style={{ ...label, display: 'block' }}>Descuentos</span><span style={{ fontWeight: 700 }}>{formatCOP(form.descuentos)}</span></div>
            <div style={{ flex: 1 }}><span style={{ ...label, display: 'block' }}>TOTAL NETO</span><span style={{ fontWeight: 800, color: 'var(--clr-primary-500)', fontSize: '16px' }}>{formatCOP(form.total_neto)}</span></div>
          </div>


          {/* — Observaciones — */}
          <div style={{ marginTop: '1.5rem' }}>
            <label style={label}>Observaciones</label>
            <textarea name="observaciones" className="input" rows={3} style={{ width: '100%' }} value={form.observaciones} onChange={isReadOnly ? undefined : handleChange} readOnly={isReadOnly} placeholder="Notas adicionales del servicio..." />
          </div>

          {/* — Botones — */}
          {!isReadOnly && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
              <button type="button" className="btn btn--ghost" onClick={() => navigate(isEditing ? `/servicios/${id}` : '/servicios')}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
                <Save size={16} /> {mutation.isPending ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Remisión'}
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
