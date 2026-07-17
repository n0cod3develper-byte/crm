import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Wrench, Plus, Trash2, Search, DollarSign,
  User, Package, AlertCircle, CheckCircle2, Clock, Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { useAuth } from '../../contexts/AuthContext';
import { OTFirmadaUploader } from '../../components/documentos/OTFirmadaUploader';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import api from '../../lib/api';

export function OTFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  // ─── Estado del formulario ──────────────────────────────
  const [form, setForm] = React.useState({
    tipo_mantenimiento: 'CORRECTIVO',
    pm_frecuencia_id: '',
    componente_id: '',
    empresa_id: '',
    equipo_id: '',
    tecnico_id: '',
    horometro_inicial: '',
    horometro_final: '',
    responsable: '',
    contacto_empresa: '',
    telefono_contacto: '',
    detalle_servicio: '',
    observaciones: '',
  });

  const [tecnicos, setTecnicos] = React.useState([]);
  const [repuestos, setRepuestos] = React.useState([]);
  const [actividadesPM, setActividadesPM] = React.useState([]);

  // Búsqueda de inventario
  const [invSearch, setInvSearch] = React.useState('');
  const [invResults, setInvResults] = React.useState([]);
  const [showInvDropdown, setShowInvDropdown] = React.useState(false);

  // Liquidación
  const [showLiquidar, setShowLiquidar] = React.useState(false);
  const [liqNotas, setLiqNotas] = React.useState('');
  const [liqImpuesto, setLiqImpuesto] = React.useState(19);
  const [selectedQuoteId, setSelectedQuoteId] = React.useState('');

  // ─── Cargar datos si estamos editando ───────────────────
  const { data: otData } = useQuery({
    queryKey: ['ot-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/mantenimiento/ot/${id}`);
      return data.data;
    },
    enabled: isEditing,
  });

  const { data: clientQuotesAll } = useQuery({
    queryKey: ['quotes-by-client', form.empresa_id],
    queryFn: async () => {
      const { data } = await api.get('/quotes', { params: { companyId: form.empresa_id, limit: 100 } });
      return data.data;
    },
    enabled: Boolean(form.empresa_id) && !(otData?.estado === 'LIQUIDADA' || otData?.estado === 'CERRADA'),
  });

  const clientQuotes = React.useMemo(() => {
    return clientQuotesAll?.filter(q => ['draft', 'sent', 'viewed'].includes(q.status)) || [];
  }, [clientQuotesAll]);

  const [selectedQuoteDetails, setSelectedQuoteDetails] = React.useState(null);

  React.useEffect(() => {
    if (selectedQuoteId) {
      api.get(`/quotes/${selectedQuoteId}`)
        .then(res => {
          setSelectedQuoteDetails(res.data.data);
        })
        .catch(err => {
          toast.error("Error al cargar detalles de la cotización");
          setSelectedQuoteDetails(null);
        });
    } else {
      setSelectedQuoteDetails(null);
    }
  }, [selectedQuoteId]);

  const quoteSubtotal = React.useMemo(() => {
    if (!selectedQuoteDetails || !selectedQuoteDetails.items) return 0;
    return selectedQuoteDetails.items.reduce((acc, it) => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unit_price) || 0;
      const discount = parseFloat(it.discount) || 0;
      return acc + (qty * price * (1 - discount / 100));
    }, 0);
  }, [selectedQuoteDetails]);

  const { data: otFirmadaData } = useQuery({
    queryKey: ['ot-firmada', id],
    queryFn: async () => {
      const { data } = await api.get(`/documentos/ot/${id}/firmada`);
      return data.data; // Puede ser null si no hay
    },
    enabled: isEditing,
  });

  React.useEffect(() => {
    if (otData) {
      setForm({
        tipo_mantenimiento: otData.tipo_mantenimiento,
        pm_frecuencia_id: otData.pm_frecuencia_id || '',
        componente_id: otData.componente_id || '',
        empresa_id: otData.empresa_id,
        equipo_id: otData.equipo_id,
        horometro_inicial: otData.horometro_inicial || '',
        horometro_final: otData.horometro_final || '',
        contacto_empresa: otData.contacto_empresa || '',
        telefono_contacto: otData.telefono_contacto || '',
        responsable: otData.responsable || '',
        detalle_servicio: otData.detalle_servicio || '',
        observaciones: otData.observaciones || '',
      });
      setTecnicos(otData.tecnicos_asignados || []);
      setRepuestos(otData.repuestos_insumos || []);
      setActividadesPM(otData.pm_actividades || []);
    } else if (!isEditing && user && !form.responsable) {
      setForm(prev => ({ ...prev, responsable: `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.full_name || '' }));
    }
  }, [otData, isEditing, user]);

  // ─── Componentes (Para Correctivos) ─────────────────────
  const { data: componentesData } = useQuery({
    queryKey: ['mantenimiento-componentes-activos'],
    queryFn: async () => {
      const { data } = await api.get('/mantenimiento/componentes/activos');
      return data.data || [];
    },
  });
  const componentes = componentesData || [];

  // ─── Frecuencias PM ─────────────────────────────────────
  const { data: frecuenciasData } = useQuery({
    queryKey: ['pm-frecuencias'],
    queryFn: async () => {
      const { data } = await api.get('/mantenimiento/pm/frecuencias');
      return data.data || [];
    },
  });
  const frecuencias = frecuenciasData || [];

  // ─── Plantilla PM (precarga en creación) ────────────────
  const { data: plantillaData, isFetching: loadingPlantilla } = useQuery({
    queryKey: ['pm-plantilla', form.pm_frecuencia_id],
    queryFn: async () => {
      const { data } = await api.get(`/mantenimiento/pm/frecuencias/${form.pm_frecuencia_id}/plantilla`);
      return data.data;
    },
    enabled: !isEditing && form.tipo_mantenimiento === 'PREVENTIVO' && !!form.pm_frecuencia_id,
  });

  // ─── Empresa seleccionada (para edición) ──────────────
  const [selectedCompany, setSelectedCompany] = React.useState(null);

  React.useEffect(() => {
    if (isEditing && form.empresa_id && !selectedCompany) {
      api.get(`/companies/${form.empresa_id}`)
        .then(r => setSelectedCompany(r.data.data))
        .catch(() => { });
    }
  }, [isEditing, form.empresa_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Búsqueda de empresas (server-side) ─────────────────
  const searchCompanies = React.useCallback(async (searchTerm) => {
    const { data } = await api.get('/companies', {
      params: { search: searchTerm || undefined, limit: 20 }
    });
    return data.data || [];
  }, []);

  // --- Carga de equipos (solo OPERATIVOS de la empresa seleccionada) ---

  const { data: equiposData, isLoading: loadingEquipos } = useQuery({
    queryKey: ['equipos-empresa', form.empresa_id, isEditing ? form.equipo_id : null],
    queryFn: async () => {
      const params = {};
      const { data } = await api.get(`/equipos/by-company/${form.empresa_id}`, { params });
      return data.data || [];
    },
    enabled: !!form.empresa_id,
  });
  const equipos = equiposData || [];

  // --- Carga de contactos de la empresa ---
  const { data: contactosData, isLoading: loadingContactos } = useQuery({
    queryKey: ['contactos-empresa', form.empresa_id],
    queryFn: async () => {
      const { data } = await api.get('/contacts', { params: { companyId: form.empresa_id, limit: 100 } });
      return data.data || [];
    },
    enabled: !!form.empresa_id,
  });
  const contactos = contactosData || [];

  // ─── Técnicos disponibles ──────────────────────────────
  const { data: tecnicosDisponibles } = useQuery({
    queryKey: ['tecnicos-disponibles'],
    queryFn: async () => {
      const { data } = await api.get('/employees', { params: { position: 'Técnico', limit: 200 } });
      return data.data || [];
    },
  });

  // ─── Búsqueda de inventario ────────────────────────────
  React.useEffect(() => {
    if (invSearch.length < 2) { setInvResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/inventory/search', { params: { q: invSearch } });
        setInvResults(data.data || []);
        setShowInvDropdown(true);
      } catch { setInvResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [invSearch]);

  // ─── Mutations ──────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async (payload) => {
      if (isEditing) {
        return api.put(`/mantenimiento/ot/${id}`, payload);
      }
      return api.post('/mantenimiento/ot', payload);
    },
    onSuccess: (res) => {
      toast.success(isEditing ? 'OT actualizada' : 'OT creada');
      qc.invalidateQueries({ queryKey: ['ordenes-trabajo'] });
      const newId = isEditing ? id : res.data?.data?.id;
      if (newId) navigate(`/mantenimiento/${newId}/editar`);
      else navigate('/mantenimiento');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const updateActividadMut = useMutation({
    mutationFn: ({ aid, body }) => api.put(`/mantenimiento/ot/${id}/actividades/${aid}`, body),
    onSuccess: () => { toast.success('Actividad actualizada'); qc.invalidateQueries({ queryKey: ['ot-detail', id] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar actividad'),
  });

  const addTecMut = useMutation({
    mutationFn: (body) => api.post(`/mantenimiento/ot/${id}/tecnicos`, body),
    onSuccess: () => { toast.success('Técnico agregado'); qc.invalidateQueries({ queryKey: ['ot-detail', id] }); },
  });

  const updateTecMut = useMutation({
    mutationFn: ({ tid, body }) => api.put(`/mantenimiento/ot/${id}/tecnicos/${tid}`, body),
    onSuccess: () => { 
      toast.success('Técnico actualizado'); 
      qc.invalidateQueries({ queryKey: ['ot-detail', id] }); 
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar técnico'),
  });

  const delTecMut = useMutation({
    mutationFn: (tid) => api.delete(`/mantenimiento/ot/${id}/tecnicos/${tid}`),
    onSuccess: () => { toast.success('Técnico removido'); qc.invalidateQueries({ queryKey: ['ot-detail', id] }); },
  });

  const addRepMut = useMutation({
    mutationFn: (body) => api.post(`/mantenimiento/ot/${id}/repuestos`, body),
    onSuccess: () => { toast.success('Repuesto agregado'); qc.invalidateQueries({ queryKey: ['ot-detail', id] }); },
  });

  const delRepMut = useMutation({
    mutationFn: (rid) => api.delete(`/mantenimiento/ot/${id}/repuestos/${rid}`),
    onSuccess: () => { toast.success('Repuesto removido'); qc.invalidateQueries({ queryKey: ['ot-detail', id] }); },
  });

  const updateRepMut = useMutation({
    mutationFn: ({ rid, body }) => api.put(`/mantenimiento/ot/${id}/repuestos/${rid}`, body),
    onSuccess: () => { toast.success('Repuesto actualizado'); qc.invalidateQueries({ queryKey: ['ot-detail', id] }); },
  });

  const liquidarMut = useMutation({
    mutationFn: (body) => api.post(`/mantenimiento/ot/${id}/liquidar`, body),
    onSuccess: () => {
      toast.success('OT liquidada exitosamente');
      qc.invalidateQueries({ queryKey: ['ordenes-trabajo'] });
      navigate(`/mantenimiento/${id}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al liquidar'),
  });

  const handleDownloadPDF = async () => {
    if (!isEditing || !otData) return;
    try {
      toast.loading('Generando PDF...', { id: 'pdf' });
      const response = await api.get(`/mantenimiento/ot/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${otData.consecutivo || 'OT'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF descargado', { id: 'pdf' });
    } catch {
      toast.error('Error al generar el PDF', { id: 'pdf' });
    }
  };

  // ─── Handlers ──────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'empresa_id') {
        next.equipo_id = '';
        next.contacto_empresa = '';
        next.telefono_contacto = '';
      }
      if (name === 'tipo_mantenimiento' && value === 'CORRECTIVO') {
        next.pm_frecuencia_id = '';
      }
      if (name === 'equipo_id') {
        const equipoSeleccionado = equipos.find(eq => String(eq.id) === String(value));
        if (equipoSeleccionado && equipoSeleccionado.horometro_actual != null) {
          next.horometro_inicial = equipoSeleccionado.horometro_actual;
        }
      }
      if (name === 'contacto_empresa') {
        const contactoSeleccionado = contactos.find(c => `${c.first_name} ${c.last_name || ''}`.trim() === value || c.id === value);
        if (contactoSeleccionado) {
          next.telefono_contacto = contactoSeleccionado.phone || contactoSeleccionado.phone1 || contactoSeleccionado.telefono || '';
        }
      }
      return next;
    });
  };

  const handleFrecuenciaChange = (freqId) => {
    if (form.pm_frecuencia_id && freqId !== form.pm_frecuencia_id && plantillaData) {
      if (!window.confirm('¿Deseas cambiar la frecuencia? Se actualizarán las actividades e insumos mostrados.')) return;
    }
    setForm(prev => ({ ...prev, pm_frecuencia_id: freqId }));
  };

  const handleSave = () => {
    if (!form.empresa_id || !form.equipo_id || !form.tipo_mantenimiento) {
      return toast.error('Empresa, equipo y tipo de mantenimiento son requeridos');
    }
    if (form.tipo_mantenimiento === 'CORRECTIVO' && !form.componente_id) {
      return toast.error('Debes seleccionar el Componente / Sistema afectado para ordenes correctivas');
    }
    if (!isEditing && !form.tecnico_id) {
      return toast.error('Debes seleccionar un técnico principal (mecánico)');
    }
    if (form.tipo_mantenimiento === 'PREVENTIVO' && !form.pm_frecuencia_id) {
      return toast.error('Debes seleccionar una frecuencia para el mantenimiento preventivo');
    }
    // Guardamos la OT sin interferir con los tiempos de los técnicos
    saveMut.mutate(form);
  };

  // Técnicos
  const [newTecId, setNewTecId] = React.useState('');
  const handleAddTecnico = () => {
    if (!newTecId) return toast.error('Selecciona un técnico');
    const emp = (tecnicosDisponibles || []).find(e => e.id === newTecId);
    addTecMut.mutate({ empleado_id: newTecId, tarifa_hora: emp?.hourly_rate || 0 });
    setNewTecId('');
  };

  const [tecTimers, setTecTimers] = React.useState({});
  const handleTecTimeChange = (tid, field, value) => {
    setTecTimers(prev => ({ ...prev, [tid]: { ...prev[tid], [field]: value } }));
  };
  const handleSaveTecTimes = (tid) => {
    const t = tecnicos.find(x => x.id === tid);
    const timers = tecTimers[tid] || {};
    updateTecMut.mutate({
      tid, body: {
        fecha_salida: timers.fecha_salida || t.fecha_salida,
        hora_salida: timers.hora_salida || t.hora_salida,
        fecha_regreso: timers.fecha_regreso || t.fecha_regreso,
        hora_regreso: timers.hora_regreso || t.hora_regreso,
      }
    });
  };

  // Repuestos
  const handleSelectItem = (item) => {
    const costo = parseFloat(item.unit_price || 0);
    const precioConMarkup = Math.round(costo * 1.23);

    addRepMut.mutate({
      item_inventario_id: item.id,
      descripcion: item.nombre_comercial || item.name,
      cantidad: 1,
      unidad: item.unit || 'unidad',
      precio_unitario: precioConMarkup,
      origen: 'MANUAL'
    });
    setInvSearch('');
    setShowInvDropdown(false);
  };

  const [repEdits, setRepEdits] = React.useState({});
  const handleRepChange = (rid, field, value) => {
    setRepEdits(prev => ({ ...prev, [rid]: { ...prev[rid], [field]: value } }));
  };
  const handleSaveRep = (rid) => {
    const r = repuestos.find(x => x.id === rid);
    const edits = repEdits[rid] || {};
    updateRepMut.mutate({
      rid, body: {
        cantidad: edits.cantidad !== undefined ? parseFloat(edits.cantidad) : r.cantidad,
        precio_unitario: edits.precio_unitario !== undefined ? parseFloat(edits.precio_unitario) : r.precio_unitario,
      }
    });
  };

  // Actividades PM (marcar completada)
  const [actEdits, setActEdits] = React.useState({});
  const handleActChange = (aid, field, value) => {
    setActEdits(prev => ({ ...prev, [aid]: { ...prev[aid] || {}, [field]: value } }));
  };
  const handleSaveActividad = (aid, estado) => {
    const edits = actEdits[aid] || {};
    if (!edits.completada_por) return toast.error('Selecciona el técnico que realizó la tarea');
    updateActividadMut.mutate({
      aid, body: {
        estado,
        completada_por: edits.completada_por,
        observacion: edits.observacion || ''
      }
    });
  };

  const totalMO = tecnicos.reduce((s, t) => s + parseFloat(t.total_mano_obra || 0), 0);
  const totalRepManual = repuestos.reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const totalRep = totalRepManual + quoteSubtotal;
  const subtotal = totalMO + totalRep;
  const impValor = subtotal * (liqImpuesto / 100);
  const totalFinal = subtotal + impValor;

  const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

  const isLiqOrClosed = otData && (otData.estado === 'LIQUIDADA' || otData.estado === 'CERRADA');

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Topbar
        title={isEditing ? `Editar OT ${otData?.consecutivo || ''}` : 'Nueva Orden de Trabajo'}
        subtitle={isEditing ? 'Modifica los datos de la orden' : 'Completa los datos para crear una nueva OT'}
        rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn--ghost" onClick={() => navigate('/mantenimiento')}>
              <ArrowLeft size={18} />
            </button>
            {isEditing && (
              <button className="btn btn--secondary" onClick={handleDownloadPDF} title="Descargar OT (Blanco) para Técnico">
                <Download size={16} /> <span className="hidden sm:inline">Descargar PDF</span>
              </button>
            )}
            {!isLiqOrClosed && (
              <button className="btn btn--primary" onClick={handleSave} disabled={saveMut.isPending}>
                <Save size={16} /> {saveMut.isPending ? 'Guardando...' : 'Guardar OT'}
              </button>
            )}
          </div>
        }
      />

      <main className="main-content" style={{ maxWidth: 1100 }}>
        {/* ═══ SECCIÓN A: Datos Generales ═══ */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wrench size={18} color="var(--clr-primary-400)" /> Datos Generales
          </h2>

          <div className="form-grid-2cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Tipo */}
            <div className="input-group">
              <label className="input-label">Tipo de mantenimiento</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['CORRECTIVO', 'PREVENTIVO'].map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`btn ${form.tipo_mantenimiento === t ? 'btn--primary' : 'btn--secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => handleChange({ target: { name: 'tipo_mantenimiento', value: t } })}
                    disabled={isLiqOrClosed || (isEditing && form.tipo_mantenimiento !== t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Empresa (búsqueda predictiva) */}
            <div className="input-group">
              <label className="input-label">Empresa</label>
              <SearchableSelect
                fetchFn={searchCompanies}
                value={form.empresa_id}
                onChange={(val) => {
                  if (!val) {
                    setForm(prev => ({ ...prev, empresa_id: '', equipo_id: '' }));
                    setSelectedCompany(null);
                  } else {
                    handleChange({ target: { name: 'empresa_id', value: val } });
                  }
                }}
                initialItem={selectedCompany}
                placeholder="Buscar cliente por nombre o NIT..."
                disabled={isEditing || isLiqOrClosed}
                name="empresa_id"
                noOptionsMessage="No se encontraron empresas con ese nombre o NIT"
              />
            </div>

            {/* Componente / Sistema afectado (Solo si es CORRECTIVO) */}
            {form.tipo_mantenimiento === 'CORRECTIVO' && (
              <div className="input-group">
                <label className="input-label" style={{ color: 'var(--clr-primary-400)', fontWeight: 700 }}>
                  Componente / Sistema Afectado <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  name="componente_id"
                  className="input"
                  value={form.componente_id}
                  onChange={handleChange}
                  disabled={isLiqOrClosed}
                >
                  <option value="">Seleccione el componente...</option>
                  {componentes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Frecuencia (Solo si es PREVENTIVO) */}
            {form.tipo_mantenimiento === 'PREVENTIVO' && (
              <div className="input-group" style={{ gridColumn: '1 / -1', background: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                <label className="input-label" style={{ color: 'var(--clr-primary-400)', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                  Frecuencia de Mantenimiento
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
                  {frecuencias.map(f => {
                    const isActive = form.pm_frecuencia_id === f.id;
                    return (
                      <label
                        key={f.id}
                        className={`selectable-card ${isActive ? 'selectable-card--active' : ''}`}
                        style={{ cursor: isLiqOrClosed || isEditing ? 'default' : 'pointer' }}
                      >
                        <input
                          type="radio"
                          name="pm_frecuencia_id"
                          value={f.id}
                          checked={isActive}
                          onChange={() => handleFrecuenciaChange(f.id)}
                          disabled={isLiqOrClosed || isEditing}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px' }}>{f.nombre}</span>
                          <span style={{ fontSize: '11px', color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', lineHeight: 1.3 }}>
                            {f.descripcion}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Equipo (dinámico) */}
            <div className="input-group">
              <label className="input-label">Equipo</label>
              {!form.empresa_id ? (
                <select className="input" disabled>
                  <option>Selecciona primero una empresa</option>
                </select>
              ) : loadingEquipos ? (
                <div className="input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ width: 14, height: 14 }} /> Cargando equipos...
                </div>
              ) : equipos.length === 0 ? (
                <div className="input" style={{ color: 'var(--clr-warning)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <AlertCircle size={14} /> Esta empresa no tiene equipos registrados
                </div>
              ) : (
                <select className="input" name="equipo_id" value={form.equipo_id} onChange={handleChange} disabled={isLiqOrClosed}>
                  <option value="">Seleccionar equipo...</option>
                  {equipos.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.marca} {eq.modelo} — {eq.serial}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Técnico Principal (Solo Creación) */}
            {!isEditing && (
              <div className="input-group">
                <label className="input-label">Técnico (Mecánico) *</label>
                <select className="input" name="tecnico_id" value={form.tecnico_id || ''} onChange={handleChange} required>
                  <option value="">Seleccionar técnico...</option>
                  {(tecnicosDisponibles || []).map(t => (
                    <option key={t.id} value={t.id}>{t.full_name || t.nombre}</option>
                  ))}
                </select>
              </div>
            )}


            {/* Horómetros */}
            <div className="input-group">
              <label className="input-label">Horómetro inicial</label>
              <input className="input" name="horometro_inicial" type="number" step="0.1" value={form.horometro_inicial} onChange={handleChange} placeholder="0.0" disabled={isLiqOrClosed} />
            </div>
            <div className="input-group">
              <label className="input-label">Horómetro final</label>
              <input className="input" name="horometro_final" type="number" step="0.1" value={form.horometro_final} onChange={handleChange} placeholder="0.0" disabled={isLiqOrClosed} />
            </div>

            {/* Contacto */}
            <div className="input-group">
              <label className="input-label">Contacto empresa</label>
              {!form.empresa_id ? (
                <select className="input" disabled>
                  <option>Selecciona primero una empresa</option>
                </select>
              ) : loadingContactos ? (
                <div className="input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ width: 14, height: 14 }} /> Cargando contactos...
                </div>
              ) : contactos.length === 0 ? (
                <input className="input" name="contacto_empresa" value={form.contacto_empresa} onChange={handleChange} placeholder="Nombre del contacto" disabled={isLiqOrClosed} />
              ) : (
                <select className="input" name="contacto_empresa" value={form.contacto_empresa} onChange={handleChange} disabled={isLiqOrClosed}>
                  <option value="">Seleccionar contacto...</option>
                  {form.contacto_empresa && !contactos.some(c => `${c.first_name} ${c.last_name || ''}`.trim() === form.contacto_empresa) && (
                    <option value={form.contacto_empresa}>{form.contacto_empresa}</option>
                  )}
                  {contactos.map(c => {
                    const nombreCompleto = `${c.first_name} ${c.last_name || ''}`.trim();
                    return <option key={c.id} value={nombreCompleto}>{nombreCompleto}</option>;
                  })}
                </select>
              )}
            </div>

            {/* Responsable */}
            <div className="input-group">
              <label className="input-label">Responsable</label>
              <input className="input" name="responsable" value={form.responsable} onChange={handleChange} placeholder="Nombre del responsable" disabled={true} />
            </div>

            <div className="input-group">
              <label className="input-label">Teléfono contacto</label>
              <input className="input" name="telefono_contacto" value={form.telefono_contacto} onChange={handleChange} placeholder="Teléfono" disabled={isLiqOrClosed} />
            </div>
          </div>

          {/* Detalle */}
          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label className="input-label">Detalle del servicio</label>
            <textarea className="input" rows={4} name="detalle_servicio" value={form.detalle_servicio} onChange={handleChange} placeholder="Descripción del trabajo a realizar..." disabled={isLiqOrClosed} />
          </div>
          <div className="input-group" style={{ marginTop: '0.75rem' }}>
            <label className="input-label">Observaciones</label>
            <textarea className="input" rows={2} name="observaciones" value={form.observaciones} onChange={handleChange} placeholder="Notas adicionales..." disabled={isLiqOrClosed} />
          </div>
        </div>



        {/* ═══ SECCIÓN B: Técnicos (solo en edición) ═══ */}
        {isEditing && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} color="var(--clr-primary-400)" /> Técnicos Asignados
            </h2>

            {!isLiqOrClosed && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <select className="input" style={{ flex: 1 }} value={newTecId} onChange={e => setNewTecId(e.target.value)}>
                  <option value="">Seleccionar técnico...</option>
                  {(tecnicosDisponibles || []).map(t => (
                    <option key={t.id} value={t.id}>{t.full_name} — {fmt(t.hourly_rate)}/h</option>
                  ))}
                </select>
                <button className="btn btn--primary btn--sm" onClick={handleAddTecnico} disabled={addTecMut.isPending}>
                  <Plus size={14} /> Agregar
                </button>
              </div>
            )}

            {tecnicos.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '13px' }}>
                No hay técnicos asignados a esta OT.
              </p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Técnico</th>
                      <th>Fecha Salida</th>
                      <th>Hora Salida</th>
                      <th>Fecha Regreso</th>
                      <th>Hora Regreso</th>
                      <th style={{ textAlign: 'right' }}>Tiempo</th>
                      <th style={{ textAlign: 'right' }}>Tarifa/h</th>
                      <th style={{ textAlign: 'right' }}>Total M.O.</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tecnicos.map(t => {
                      const timer = tecTimers[t.id] || {};
                      return (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 600 }}>{t.full_name}</td>
                          <td><input type="date" className="input" style={{ padding: '4px 6px', fontSize: '12px' }} value={timer.fecha_salida ?? (t.fecha_salida?.substring(0, 10) || '')} onChange={e => handleTecTimeChange(t.id, 'fecha_salida', e.target.value)} disabled={isLiqOrClosed} /></td>
                          <td><input type="time" className="input" style={{ padding: '4px 6px', fontSize: '12px' }} value={timer.hora_salida ?? (t.hora_salida?.substring(0, 5) || '')} onChange={e => handleTecTimeChange(t.id, 'hora_salida', e.target.value)} disabled={isLiqOrClosed} /></td>
                          <td><input type="date" className="input" style={{ padding: '4px 6px', fontSize: '12px' }} value={timer.fecha_regreso ?? (t.fecha_regreso?.substring(0, 10) || '')} onChange={e => handleTecTimeChange(t.id, 'fecha_regreso', e.target.value)} disabled={isLiqOrClosed} /></td>
                          <td><input type="time" className="input" style={{ padding: '4px 6px', fontSize: '12px' }} value={timer.hora_regreso ?? (t.hora_regreso?.substring(0, 5) || '')} onChange={e => handleTecTimeChange(t.id, 'hora_regreso', e.target.value)} disabled={isLiqOrClosed} /></td>
                          <td style={{ textAlign: 'right', fontSize: '12px' }}>
                            {t.tiempo_total_min != null ? `${Math.floor(t.tiempo_total_min / 60)}h ${t.tiempo_total_min % 60}m` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '12px' }}>{fmt(t.tarifa_hora)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '12px' }}>{fmt(t.total_mano_obra)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              {!isLiqOrClosed && (
                                <>
                                  <button className="btn btn--ghost btn--sm" onClick={() => handleSaveTecTimes(t.id)} title="Guardar tiempos">
                                    <Save size={12} />
                                  </button>
                                  <button className="btn btn--ghost btn--sm" style={{ color: 'var(--clr-danger)' }} onClick={() => delTecMut.mutate(t.id)} title="Remover">
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ textAlign: 'right', marginTop: '0.75rem', fontWeight: 700, color: 'var(--clr-primary-400)' }}>
              Total Mano de Obra: {fmt(totalMO)}
            </div>
          </div>
        )}

        {/* ═══ SECCIÓN PREVENTIVO: Actividades (solo PREVENTIVO) ═══ */}
        {form.tipo_mantenimiento === 'PREVENTIVO' && (
          <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(67,56,202,0.3)', borderTopWidth: 4 }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--clr-primary-500)' }}>
              <CheckCircle2 size={18} /> Actividades del Preventivo
            </h2>

            {!isEditing ? (
              // Vista previa de la plantilla antes de guardar
              loadingPlantilla ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner" /> Cargando plantilla...</div>
              ) : plantillaData?.actividades?.length > 0 ? (
                <div>
                  <div style={{ marginBottom: '1rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Al guardar la orden de trabajo, se generará una lista de chequeo con las siguientes actividades:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.5rem' }}>
                    {plantillaData.actividades.map(a => (
                      <div key={a.id} style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '13px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--text-muted)', display: 'grid', placeItems: 'center', fontSize: '10px' }}>{a.orden}</div>
                        <span style={{ fontWeight: 500 }}>{a.nombre}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Selecciona una frecuencia para ver las actividades.</div>
              )
            ) : (
              // Edición real de actividades (snapshot)
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Actividad</th>
                      <th>Estado</th>
                      <th>Ejecutor</th>
                      <th>Observación</th>
                      <th style={{ width: 100 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actividadesPM.map(a => {
                      const edit = actEdits[a.id] || {};
                      return (
                        <tr key={a.id}>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{a.orden}</td>
                          <td style={{ fontWeight: 600 }}>{a.nombre}</td>
                          <td>
                            <span className={`badge ${a.estado === 'COMPLETADA' ? 'badge--success' : a.estado === 'OMITIDA' ? 'badge--warning' : 'badge--gray'}`}>
                              {a.estado}
                            </span>
                          </td>
                          <td>
                            <select
                              className="input"
                              style={{ padding: '4px 6px', fontSize: '12px' }}
                              value={edit.completada_por !== undefined ? edit.completada_por : (a.completada_por || '')}
                              onChange={e => handleActChange(a.id, 'completada_por', e.target.value)}
                              disabled={isLiqOrClosed}
                            >
                              <option value="">Seleccionar técnico...</option>
                              {tecnicos.map(t => (
                                <option key={t.empleado_id} value={t.empleado_id}>{t.full_name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="input"
                              style={{ padding: '4px 6px', fontSize: '12px' }}
                              placeholder="Notas (opcional)"
                              value={edit.observacion !== undefined ? edit.observacion : (a.observacion || '')}
                              onChange={e => handleActChange(a.id, 'observacion', e.target.value)}
                              disabled={isLiqOrClosed}
                            />
                          </td>
                          <td>
                            {!isLiqOrClosed && (
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button className="btn btn--primary btn--sm" style={{ padding: '4px 8px' }} onClick={() => handleSaveActividad(a.id, 'COMPLETADA')} title="Marcar como completada">✓</button>
                                <button className="btn btn--secondary btn--sm" style={{ padding: '4px 8px' }} onClick={() => handleSaveActividad(a.id, 'OMITIDA')} title="Omitir">✗</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══ SECCIÓN C: Repuestos e Insumos ═══ */}
        {isEditing ? (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={18} color="var(--clr-primary-400)" /> Repuestos e Insumos
            </h2>

            {!isLiqOrClosed && (
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="Buscar repuesto adicional en el inventario..."
                  value={invSearch}
                  onChange={e => setInvSearch(e.target.value)}
                  onFocus={() => invResults.length > 0 && setShowInvDropdown(true)}
                  onBlur={() => setTimeout(() => setShowInvDropdown(false), 200)}
                />
                {showInvDropdown && invResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                    maxHeight: 250, overflowY: 'auto',
                  }}>
                    {invResults.map(item => (
                      <div
                        key={item.id}
                        style={{
                          padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '13px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                        onMouseDown={() => handleSelectItem(item)}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.nombre_comercial || item.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <span><strong>CÓD:</strong> {item.codigo_interno || item.sku}</span>
                            <span><strong>STOCK:</strong> <span style={{ color: (item.stock_actual || 0) <= 0 ? 'var(--clr-danger)' : 'var(--clr-success)', fontWeight: 700 }}>{item.stock_actual || 0}</span></span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                          <div style={{ fontWeight: 800, color: 'var(--clr-primary-500)', fontSize: '14px' }}>{fmt(item.unit_price)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {repuestos.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '13px' }}>
                No hay repuestos ni insumos agregados.
              </p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ width: 80 }}>Origen</th>
                      <th style={{ textAlign: 'right' }}>Cantidad</th>
                      <th>Unidad</th>
                      <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repuestos.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.descripcion}</td>
                        <td>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 8, background: r.origen === 'PLANTILLA_PM' ? 'rgba(67,56,202,0.1)' : 'rgba(245,158,11,0.1)', color: r.origen === 'PLANTILLA_PM' ? '#4338ca' : '#f59e0b', fontWeight: 700 }}>
                            {r.origen === 'PLANTILLA_PM' ? 'PLANTILLA' : 'MANUAL'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            style={{ width: 80, textAlign: 'right', padding: '4px 8px', fontSize: '13px' }}
                            defaultValue={r.cantidad}
                            onChange={e => handleRepChange(r.id, 'cantidad', e.target.value)}
                            disabled={isLiqOrClosed}
                          />
                        </td>
                        <td>{r.unidad}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            className="input"
                            style={{ width: 120, textAlign: 'right', padding: '4px 8px', fontSize: '13px' }}
                            defaultValue={r.precio_unitario}
                            onChange={e => handleRepChange(r.id, 'precio_unitario', e.target.value)}
                            disabled={isLiqOrClosed}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(r.total)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {!isLiqOrClosed && (
                              <>
                                <button
                                  className="btn btn--ghost btn--sm"
                                  onClick={() => handleSaveRep(r.id)}
                                  title="Guardar cambios"
                                >
                                  <Save size={12} />
                                </button>
                                <button
                                  className="btn btn--ghost btn--sm"
                                  style={{ color: 'var(--clr-danger)' }}
                                  onClick={() => delRepMut.mutate(r.id)}
                                  title="Remover"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ textAlign: 'right', marginTop: '0.75rem', fontWeight: 700, color: 'var(--clr-primary-400)' }}>
              Total Repuestos: {fmt(totalRep)}
            </div>
          </div>
        ) : (
          /* PREVIEW IN CREATION MODE */
          form.tipo_mantenimiento === 'PREVENTIVO' && plantillaData?.insumos?.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={18} color="var(--clr-primary-400)" /> Insumos Sugeridos
              </h2>
              <div style={{ marginBottom: '1rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Se cargarán estos insumos en la OT. Podrás editar sus cantidades tras guardar.
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th style={{ textAlign: 'right' }}>Cant. Sugerida</th>
                      <th>Unidad</th>
                      <th style={{ textAlign: 'right' }}>Precio Ref.</th>
                      <th>Stock Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plantillaData.insumos.map(i => (
                      <tr key={i.id}>
                        <td style={{ fontWeight: 600 }}>{i.descripcion_display}</td>
                        <td style={{ textAlign: 'right' }}>{i.cantidad_sugerida}</td>
                        <td>{i.unidad}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(i.precio_unitario)}</td>
                        <td>
                          <span style={{ color: parseFloat(i.stock_actual) < parseFloat(i.cantidad_sugerida) ? 'var(--clr-danger)' : 'var(--clr-success)', fontWeight: 600 }}>
                            {i.stock_actual}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* ═══ SECCIÓN D: Liquidación ═══ */}
        {isEditing && !isLiqOrClosed && (
          <div className="card" style={{
            border: '2px solid rgba(34,197,94,0.3)',
            background: 'linear-gradient(135deg, var(--bg-surface), rgba(34,197,94,0.03))',
            display: 'flex', flexDirection: 'column', gap: '1.5rem'
          }}>
            <OTFirmadaUploader
              otId={id}
              otConsecutivo={otData?.consecutivo}
              otFirmadaActual={otFirmadaData}
              onUploadSuccess={() => qc.invalidateQueries({ queryKey: ['ot-firmada', id] })}
            />

            {clientQuotes && clientQuotes.length > 0 && (
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <DollarSign size={16} color="#4338ca" /> Cotización Cliente Asociada (Opcional)
                </label>
                <select className="input" value={selectedQuoteId} onChange={(e) => setSelectedQuoteId(e.target.value)}>
                  <option value="">-- Sin Cotización (Usar repuestos manuales y catálogo) --</option>
                  {clientQuotes.map(q => (
                    <option key={q.id} value={q.id}>{q.quote_number} - {fmt(q.total_amount)}</option>
                  ))}
                </select>
                {selectedQuoteDetails && (
                  <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                    <strong>Ítems de la Cotización (Snapshot):</strong>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {selectedQuoteDetails.items?.map(it => (
                        <li key={it.id}>{it.quantity}x {it.description} - {fmt(it.unit_price)}</li>
                      ))}
                    </ul>
                    <div style={{ marginTop: '0.5rem', color: '#64748b' }}>
                      * Al liquidar, estos ítems se descontarán automáticamente del inventario y la cotización pasará a estado Aceptada.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={18} color="#22c55e" /> Resumen de Liquidación
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.375rem 2rem', fontSize: '14px', maxWidth: 400 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Mano de Obra</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totalMO)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Total Repuestos</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totalRep)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(subtotal)}</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                  Impuesto
                  <input type="number" className="input" style={{ width: 60, padding: '2px 6px', fontSize: '12px' }} value={liqImpuesto} onChange={e => setLiqImpuesto(parseFloat(e.target.value) || 0)} /> %
                </div>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(impValor)}</span>

                <span style={{ fontSize: '18px', fontWeight: 800, color: '#22c55e' }}>TOTAL FINAL</span>
                <span style={{ textAlign: 'right', fontSize: '18px', fontWeight: 800, color: '#22c55e' }}>{fmt(totalFinal)}</span>
              </div>

              <div className="input-group" style={{ marginTop: '1rem' }}>
                <label className="input-label">Notas de liquidación</label>
                <textarea className="input" rows={2} value={liqNotas} onChange={e => setLiqNotas(e.target.value)} placeholder="Observaciones del proceso de liquidación..." />
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                {!showLiquidar ? (
                  <button className="btn btn--lg" style={{ background: '#22c55e', color: 'white', fontWeight: 700, width: '100%' }} onClick={() => setShowLiquidar(true)}>
                    <DollarSign size={18} /> Liquidar Servicio
                  </button>
                ) : (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '1rem', textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
                      ⚠️ ¿Confirmar liquidación? Esta acción descargará el inventario y no podrá revertirse.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button className="btn btn--secondary" onClick={() => setShowLiquidar(false)}>Cancelar</button>
                      <button
                        className="btn btn--lg"
                        style={{ background: '#22c55e', color: 'white', fontWeight: 700 }}
                        onClick={() => liquidarMut.mutate({ notas_liquidacion: liqNotas, impuesto_pct: liqImpuesto, quote_id: selectedQuoteId || null, quote_snapshot: selectedQuoteDetails || null })}
                        disabled={liquidarMut.isPending}
                      >
                        {liquidarMut.isPending ? 'Liquidando...' : '✓ Confirmar Liquidación'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

