import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Lock, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Modal } from '../../components/common/Modal';
import { ContactForm } from '../../components/Contacts/ContactForm';
import api from '../../lib/api';

const label = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' };
const section = { fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '1.25rem 0 0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' };

const READ_ONLY_ESTADOS = ['LIQUIDADA', 'ANULADO'];

const EMPTY = {
  fecha_servicio: new Date().toISOString().split('T')[0],
  hora_acordada: '',
  forma_pago: 'Contado',
  company_id: '', catalogo_servicio_id: '', equipo_id: '', operario_id: '', operario_2_id: '',
  solicitado_por: '', solicitado_por_id: '', direccion_servicio: '', numero_maquina: '',
  hora_salida_cargar: '', hora_llegada_cliente: '', hora_salida_cliente: '', hora_llegada_cargar: '',
  segundo_fecha_acordada: '', segundo_hora_salida_cargar: '', segundo_hora_llegada_cliente: '', segundo_hora_salida_cliente: '', segundo_hora_llegada_cargar: '', segundo_horometro_salida: '', segundo_horometro_regreso: '',
  horometro_salida: '', horometro_regreso: '',
  cantidad_horas: 1, valor_hora: 0,
  horas_diurnas: 0, valor_hora_diurna: 0,
  horas_nocturnas: 0, valor_hora_nocturna: 0,
  horas_fest_diurnas: 0, valor_hora_fest_dia: 0,
  horas_fest_nocturnas: 0, valor_hora_fest_noc: 0,
  horas_otras: 0, valor_hora_otras: 0,
  total_bruto: 0, iva_pct: 0, aplica_iva: false, iva_valor: 0, descuentos: 0, total_neto: 0,
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
  
  const [isContactModalOpen, setIsContactModalOpen] = React.useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = React.useState(false);
  const [newAddressForm, setNewAddressForm] = React.useState({ address: '', notes: '' });

  const isReadOnly = isEditing && READ_ONLY_ESTADOS.includes(currentEstado);

  // ─── Datos maestros ─────────────────────────────────────────
  const searchCompanies = React.useCallback(async (searchTerm) => {
    const { data } = await api.get('/companies', { params: { search: searchTerm || undefined, limit: 20 } });
    return data.data || [];
  }, []);

  const { data: selectedCompany } = useQuery({
    queryKey: ['company', form.company_id],
    queryFn: async () => { const { data } = await api.get(`/companies/${form.company_id}`); return data.data; },
    enabled: !!form.company_id,
  });

  const { data: catalogoItems = [] } = useQuery({
    queryKey: ['catalogo-pro-servicios'],
    queryFn: async () => {
      const { data } = await api.get('/catalogo-servicios', { params: { is_active: true, limit: 200 } });
      return data.data || [];
    },
  });

  const { data: operariosDisp = [] } = useQuery({
    queryKey: ['operarios-disponibles'],
    queryFn: async () => { const { data } = await api.get('/servicios/operarios-disponibles'); return data.data || []; },
  });

  const { data: contactsData = [], refetch: refetchContacts } = useQuery({
    queryKey: ['company-contacts', form.company_id],
    queryFn: async () => {
      const { data } = await api.get('/contacts', { params: { companyId: form.company_id } });
      return data.data || [];
    },
    enabled: !!form.company_id,
  });

  const { data: serviceAddressesData = [], refetch: refetchAddresses } = useQuery({
    queryKey: ['company-service-addresses', form.company_id],
    queryFn: async () => {
      const { data } = await api.get(`/companies/${form.company_id}/service-addresses`);
      return data.data || [];
    },
    enabled: !!form.company_id,
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
      // Inferir aplica_iva desde el iva_pct guardado
      f.aplica_iva = parseFloat(existingData.iva_pct || 0) > 0;
      setForm(f);
      setHorasManual(true);
      // Solo bloquear auto-cálculo si la remisión ya está LIQUIDADA o ANULADA (modo solo lectura)
      // PENDIENTE y REALIZADA deben seguir respondiendo al auto-cálculo al editar los tiempos
      if (['LIQUIDADA', 'ANULADO'].includes(loadedEstado)) {
        setEstadoManual(true);
      }
    }
  }, [existingData, isEditing]);

  // ─── Cargar equipos de CARGAR S.A.S. (solo OPERATIVOS) ──────
  React.useEffect(() => {
    const params = { estado: 'OPERATIVO' };
    if (isEditing && form.equipo_id) {
      params.include_id = form.equipo_id;
    }

    api.get('/equipos/by-company/cargar', { params })
      .then(res => setEquiposFiltrados(res.data?.data || res.data || []))
      .catch(() => setEquiposFiltrados([]));
  }, [isEditing, form.equipo_id]);

  // ─── Al cambiar empresa: cargar forma de pago ─────────────────
  React.useEffect(() => {
    if (!form.company_id) return;

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
  }, [form.company_id, isEditing, existingData]);

  // Auto‑rellenar la dirección del cliente con la dirección principal de la empresa si no hay una seteada
  React.useEffect(() => {
    if (!isEditing && selectedCompany && selectedCompany.address && !form.direccion_servicio) {
      setForm(prev => ({ ...prev, direccion_servicio: selectedCompany.address }));
    }
  }, [selectedCompany, isEditing]);

  // ─── Al cambiar servicio: autocompletar valor_hora ───────────
  React.useEffect(() => {
    if (form.catalogo_servicio_id && catalogoMap[form.catalogo_servicio_id]) {
      const item = catalogoMap[form.catalogo_servicio_id];
      const precio = parseFloat(item.precio_base ?? 0);
      setForm(prev => ({ ...prev, valor_hora: precio }));
    }
  }, [form.catalogo_servicio_id, catalogoMap]);

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

  React.useEffect(() => {
    if (form.equipo_id && equiposFiltrados.length) {
      const eq = equiposFiltrados.find(e => e.id === form.equipo_id);
      if (eq) {
        setForm(prev => {
          const updated = { ...prev, numero_maquina: eq.serial };
          // Solo auto-completar el horómetro de salida si:
          // 1. No estamos editando una remisión existente, O
          // 2. Estamos editando pero el equipo_id seleccionado cambió respecto al original de la remisión (existingData?.equipo_id)
          const isDifferentEquipment = isEditing && existingData && existingData.equipo_id !== form.equipo_id;
          if (!isEditing || isDifferentEquipment) {
            if (eq.horometro_actual !== undefined && eq.horometro_actual !== null) {
              updated.horometro_salida = eq.horometro_actual;
            }
          }
          return updated;
        });
      }
    }
  }, [form.equipo_id, equiposFiltrados, isEditing, existingData]);

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
    const iva = form.aplica_iva ? Math.round(bruto * 0.19) : 0;
    const neto = bruto + iva - parseFloat(form.descuentos || 0) + totalLiquidacion;
    setForm(prev => ({
      ...prev,
      total_bruto: Math.round(bruto),
      iva_pct: form.aplica_iva ? 19 : 0,
      iva_valor: iva,
      total_neto: Math.round(neto),
    }));
  }, [form.cantidad_horas, form.valor_hora, form.aplica_iva, form.descuentos, totalLiquidacion]);

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

    // Al cambiar solicitado_por_id, auto-completar solicitado_por (nombre string)
    if (name === 'solicitado_por_id') {
      const c = contactsData.find(ct => String(ct.id) === String(value));
      setForm(prev => ({ ...prev, solicitado_por_id: value, solicitado_por: c ? `${c.first_name} ${c.last_name}`.trim() : '' }));
      return;
    }

    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateAddress = async (e) => {
    e.preventDefault();
    if (!newAddressForm.address.trim()) return;
    try {
      const { data } = await api.post(`/companies/${form.company_id}/service-addresses`, newAddressForm);
      toast.success('Dirección creada');
      setIsAddressModalOpen(false);
      setNewAddressForm({ address: '', notes: '' });
      refetchAddresses();
      // Auto-seleccionar
      setForm(prev => ({ ...prev, direccion_servicio: data.data.address }));
    } catch (err) {
      toast.error('Error al guardar dirección');
    }
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
    // Validar horómetro si el equipo tiene información registrada
    if (form.equipo_id && equiposFiltrados.length) {
      const eq = equiposFiltrados.find(e => e.id === form.equipo_id);
      if (eq && eq.horometro_actual !== undefined && eq.horometro_actual !== null && eq.horometro_actual !== '') {
        if (form.horometro_salida === undefined || form.horometro_salida === null || form.horometro_salida === '') {
          toast.error('El Horómetro de Salida es obligatorio para el equipo seleccionado.');
          return;
        }
      }
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>Solicitado Por</label>
                {!isReadOnly && form.company_id && (
                  <button type="button" onClick={() => setIsContactModalOpen(true)} className="btn btn--ghost btn--sm" style={{ padding: '0 4px', height: 'auto', color: 'var(--clr-primary-500)' }} title="Nuevo contacto">
                    <Plus size={14} /> Nuevo
                  </button>
                )}
              </div>
              {isReadOnly ? (
                <input {...inputProps('solicitado_por')} />
              ) : (
                <select name="solicitado_por_id" className="input" style={{ width: '100%' }} value={form.solicitado_por_id || ''} onChange={handleChange} disabled={!form.company_id}>
                  <option value="">{form.company_id ? 'Seleccionar contacto...' : 'Seleccione empresa primero'}</option>
                  {contactsData.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.position ? `(${c.position})` : ''}</option>
                  ))}
                  {/* Para compatibilidad si el contacto ya no existe pero hay nombre histórico guardado, o es texto libre histórico */}
                  {form.solicitado_por && !form.solicitado_por_id && (
                    <option value="" disabled>Historico: {form.solicitado_por}</option>
                  )}
                </select>
              )}
            </div>
            <div style={{ gridColumn: '2 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>Dirección de Servicio</label>
                {!isReadOnly && form.company_id && (
                  <button type="button" onClick={() => setIsAddressModalOpen(true)} className="btn btn--ghost btn--sm" style={{ padding: '0 4px', height: 'auto', color: 'var(--clr-primary-500)' }} title="Nueva dirección">
                    <Plus size={14} /> Nueva
                  </button>
                )}
              </div>
              {isReadOnly ? (
                <input {...inputProps('direccion_servicio')} />
              ) : (
                <select name="direccion_servicio" className="input" style={{ width: '100%' }} value={form.direccion_servicio || ''} onChange={handleChange} disabled={!form.company_id}>
                  <option value="">{form.company_id ? 'Seleccionar o dejar en blanco...' : 'Seleccione empresa primero'}</option>
                  {selectedCompany?.address && (
                    <option value={selectedCompany.address}>{selectedCompany.address} (Sede Principal)</option>
                  )}
                  {serviceAddressesData.map(a => (
                    <option key={a.id} value={a.address}>{a.address} {a.notes ? `- ${a.notes}` : ''}</option>
                  ))}
                  {/* Si la dirección es histórica y no está en la lista */}
                  {form.direccion_servicio && form.direccion_servicio !== selectedCompany?.address && !serviceAddressesData.find(a => a.address === form.direccion_servicio) && (
                    <option value={form.direccion_servicio}>{form.direccion_servicio} (Histórica)</option>
                  )}
                </select>
              )}
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
                  <option value="">Seleccionar servicio del catálogo...</option>
                  {catalogoItems.map(s => <option key={s.id} value={s.id}>[{s.codigo}] {s.nombre}</option>)}
                </select>
              )}
            </div>
            <div style={{ gridColumn: '1 / 3' }}>
              <label style={label}>Equipo *</label>
              {isReadOnly ? (
                <input {...inputProps('equipo_id')} value={`${existingData?.equipo_marca} ${existingData?.equipo_modelo} — ${existingData?.equipo_serial}`} />
              ) : (
                <select name="equipo_id" className="input" style={{ width: '100%' }} value={form.equipo_id} onChange={handleChange} required>
                  <option value="">Seleccionar equipo...</option>
                  {equiposFiltrados.map(e => <option key={e.id} value={e.id}>{e.marca} - {e.serie || '—'}</option>)}
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
              <label style={label}>IVA</label>
              {isReadOnly ? (
                <span style={{ display: 'flex', alignItems: 'center', height: '36px', fontWeight: 600, fontSize: 'var(--text-sm)', color: form.aplica_iva ? 'var(--clr-primary-500)' : 'var(--text-muted)' }}>
                  {form.aplica_iva ? '✔ Aplica IVA (19%)' : '✘ Sin IVA'}
                </span>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', height: '36px', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    id="aplica_iva"
                    name="aplica_iva"
                    checked={!!form.aplica_iva}
                    onChange={(e) => setForm(prev => ({ ...prev, aplica_iva: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: 'var(--clr-primary-500)', cursor: 'pointer' }}
                  />
                  Aplicar IVA (19%)
                </label>
              )}
            </div>
            <div>
              <label style={label}>Descuentos (COP)</label>
              <input type="number" min={0} {...inputProps('descuentos')} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ flex: 1 }}><span style={{ ...label, display: 'block' }}>Total Bruto</span><span style={{ fontWeight: 700 }}>{formatCOP(form.total_bruto)}</span></div>
            <div style={{ flex: 1 }}>
              <span style={{ ...label, display: 'block' }}>IVA {form.aplica_iva ? '(19%)' : ''}</span>
              <span style={{ fontWeight: 700, color: form.aplica_iva ? 'inherit' : 'var(--text-muted)' }}>{form.aplica_iva ? formatCOP(form.iva_valor) : '—'}</span>
            </div>
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
      {/* MODALES */}
      {isContactModalOpen && (
        <Modal title="Crear Contacto Rápido" onClose={() => setIsContactModalOpen(false)}>
          <ContactForm 
            defaultCompanyId={form.company_id}
            fixedCompany={true}
            onSuccess={() => {
              setIsContactModalOpen(false);
              refetchContacts().then(res => {
                // Auto-seleccionar el último contacto creado. 
                // Como es una lista nueva, podemos tomar el que tenga el ID más alto o re-buscar.
                const data = res.data;
                if (data && data.length > 0) {
                  const latest = [...data].sort((a,b) => b.id - a.id)[0];
                  setForm(prev => ({ ...prev, solicitado_por_id: latest.id, solicitado_por: `${latest.first_name} ${latest.last_name}`.trim() }));
                }
              });
            }}
            onCancel={() => setIsContactModalOpen(false)}
          />
        </Modal>
      )}

      {isAddressModalOpen && (
        <Modal title="Agregar Dirección de Servicio" onClose={() => setIsAddressModalOpen(false)}>
          <form onSubmit={handleCreateAddress} className="flex flex-col gap-4">
            <div className="input-group">
              <label className="input-label">Dirección *</label>
              <input 
                className="input" 
                value={newAddressForm.address} 
                onChange={e => setNewAddressForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Ej: Bodega Sur"
                autoFocus
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Notas / Horario (Opcional)</label>
              <input 
                className="input" 
                value={newAddressForm.notes} 
                onChange={e => setNewAddressForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Entregar por la portería 2..."
              />
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--secondary" onClick={() => setIsAddressModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn--primary" disabled={!newAddressForm.address.trim()}>Guardar Dirección</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
