import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Truck, MapPin, History, ExternalLink } from 'lucide-react';
import { mpService } from '../../../services/mantenimientosProgramadosService';
import { EstadoBadge } from '../../../components/MantenimientosProgramados/EstadoBadge';
import { PrioridadBadge } from '../../../components/MantenimientosProgramados/PrioridadBadge';
import toast from 'react-hot-toast';
import api from '../../../lib/api';

const AREAS_FIJAS = [
  { id: 1, nombre: 'Mantenimiento' },
  { id: 2, nombre: 'Sistemas' },
  { id: 3, nombre: 'SST' },
  { id: 4, nombre: 'Locativo' },
];

export default function HistorialMantenimientos() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState('equipo');
  const [entidadId, setEntidadId] = useState('');
  const [entidades, setEntidades] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);

  useEffect(() => {
    if (tipo === 'area') {
      setEntidades(AREAS_FIJAS);
      return;
    }
    // tipo === 'equipo'
    const load = async () => {
      try {
        const res = await api.get('/equipos', { params: { activo: true, limit: 200 } });
        setEntidades(res.data?.data || res.data || []);
      } catch (err) { console.error('Error loading equipos:', err); }
    };
    load();
  }, [tipo]);

  const handleSearch = async () => {
    if (!entidadId) { toast.error('Seleccione una entidad'); return; }
    setLoading(true);
    setBuscado(true);
    try {
      const res = tipo === 'equipo'
        ? await mpService.getHistorialEquipo(entidadId)
        : await mpService.getHistorialArea(entidadId);
      setHistorial(res.data?.data || []);
    } catch (err) { toast.error('Error al cargar historial'); }
    finally { setLoading(false); }
  };

  // IDs de equipos son UUIDs (string), de áreas son integers — comparar como string para ambos
  const entidadSeleccionada = entidades.find(e => String(e.id) === String(entidadId));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={20} /> Historial de Mantenimientos
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Trazabilidad por equipo o área</p>
      </div>

      {/* Selector */}
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <label className="input-label">Tipo</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button onClick={() => { setTipo('equipo'); setEntidadId(''); setHistorial([]); setBuscado(false); }}
                className={`btn btn--sm ${tipo === 'equipo' ? 'btn--primary' : 'btn--ghost'}`}>
                <Truck size={16} /> Equipo
              </button>
              <button onClick={() => { setTipo('area'); setEntidadId(''); setHistorial([]); setBuscado(false); }}
                className={`btn btn--sm ${tipo === 'area' ? 'btn--primary' : 'btn--ghost'}`}>
                <MapPin size={16} /> Área
              </button>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label className="input-label">{tipo === 'equipo' ? 'Equipo' : 'Área'}</label>
            <select value={entidadId} onChange={(e) => setEntidadId(e.target.value)} className="input">
              <option value="">Seleccionar...</option>
              {entidades.map(e => (
                <option key={e.id} value={e.id}>{e.nombre || e.codigo || `#${e.id}`}</option>
              ))}
            </select>
          </div>
          <button onClick={handleSearch} className="btn btn--primary btn--sm">
            <Search size={16} /> Consultar
          </button>
        </div>
      </div>

      {/* Resultados */}
      {buscado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {entidadSeleccionada && (
            <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)' }}>
              <span style={{ fontWeight: 600 }}>Historial de:</span>
              <span style={{ fontWeight: 700 }}>{entidadSeleccionada.nombre || `#${entidadSeleccionada.id}`}</span>
              <span style={{ color: 'var(--text-muted)' }}>—</span>
              <span style={{ color: 'var(--text-muted)' }}>{historial.length} registro(s)</span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>
          ) : historial.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <History size={40} color="var(--text-muted)" style={{ opacity: 0.5, margin: '0 auto 0.75rem' }} />
              <p style={{ color: 'var(--text-muted)' }}>No se encontraron órdenes de mantenimiento para esta entidad</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {historial.map(o => (
                <div key={o.id} className="card card--interactive" style={{ padding: '1rem' }}
                  onClick={() => navigate(`/mantenimientos-programados/ordenes/${o.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <code style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-primary-400)', fontWeight: 700 }}>{o.codigo}</code>
                      <EstadoBadge estado={o.estado} />
                      <PrioridadBadge prioridad={o.prioridad} />
                    </div>
                    <ExternalLink size={14} color="var(--text-muted)" />
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginTop: '0.25rem' }}>{o.titulo}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    <span>{o.tipo_mantenimiento}</span>
                    <span>{new Date(o.fecha_programada).toLocaleDateString()}</span>
                    {o.plan_nombre && <span>Plan: {o.plan_codigo} - {o.plan_nombre}</span>}
                    {o.fecha_fin_real && <span>Completado: {new Date(o.fecha_fin_real).toLocaleDateString()}</span>}
                    {o.costo_total > 0 && <span>Costo: ${o.costo_total.toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
