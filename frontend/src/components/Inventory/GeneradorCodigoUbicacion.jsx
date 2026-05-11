import React, { useState, useEffect } from 'react';
import { MapPin, Plus, RefreshCw } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';

export function GeneradorCodigoUbicacion({ value, onChange }) {
  const [prefijos, setPrefijos] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  
  const [newUbi, setNewUbi] = useState({
    prefijo_id: '',
    nivel_id: '',
    orientacion: 'FRENTE',
    nueva_posicion: '01',
    descripcion: ''
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [p, n, u] = await Promise.all([
          catalogApi.getUbicacionesPrefijos(),
          catalogApi.getUbicacionesNiveles(),
          catalogApi.getUbicaciones()
        ]);
        setPrefijos(p.data || []);
        setNiveles(n.data || []);
        setUbicaciones(u.data || []);
      } catch (err) {
        console.error("Error loading location metadata", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreate = async () => {
    try {
      const res = await catalogApi.createUbicacion(newUbi);
      const created = res.data;
      setUbicaciones(prev => [...prev, created]);
      onChange({ target: { name: 'ubicacion_id', value: created.id } });
      setShowNew(false);
    } catch (err) {
      alert("Error creando ubicación");
    }
  };

  const currentUbi = ubicaciones.find(u => u.id === value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="input-label mb-0">Ubicación Física Estructurada</label>
        <button 
          type="button" 
          onClick={() => setShowNew(!showNew)}
          className="text-xs text-primary-500 font-bold flex items-center gap-1"
        >
          {showNew ? 'Cancelar' : <><Plus size={12}/> Nueva Ubicación</>}
        </button>
      </div>

      {!showNew ? (
        <div className="relative">
          <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <select 
            name="ubicacion_id"
            value={value}
            onChange={onChange}
            className="input pl-10"
          >
            <option value="">Seleccione ubicación...</option>
            {ubicaciones.map(u => (
              <option key={u.id} value={u.id}>
                {u.codigo_ubicacion} - {u.descripcion || (u.prefijo_codigo + ' ' + u.nivel_codigo)}
              </option>
            ))}
          </select>
          {currentUbi && (
            <div className="mt-2 text-[10px] font-bold text-primary-600 bg-primary-50 p-2 rounded border border-primary-100 animate-in fade-in slide-in-from-top-1">
               CÓDIGO ACTUAL: {currentUbi.codigo_ubicacion}
            </div>
          )}
        </div>
      ) : (
        <div className="card p-4 bg-surface-elevated border-primary-200 animate-in zoom-in-95 duration-200">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="input-group">
              <label className="text-[10px] uppercase font-bold text-muted">Prefijo</label>
              <select 
                className="input py-1 text-sm"
                value={newUbi.prefijo_id}
                onChange={e => setNewUbi({...newUbi, prefijo_id: e.target.value})}
              >
                <option value="">...</option>
                {prefijos.map(p => <option key={p.id} value={p.id}>{p.codigo} - {p.descripcion}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="text-[10px] uppercase font-bold text-muted">Nivel</label>
              <select 
                className="input py-1 text-sm"
                value={newUbi.nivel_id}
                onChange={e => setNewUbi({...newUbi, nivel_id: e.target.value})}
              >
                <option value="">...</option>
                {niveles.map(n => <option key={n.id} value={n.id}>{n.codigo} - {n.descripcion}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="text-[10px] uppercase font-bold text-muted">Orientación</label>
              <input 
                className="input py-1 text-sm"
                placeholder="FRENTE, IZQ..."
                value={newUbi.orientacion}
                onChange={e => setNewUbi({...newUbi, orientacion: e.target.value.toUpperCase()})}
              />
            </div>
            <div className="input-group">
              <label className="text-[10px] uppercase font-bold text-muted">Posición</label>
              <input 
                className="input py-1 text-sm"
                placeholder="01, 02..."
                value={newUbi.nueva_posicion}
                onChange={e => setNewUbi({...newUbi, nueva_posicion: e.target.value})}
              />
            </div>
          </div>
          <button 
            type="button"
            onClick={handleCreate}
            disabled={!newUbi.prefijo_id || !newUbi.nivel_id}
            className="btn btn--primary btn--sm w-full py-2"
          >
            Confirmar y Asignar
          </button>
        </div>
      )}
    </div>
  );
}
