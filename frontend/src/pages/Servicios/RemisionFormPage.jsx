import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Lock, Plus, Minus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Modal } from '../../components/common/Modal';
import { ContactForm } from '../../components/Contacts/ContactForm';
import { usePermissions } from '../../contexts/PermissionsContext';
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
  horas_ordinarias: 0, valor_hora_ordinaria: 0, horas_recargo: 0, valor_hora_recargo: 0,
  total_bruto: 0, iva_pct: 0, aplica_iva: false, iva_valor: 0, descuentos: 0, total_neto: 0,
  observaciones: '',
  estado: 'BORRADOR',
  bonificacion_hora: 0,
  items: [],
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

/**
 * Festivos oficiales de Colombia 2026.
 * Domingos y festivos = todo recargo (125% del valor hora).
 */
const FESTIVOS_COLOMBIA_2026 = [
  '2026-01-01', // Año Nuevo
  '2026-01-12', // Reyes Magos
  '2026-03-23', // Día de San José
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajo
  '2026-05-18', // Ascensión del Señor
  '2026-06-08', // Corpus Christi
  '2026-06-15', // Sagrado Corazón
  '2026-06-29', // San Pedro y San Pablo
  '2026-07-20', // Día de la Independencia
  '2026-08-07', // Batalla de Boyacá
  '2026-08-17', // Asunción de la Virgen
  '2026-10-12', // Día de la Raza
  '2026-11-02', // Todos los Santos
  '2026-11-16', // Independencia de Cartagena
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
];

/**
 * Calcula el desglose de horas ordinarias vs recargo según horario laboral.
 * HORARIO NORMAL:
 *   Lunes–Viernes: 7:00 AM – 5:00 PM
 *   Sábado:        7:00 AM – 12:00 M
 * RECARGO (125%):
 *   Domingos, festivos = todo el día es recargo.
 *   Cualquier hora fuera del horario normal = recargo.
 */
function calcularDesgloseHoras(fechaServicio, salidaStr, llegadaStr) {
  if (!salidaStr || !llegadaStr || !fechaServicio) return { ordinarias: 0, recargo: 0, total: 0 };
  const ts = (t) => t.length > 5 ? t.substring(0, 5) : t;
  const s = new Date(`1970-01-01T${ts(salidaStr)}:00`);
  const l = new Date(`1970-01-01T${ts(llegadaStr)}:00`);
  if (isNaN(s.getTime()) || isNaN(l.getTime())) return { ordinarias: 0, recargo: 0, total: 0 };
  if (l < s) l.setDate(l.getDate() + 1);

  const fecha = new Date(fechaServicio + 'T12:00:00');
  const dayOfWeek = fecha.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  const esFestivo = FESTIVOS_COLOMBIA_2026.includes(fechaServicio);
  const esDomingoOFestivo = dayOfWeek === 0 || esFestivo;

  // Si es domingo o festivo → todo es recargo
  if (esDomingoOFestivo) {
    const totalMin = Math.round((l - s) / 60000);
    let hRec = Math.round((totalMin / 60) * 100) / 100;
    if (hRec > 0 && hRec < 1) hRec = 1;
    return { ordinarias: 0, recargo: hRec, total: hRec };
  }

  // Horario normal según día
  const normalStart = 7;  // 7:00 AM
  const normalEnd = dayOfWeek === 6 ? 12 : 17; // Sáb: 12M, Lun-Vie: 5PM

  let ordMin = 0, recMin = 0;
  let current = new Date(s);
  while (current < l) {
    const hora = current.getHours();
    if (hora < normalStart || hora >= normalEnd) {
      recMin++;
    } else {
      ordMin++;
    }
    current.setMinutes(current.getMinutes() + 1);
  }

  let hOrd = Math.round((ordMin / 60) * 100) / 100;
  let hRec = Math.round((recMin / 60) * 100) / 100;
  
  // Garantizar cobro mínimo de 1 hora
  const totalRaw = parseFloat((hOrd + hRec).toFixed(2));
  if (totalRaw > 0 && totalRaw < 1) {
    // Escalar proporcionalmente para que la suma sea 1
    hOrd = Math.round((hOrd / totalRaw) * 100) / 100;
    hRec = parseFloat((1 - hOrd).toFixed(2));
  }

  return { ordinarias: hOrd, recargo: hRec, total: parseFloat((hOrd + hRec).toFixed(2)) };
}

export function RemisionFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const qc = useQueryClient();
  const isEditing = !!id;

  const [form, setForm] = React.useState(EMPTY);
  const [equiposFiltrados, setEquiposFiltrados] = React.useState([]);
  const [equiposExternosFiltrados, setEquiposExternosFiltrados] = React.useState([]);
  const [equipoExterno, setEquipoExterno] = React.useState(false);
  const [equipoInicializado, setEquipoInicializado] = React.useState(false);
  const [catalogoMap, setCatalogoMap] = React.useState({});
  const [horasManual, setHorasManual] = React.useState(false);
  const [currentEstado, setCurrentEstado] = React.useState(null);
  const [estadoManual, setEstadoManual] = React.useState(false);

  const [isContactModalOpen, setIsContactModalOpen] = React.useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = React.useState(false);
  const [newAddressForm, setNewAddressForm] = React.useState({ address: '', notes: '' });

  const { esAdmin } = usePermissions();

  const isReadOnly = isEditing && READ_ONLY_ESTADOS.includes(currentEstado) && !esAdmin();

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
        if (existingData.operarios.length > 1) {
          f.operario_2_id = existingData.operarios[1].empleado_id;
        } else if (existingData.segundo_hora_salida_cargar || existingData.segundo_fecha_acordada) {
          // Si usaron al mismo operario 2 veces, la DB solo guarda 1 por el UNIQUE
          f.operario_2_id = existingData.operarios[0].empleado_id;
        } else {
          f.operario_2_id = '';
        }
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
    if (isEditing && form.equipo_id && !equipoExterno) {
      params.include_id = form.equipo_id;
    }

    api.get('/equipos/by-company/cargar', { params })
      .then(res => setEquiposFiltrados(res.data?.data || res.data || []))
      .catch(() => setEquiposFiltrados([]));
  }, [isEditing, form.equipo_id, equipoExterno]);

  // ─── Cargar equipos externos ──────
  React.useEffect(() => {
    if (!equipoExterno && (!isEditing || !form.equipo_id)) return;
    
    const params = { estado: 'OPERATIVO' };
    if (isEditing && form.equipo_id && equipoExterno) {
      params.include_id = form.equipo_id;
    }
    
    api.get('/equipos/externos', { params })
      .then(res => setEquiposExternosFiltrados(res.data?.data || res.data || []))
      .catch(() => setEquiposExternosFiltrados([]));
  }, [equipoExterno, isEditing, form.equipo_id]);

  // ─── Detectar si el equipo guardado es externo ──────
  React.useEffect(() => {
    if (isEditing && existingData && existingData.equipo_id && !equipoInicializado && equiposFiltrados.length > 0) {
      const isInternal = equiposFiltrados.some(e => String(e.id) === String(existingData.equipo_id));
      if (!isInternal) {
        setEquipoExterno(true);
      }
      setEquipoInicializado(true);
    }
  }, [isEditing, existingData, equiposFiltrados, equipoInicializado]);

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
    const hasService = form.catalogo_servicio_id || (form.items && form.items.length > 0 && form.items[0].catalogo_servicio_id);
    const hasObligatorios = form.company_id && hasService && form.equipo_id && form.fecha_servicio;
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
        setForm(prev => ({ ...prev, numero_maquina: eq.serial }));
        
        const isDifferentEquipment = isEditing && existingData && existingData.equipo_id !== form.equipo_id;
        if (!isEditing || isDifferentEquipment) {
          api.get(`/servicios/last-horometro/${form.equipo_id}`)
            .then(res => {
              const lastH = res.data?.data;
              if (lastH !== undefined && lastH !== null) {
                setForm(prev => ({ ...prev, horometro_salida: lastH }));
              } else if (eq.horometro_actual !== undefined && eq.horometro_actual !== null) {
                // Fallback al del maestro si no hay remisiones previas
                setForm(prev => ({ ...prev, horometro_salida: eq.horometro_actual }));
              }
            })
            .catch(() => {
              if (eq.horometro_actual !== undefined && eq.horometro_actual !== null) {
                setForm(prev => ({ ...prev, horometro_salida: eq.horometro_actual }));
              }
            });
        }
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

    const totalHorasCalc = totalHoras > 0 ? Math.max(1, totalHoras) : null;

    setForm(prev => {
      const updated = { ...prev };

      if (totalHorasCalc !== null) {
        updated.cantidad_horas = totalHorasCalc;
      } else if (!prev.cantidad_horas || prev.cantidad_horas < 1) {
        updated.cantidad_horas = 1;
      }

      if (totalHorasCalc !== null && updated.items) {
        let indexHora = 0;
        updated.items = updated.items.map(it => {
          if ((it.unidad || '').trim().toLowerCase() === 'hora') {
            let h = 1;
            if (indexHora === 0) h = horas1 > 0 ? Math.max(1, Math.round(horas1 * 100) / 100) : 1;
            else if (indexHora === 1) h = horas2 > 0 ? Math.max(1, Math.round(horas2 * 100) / 100) : 1;
            indexHora++;
            return { ...it, cantidad: h };
          }
          return it;
        });
      }

      return updated;
    });
  }, [
    form.hora_salida_cargar, form.hora_llegada_cargar,
    form.horometro_salida, form.horometro_regreso,
    form.segundo_hora_salida_cargar, form.segundo_hora_llegada_cargar,
    form.segundo_horometro_salida, form.segundo_horometro_regreso,
    form.operario_2_id, horasManual, form.fecha_servicio
  ]);

  // ─── Auto-calcular totales (IVA por ítem + recargo horas extras) ──
  React.useEffect(() => {
    let sumSubtotales = 0;
    let sumIva = 0;
    let sumDescuentos = 0;
    let sumCantHoras = 0;
    let sumValorHoras = 0;

    let d1 = { ordinarias: 0, recargo: 0 };
    if (form.hora_salida_cargar && form.hora_llegada_cargar && form.fecha_servicio) {
      d1 = calcularDesgloseHoras(form.fecha_servicio, form.hora_salida_cargar, form.hora_llegada_cargar);
    }
    let d2 = { ordinarias: 0, recargo: 0 };
    const fecha2 = form.segundo_fecha_acordada || form.fecha_servicio;
    if (form.operario_2_id && form.segundo_hora_salida_cargar && form.segundo_hora_llegada_cargar && fecha2) {
      d2 = calcularDesgloseHoras(fecha2, form.segundo_hora_salida_cargar, form.segundo_hora_llegada_cargar);
    }

    const totalOrdHours = parseFloat((d1.ordinarias + d2.ordinarias).toFixed(2));
    const totalRecHours = parseFloat((d1.recargo + d2.recargo).toFixed(2));

    let indexHora = 0;
    let totalOrdValue = 0;
    let totalRecValueBase = 0;
    let totalExtraRecargo = 0;

    let d1Values = { v: 0 };
    let d2Values = { v: 0 };

    (form.items || []).forEach(it => {
      const brutoItem = Math.round((parseFloat(it.cantidad) || 0) * (parseFloat(it.valor_unitario) || 0));
      const descItem = Math.round(brutoItem * (parseFloat(it.descuento_pct) || 0) / 100);
      const subNetoItem = brutoItem - descItem;

      sumSubtotales += brutoItem;
      sumDescuentos += descItem;

      if (it.aplica_iva) {
        sumIva += Math.round(subNetoItem * 0.19);
      }

      if ((it.unidad || '').trim().toLowerCase() === 'hora') {
        sumCantHoras += parseFloat(it.cantidad) || 0;
        sumValorHoras += brutoItem;
        const v = parseFloat(it.valor_unitario) || 0;
        if (indexHora === 0) {
          totalOrdValue += d1.ordinarias * v;
          totalRecValueBase += d1.recargo * v;
          totalExtraRecargo += d1.recargo * (v * 0.25);
          d1Values.v = v;
        } else if (indexHora === 1) {
          totalOrdValue += d2.ordinarias * v;
          totalRecValueBase += d2.recargo * v;
          totalExtraRecargo += d2.recargo * (v * 0.25);
          d2Values.v = v;
        }
        indexHora++;
      }
    });

    const avgOrdRate = totalOrdHours > 0 ? totalOrdValue / totalOrdHours : 0;
    const avgRecRate = totalRecHours > 0 ? (totalRecValueBase * 1.25) / totalRecHours : 0;
    const recargoExtra = Math.round(totalExtraRecargo);
    const netoFinal = sumSubtotales - sumDescuentos + sumIva + recargoExtra;

    setForm(prev => ({
      ...prev,
      cantidad_horas: sumCantHoras,
      valor_hora: sumValorHoras,
      horas_ordinarias: totalOrdHours,
      horas_recargo: totalRecHours,
      valor_hora_ordinaria: Math.round(avgOrdRate),
      valor_hora_recargo: Math.round(avgRecRate),
      descuentos: sumDescuentos,
      total_bruto: Math.round(sumSubtotales),
      iva_valor: Math.round(sumIva),
      total_neto: Math.round(netoFinal),
      _totalExtraRecargo: recargoExtra,
      _desgloseDetalle: {
        d1: { ord: d1.ordinarias, rec: d1.recargo, v: d1Values.v },
        d2: { ord: d2.ordinarias, rec: d2.recargo, v: d2Values.v }
      }
    }));
  }, [
    form.items,
    form.hora_salida_cargar, form.hora_llegada_cargar, form.fecha_servicio,
    form.operario_2_id, form.segundo_hora_salida_cargar, form.segundo_hora_llegada_cargar, form.segundo_fecha_acordada
  ]);

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

  // Helper: calcula horas entre dos campos de hora (HH:MM)
  const calcHorasFromTimesInline = (salida, llegada) => {
    if (!salida || !llegada) return 0;
    const ts = (t) => t.length > 5 ? t.substring(0, 5) : t;
    const s = new Date(`1970-01-01T${ts(salida)}:00`);
    const l = new Date(`1970-01-01T${ts(llegada)}:00`);
    if (isNaN(s.getTime()) || isNaN(l.getTime())) return 0;
    if (l < s) l.setDate(l.getDate() + 1); // cruza medianoche
    return Math.max(0, (l - s) / (1000 * 60 * 60));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'estado') setEstadoManual(true);

    // Se permite que el operario inicial y el segundo operario sean el mismo,
    // ya que puede realizar dos servicios separados.


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

    // ── Cálculo inline de horas al cambiar hora_salida_cargar o hora_llegada_cargar ──
    // Actualiza cantidad_horas Y la cantidad de ítems con unidad "hora" en un solo setState
    if (name === 'hora_salida_cargar' || name === 'hora_llegada_cargar') {
      setForm(prev => {
        const updated = { ...prev, [name]: value };

        const horaSalida = name === 'hora_salida_cargar' ? value : prev.hora_salida_cargar;
        const horaLlegada = name === 'hora_llegada_cargar' ? value : prev.hora_llegada_cargar;

        if (horaSalida && horaLlegada) {
          let horas1 = calcHorasFromTimesInline(horaSalida, horaLlegada);

          let horas2 = 0;
          if (prev.operario_2_id && prev.segundo_hora_salida_cargar && prev.segundo_hora_llegada_cargar) {
            horas2 = calcHorasFromTimesInline(prev.segundo_hora_salida_cargar, prev.segundo_hora_llegada_cargar);
          }

          const totalHoras = parseFloat((horas1 + horas2).toFixed(2));
          const totalHorasCalc = totalHoras > 0 ? Math.max(1, totalHoras) : null;

          if (totalHorasCalc !== null) {
            updated.cantidad_horas = totalHorasCalc;
            if (updated.items) {
              let indexHora = 0;
              updated.items = updated.items.map(it => {
                if ((it.unidad || '').trim().toLowerCase() === 'hora') {
                  let h = 1;
                  if (indexHora === 0) h = horas1 > 0 ? Math.max(1, Math.round(horas1 * 100) / 100) : 1;
                  else if (indexHora === 1) h = horas2 > 0 ? Math.max(1, Math.round(horas2 * 100) / 100) : 1;
                  indexHora++;
                  return { ...it, cantidad: h };
                }
                return it;
              });
            }
          }
        }

        return updated;
      });
      return;
    }

    // ── Cálculo inline para horas del segundo operario ──
    if (name === 'segundo_hora_salida_cargar' || name === 'segundo_hora_llegada_cargar') {
      setForm(prev => {
        const updated = { ...prev, [name]: value };

        const seg_salida = name === 'segundo_hora_salida_cargar' ? value : prev.segundo_hora_salida_cargar;
        const seg_llegada = name === 'segundo_hora_llegada_cargar' ? value : prev.segundo_hora_llegada_cargar;

        let horas1 = 0;
        if (prev.hora_salida_cargar && prev.hora_llegada_cargar) {
          horas1 = calcHorasFromTimesInline(prev.hora_salida_cargar, prev.hora_llegada_cargar);
        }

        let horas2 = 0;
        if (prev.operario_2_id && seg_salida && seg_llegada) {
          horas2 = calcHorasFromTimesInline(seg_salida, seg_llegada);
        }

        const totalHoras = parseFloat((horas1 + horas2).toFixed(2));
        const totalHorasCalc = totalHoras > 0 ? Math.max(1, totalHoras) : null;

        if (totalHorasCalc !== null) {
          updated.cantidad_horas = totalHorasCalc;
          if (updated.items) {
            let indexHora = 0;
            updated.items = updated.items.map(it => {
              if ((it.unidad || '').trim().toLowerCase() === 'hora') {
                let h = 1;
                if (indexHora === 0) h = horas1 > 0 ? Math.max(1, Math.round(horas1 * 100) / 100) : 1;
                else if (indexHora === 1) h = horas2 > 0 ? Math.max(1, Math.round(horas2 * 100) / 100) : 1;
                indexHora++;
                return { ...it, cantidad: h };
              }
              return it;
            });
          }
        }

        return updated;
      });
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

  // --- Item management helpers ---
  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...(prev.items || []), { catalogo_servicio_id: '', descripcion: '', unidad: '', cantidad: 1, valor_unitario: 0, descuento_pct: 0, aplica_iva: false }]
    }));
  };

  const removeItem = (idx) => {
    setForm(prev => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== idx)
    }));
  };

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const newItems = [...(prev.items || [])];
      newItems[idx] = { ...newItems[idx], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const requiresEquipo = React.useMemo(() => {
    if (!form.items || form.items.length === 0) return true;
    return form.items.some(it => {
      if (!it.catalogo_servicio_id) return false;
      const svc = catalogoItems.find(s => String(s.id) === String(it.catalogo_servicio_id));
      if (!svc) return false;
      const nombre = (svc.nombre || '').toUpperCase();
      return nombre.includes('MONTACARGA') ||
        nombre.includes('ELEVADOR') ||
        nombre.includes('CAMIONETA') ||
        nombre.includes('VEHICULO') ||
        nombre.includes('VEHÍCULO');
    });
  }, [form.items, catalogoItems]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.company_id || (!form.catalogo_servicio_id && (!form.items || form.items.length === 0)) || (requiresEquipo && !form.equipo_id) || !form.fecha_servicio) {
      toast.error('Faltan campos obligatorios');
      return;
    }
    // Validar horómetro si el equipo tiene información registrada
    if (form.equipo_id) {
      const listaEquipos = equipoExterno ? equiposExternosFiltrados : equiposFiltrados;
      const eq = listaEquipos.find(e => String(e.id) === String(form.equipo_id));
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

        <form onSubmit={handleSubmit} style={{ maxWidth: 1400 }}>

          {/* — Información General — */}
          <p style={section}>Información General</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
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
            <div style={{ gridColumn: '1 / span 3' }}>
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
              {/* — Ítems de Servicio — */}
              <div style={{ overflow: 'visible', marginBottom: '0.75rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ ...label, display: 'table-cell', marginBottom: 0, padding: '0.5rem 0.75rem', textAlign: 'left', width: '22%' }}>Servicio *</th>
                      <th style={{ ...label, display: 'table-cell', marginBottom: 0, padding: '0.5rem 0.75rem', textAlign: 'left', width: '25%' }}>Descripción</th>
                      <th style={{ ...label, display: 'table-cell', marginBottom: 0, padding: '0.5rem 0.75rem', textAlign: 'center', width: '8%' }}>Unidad</th>
                      <th style={{ ...label, display: 'table-cell', marginBottom: 0, padding: '0.5rem 0.75rem', textAlign: 'center', width: '6%' }}>Cant.</th>
                      <th style={{ ...label, display: 'table-cell', marginBottom: 0, padding: '0.5rem 0.75rem', textAlign: 'right', width: '11%' }}>Valor Unit.</th>
                      <th style={{ ...label, display: 'table-cell', marginBottom: 0, padding: '0.5rem 0.75rem', textAlign: 'center', width: '6%' }}>Desc.(%)</th>
                      <th style={{ ...label, display: 'table-cell', marginBottom: 0, padding: '0.5rem 0.75rem', textAlign: 'center', width: '5%' }}>+IVA</th>
                      <th style={{ ...label, display: 'table-cell', marginBottom: 0, padding: '0.5rem 0.75rem', textAlign: 'right', width: '13%' }}>Subtotal</th>
                      <th style={{ width: '4%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(form.items || []).map((it, idx) => {
                      const brutoItem = Math.round((parseFloat(it.cantidad) || 0) * (parseFloat(it.valor_unitario) || 0));
                      const descItem = Math.round(brutoItem * (parseFloat(it.descuento_pct) || 0) / 100);
                      const sub = brutoItem - descItem;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.4rem 0.5rem' }}>
                            <SearchableSelect
                              value={it.catalogo_servicio_id}
                              onChange={(val) => {
                                const sid = val;
                                const svc = catalogoItems.find(s => String(s.id) === String(sid));
                                updateItem(idx, 'catalogo_servicio_id', sid);
                                if (svc) {
                                  updateItem(idx, 'valor_unitario', parseFloat(svc.precio_venta || svc.precio_servicio || svc.precio_base || 0));
                                  updateItem(idx, 'unidad', svc.unidad_cobro || svc.unidad || 'hora');
                                }
                              }}
                              fetchFn={async (term) => {
                                const lower = term.toLowerCase();
                                return catalogoItems.filter(s => s.nombre?.toLowerCase().includes(lower) || s.codigo?.toLowerCase().includes(lower));
                              }}
                              getOptionLabel={s => `[${s.codigo}] ${s.nombre}`}
                              renderOption={(s, { isHighlighted }) => (
                                <div style={{ fontWeight: isHighlighted ? 700 : 500 }}>
                                  [{s.codigo}] {s.nombre}
                                </div>
                              )}
                              placeholder="Seleccionar..."
                              minSearchLength={0}
                              disabled={isReadOnly}
                              initialItem={catalogoItems.find(s => String(s.id) === String(it.catalogo_servicio_id)) || (it.servicio_nombre ? { id: it.catalogo_servicio_id, codigo: it.servicio_codigo || 'N/A', nombre: it.servicio_nombre } : null)}
                            />
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>
                            <input
                              type="text"
                              className="input"
                              style={{ width: '100%', fontSize: '12px' }}
                              value={it.descripcion}
                              onChange={e => updateItem(idx, 'descripcion', e.target.value)}
                              placeholder="Descripción del servicio..."
                              disabled={isReadOnly}
                            />
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>
                            <input
                              type="text"
                              className="input"
                              style={{ width: '100%', textAlign: 'center', fontSize: '12px', MozAppearance: 'textfield', appearance: 'textfield' }}
                              value={it.unidad ?? ''}
                              onChange={e => updateItem(idx, 'unidad', e.target.value)}
                              placeholder="hora"
                              disabled={isReadOnly}
                            />
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>
                            <input
                              type="text"
                              className="input"
                              style={{ width: '100%', textAlign: 'center', fontSize: '12px', MozAppearance: 'textfield', appearance: 'textfield' }}
                              value={it.cantidad}
                              onChange={e => updateItem(idx, 'cantidad', e.target.value)}
                              disabled={isReadOnly}
                            />
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>
                            <input
                              type="text"
                              className="input"
                              style={{ width: '100%', textAlign: 'right', fontSize: '12px', MozAppearance: 'textfield', appearance: 'textfield' }}
                              value={it.valor_unitario}
                              onChange={e => updateItem(idx, 'valor_unitario', e.target.value)}
                              disabled={isReadOnly}
                            />
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              className="input"
                              style={{ width: '100%', textAlign: 'center', fontSize: '12px' }}
                              value={it.descuento_pct ?? 0}
                              onChange={e => updateItem(idx, 'descuento_pct', e.target.value)}
                              disabled={isReadOnly}
                            />
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={it.aplica_iva}
                              onChange={e => updateItem(idx, 'aplica_iva', e.target.checked)}
                              disabled={isReadOnly}
                              style={{ width: 16, height: 16 }}
                            />
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600, fontSize: '13px' }}>
                            {formatCOP(sub)}
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                            {!isReadOnly && (
                              <button
                                type="button"
                                className="btn btn--ghost"
                                style={{ padding: '0.3rem', color: 'var(--clr-danger-500)' }}
                                onClick={() => removeItem(idx)}
                                title="Eliminar"
                              >
                                <Minus size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!isReadOnly && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ marginTop: '0.5rem', fontSize: '12px' }}
                    onClick={addItem}
                  >
                    <Plus size={14} /> Agregar Ítem de Servicio
                  </button>
                )}
              </div>
              {(() => {
                const totalHorasItems = (form.items || []).reduce((acc, it) => {
                  if ((it.unidad || '').trim().toLowerCase() === 'hora') {
                    return acc + (parseFloat(it.cantidad) || 0);
                  }
                  return acc;
                }, 0);
              })()}
            </div>
            <div style={{ gridColumn: '1 / 3' }}>
              <label style={label}>Equipo {requiresEquipo ? '*' : '(Opcional)'}</label>
              {isReadOnly ? (
                <input className="input" style={{ width: '100%' }} disabled value={`${existingData?.equipo_marca || ''} ${existingData?.equipo_modelo || ''} — ${existingData?.equipo_serial || ''}`} />
              ) : (
                <>
                  {!equipoExterno ? (
                    <SearchableSelect
                      name="equipo_id"
                      value={form.equipo_id}
                      onChange={(val) => handleChange({ target: { name: 'equipo_id', value: val } })}
                      fetchFn={async (term) => {
                        const lower = term.toLowerCase();
                        return equiposFiltrados.filter(e => e.marca?.toLowerCase().includes(lower) || e.serie?.toLowerCase().includes(lower) || e.serial?.toLowerCase().includes(lower));
                      }}
                      getOptionLabel={e => `${e.marca} - ${e.serie || e.serial || '—'}`}
                      renderOption={(e, { isHighlighted }) => (
                        <div style={{ fontWeight: isHighlighted ? 700 : 500 }}>
                          {e.marca} - {e.serie || e.serial || '—'}
                        </div>
                      )}
                      placeholder="Seleccionar equipo interno..."
                      minSearchLength={0}
                      disabled={isReadOnly}
                      initialItem={equiposFiltrados.find(e => String(e.id) === String(form.equipo_id))}
                    />
                  ) : (
                    <SearchableSelect
                      name="equipo_id"
                      value={form.equipo_id}
                      onChange={(val) => handleChange({ target: { name: 'equipo_id', value: val } })}
                      fetchFn={async (term) => {
                        const lower = term.toLowerCase();
                        return equiposExternosFiltrados.filter(e => 
                          e.marca?.toLowerCase().includes(lower) || 
                          e.serie?.toLowerCase().includes(lower) || 
                          e.serial?.toLowerCase().includes(lower) ||
                          e.empresa_nombre?.toLowerCase().includes(lower)
                        );
                      }}
                      getOptionLabel={e => `${e.empresa_nombre} — ${e.marca} - ${e.serie || e.serial || '—'}`}
                      renderOption={(e, { isHighlighted }) => (
                        <div style={{ fontWeight: isHighlighted ? 700 : 500 }}>
                          {e.empresa_nombre} — {e.marca} - {e.serie || e.serial || '—'}
                        </div>
                      )}
                      placeholder="Seleccionar equipo externo..."
                      minSearchLength={0}
                      disabled={isReadOnly}
                      initialItem={equiposExternosFiltrados.find(e => String(e.id) === String(form.equipo_id))}
                    />
                  )}
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      id="toggle-equipo-externo"
                      checked={equipoExterno}
                      onChange={(e) => {
                        setEquipoExterno(e.target.checked);
                        handleChange({ target: { name: 'equipo_id', value: '' } });
                      }}
                      disabled={isReadOnly}
                      style={{ cursor: isReadOnly ? 'not-allowed' : 'pointer' }}
                    />
                    <label htmlFor="toggle-equipo-externo" style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: isReadOnly ? 'not-allowed' : 'pointer', userSelect: 'none' }}>Usar equipo externo</label>
                  </div>
                </>
              )}
            </div>
            <div>
              <label style={label}>No. Máquina</label>
              <input placeholder="Ej: 73" {...inputProps('numero_maquina')} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={label}>Horómetro Salida</label>
                <input
                  type="number" step="0.01" name="horometro_salida" className="input" style={{ width: '100%' }}
                  value={form.horometro_salida}
                  onChange={isReadOnly ? undefined : handleHorometroChange}
                  readOnly={isReadOnly}
                  placeholder="Ej: 1250.5"
                />
              </div>
              <div>
                <label style={label}>Horómetro Regreso</label>
                <input
                  type="number" step="0.01" name="horometro_regreso" className="input" style={{ width: '100%' }}
                  value={form.horometro_regreso}
                  onChange={isReadOnly ? undefined : handleHorometroChange}
                  readOnly={isReadOnly}
                  placeholder="Ej: 1252.42"
                />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={label}>Operario Inicial</label>
                {isReadOnly ? (
                  <input className="input" style={{ width: '100%' }} disabled value={existingData?.operarios?.find(o => String(o.empleado_id) === String(form.operario_id))?.full_name || '—'} />
                ) : (
                  <select name="operario_id" className="input" style={{ width: '100%' }} value={form.operario_id} onChange={handleChange}>
                    <option value="">Seleccionar operario...</option>
                    {operariosDisp.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label style={label}>Segundo Operario (Opcional)</label>
                {isReadOnly ? (
                  <input className="input" style={{ width: '100%' }} disabled value={existingData?.operarios?.find(o => String(o.empleado_id) === String(form.operario_2_id))?.full_name || '—'} />
                ) : (
                  <select name="operario_2_id" className="input" style={{ width: '100%' }} value={form.operario_2_id || ''} onChange={handleChange}>
                    <option value="">Seleccionar segundo operario...</option>
                    {operariosDisp.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* — Tiempos del Servicio (solo visible si hay ítem OPERARIO) — */}
          {(() => {
            const hasOperario = (form.items || []).some(it => {
              const svc = catalogoItems.find(s => String(s.id) === String(it.catalogo_servicio_id));
              return svc && (svc.nombre || '').toUpperCase().includes('OPERARIO');
            });
            if (!hasOperario) return null;
            return (
              <>
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
                      <input type="text" placeholder="HH:MM" {...inputProps(name)} />
                    </div>
                  ))}
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
                          <input type="text" placeholder="HH:MM" {...inputProps(name)} />
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
              </>
            );
          })()}

          {/* — Desglose de Horas y Totales — */}
          <p style={section}>Desglose de Horas y Totales</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Tabla de desglose de horas */}
            <div>
              <table className="table" style={{ margin: 0, fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Horario</th>
                    <th>Detalle por Operario</th>
                    <th>Horas</th>
                    <th>Valor Promedio</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>ORDINARIA</strong></td>
                    <td style={{ fontSize: '11px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
                        {form._desgloseDetalle?.d1?.ord > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '3px 6px', borderRadius: '4px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Op. 1</span>
                            <span style={{ color: 'var(--text-muted)' }}>{form._desgloseDetalle.d1.ord} h &times; <span style={{ color: 'var(--text-primary)' }}>{formatCOP(form._desgloseDetalle.d1.v)}</span></span>
                          </div>
                        )}
                        {form._desgloseDetalle?.d2?.ord > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '3px 6px', borderRadius: '4px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Op. 2</span>
                            <span style={{ color: 'var(--text-muted)' }}>{form._desgloseDetalle.d2.ord} h &times; <span style={{ color: 'var(--text-primary)' }}>{formatCOP(form._desgloseDetalle.d2.v)}</span></span>
                          </div>
                        )}
                        {(!form._desgloseDetalle?.d1?.ord && !form._desgloseDetalle?.d2?.ord) && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{form.horas_ordinarias || 0}</td>
                    <td style={{ textAlign: 'center' }}>{formatCOP(form.valor_hora_ordinaria)}</td>
                    <td style={{ textAlign: 'center' }}>{formatCOP(Math.round((form.horas_ordinarias || 0) * (form.valor_hora_ordinaria || 0)))}</td>
                  </tr>
                  <tr style={{ background: (form.horas_recargo > 0) ? 'rgba(245,158,11,0.08)' : 'transparent' }}>
                    <td><strong>CON RECARGO</strong> <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(125%)</span></td>
                    <td style={{ fontSize: '11px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
                        {form._desgloseDetalle?.d1?.rec > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                            <span style={{ fontWeight: 600, color: '#f59e0b' }}>Op. 1</span>
                            <span style={{ color: 'rgba(245,158,11,0.8)' }}>{form._desgloseDetalle.d1.rec} h &times; <span style={{ fontWeight: 700, color: '#f59e0b' }}>{formatCOP(form._desgloseDetalle.d1.v * 1.25)}</span></span>
                          </div>
                        )}
                        {form._desgloseDetalle?.d2?.rec > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                            <span style={{ fontWeight: 600, color: '#f59e0b' }}>Op. 2</span>
                            <span style={{ color: 'rgba(245,158,11,0.8)' }}>{form._desgloseDetalle.d2.rec} h &times; <span style={{ fontWeight: 700, color: '#f59e0b' }}>{formatCOP(form._desgloseDetalle.d2.v * 1.25)}</span></span>
                          </div>
                        )}
                        {(!form._desgloseDetalle?.d1?.rec && !form._desgloseDetalle?.d2?.rec) && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: form.horas_recargo > 0 ? 700 : 400, color: form.horas_recargo > 0 ? '#f59e0b' : 'inherit' }}>{form.horas_recargo || 0}</td>
                    <td style={{ textAlign: 'center' }}>{formatCOP(form.valor_hora_recargo)}</td>
                    <td style={{ textAlign: 'center', fontWeight: form.horas_recargo > 0 ? 700 : 400, color: form.horas_recargo > 0 ? '#f59e0b' : 'inherit' }}>{formatCOP(Math.round((form.horas_recargo || 0) * (form.valor_hora_recargo || 0)))}</td>
                  </tr>
                  <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700 }}>
                    <td>TOTAL</td>
                    <td></td>
                    <td style={{ textAlign: 'center' }}>{parseFloat(form.horas_ordinarias || 0) + parseFloat(form.horas_recargo || 0)}</td>
                    <td></td>
                    <td style={{ textAlign: 'center' }}>{formatCOP(Math.round(((form.horas_ordinarias || 0) * (form.valor_hora_ordinaria || 0)) + ((form.horas_recargo || 0) * (form.valor_hora_recargo || 0))))}</td>
                  </tr>
                </tbody>
              </table>
              {form.horas_recargo > 0 && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', fontSize: '11px', color: '#f59e0b' }}>
                  ⚠ {form.horas_recargo} hora(s) fuera de horario normal — recargo del 25% adicional = <strong>{formatCOP(form._totalExtraRecargo || 0)}</strong>
                </div>
              )}
            </div>
            {/* Resumen de totales */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span style={{ ...label, display: 'block' }}>Total Bruto (Ítems)</span>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{formatCOP(form.total_bruto)}</span>
                </div>
                <div>
                  <span style={{ ...label, display: 'block' }}>+ Recargo Horas Extras</span>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: form.horas_recargo > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                    {form.horas_recargo > 0 ? formatCOP(form._totalExtraRecargo || 0) : '—'}
                  </span>
                </div>
                <div>
                  <span style={{ ...label, display: 'block' }}>IVA (19%)</span>
                  <span style={{ fontWeight: 700, color: form.iva_valor > 0 ? 'inherit' : 'var(--text-muted)' }}>{form.iva_valor > 0 ? formatCOP(form.iva_valor) : '—'}</span>
                </div>
                <div>
                  <span style={{ ...label, display: 'block' }}>Descuentos</span>
                  <span style={{ fontWeight: 700 }}>{formatCOP(form.descuentos)}</span>
                </div>
              </div>
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(37,99,235,0.02))', borderRadius: '8px', border: '1px solid rgba(37,99,235,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-secondary)' }}>TOTAL NETO</span>
                <span style={{ fontWeight: 800, color: 'var(--clr-primary-500)', fontSize: '18px' }}>{formatCOP(form.total_neto)}</span>
              </div>
            </div>
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
                  const latest = [...data].sort((a, b) => b.id - a.id)[0];
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
