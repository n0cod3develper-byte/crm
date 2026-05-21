import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '../../services/catalogApi';
import { Package, Wrench, Save, ArrowLeft, Info, DollarSign, Database, Tag, MapPin, Image as ImageIcon, Upload, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { GeneradorCodigoUbicacion } from '../../components/Inventory/GeneradorCodigoUbicacion';
import { JSONListEditor } from '../../components/Inventory/JSONListEditor';

export function CatalogFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    tipo: 'PRODUCTO',
    codigo_interno: '',
    name: '',
    nombre_comercial: '',
    categoria_id: '',
    unidad_medida_id: '',
    unit_cost: 0,
    unit_price: 0,
    stock_current: 0,
    stock_minimum: 0,
    precio_servicio: 0,
    precio_servicio_minimo: 0,
    unidad_cobro: 'hora',
    aplica_iva: true,
    iva_pct: 19,
    ubicacion_id: '',
    marca: '',
    imagen_url: '',
    tipo_repuesto: 'N/A',
    responsable_id: '',
    referencia_cruzada: [],
    equipos_compatibles: []
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: catData } = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => catalogApi.getCategorias()
  });

  const { data: uniData } = useQuery({
    queryKey: ['catalog-units'],
    queryFn: () => catalogApi.getUnidades()
  });

  const { data: ubicacionesData } = useQuery({
    queryKey: ['ubicaciones'],
    queryFn: () => catalogApi.getUbicaciones()
  });

  const { data: itemData, isLoading } = useQuery({
    queryKey: ['catalog-item', id],
    queryFn: () => catalogApi.getItem(id),
    enabled: isEdit
  });

  useEffect(() => {
    if (isEdit && itemData?.data) {
      const item = itemData.data;
      setFormData(prev => ({
        ...prev,
        ...item,
        name: item.nombre_interno || item.name || '',
        unit_price: item.precio_venta ?? item.unit_price ?? 0,
        unit_cost: item.costo_o_minimo ?? item.unit_cost ?? 0,
        stock_current: item.stock_actual ?? item.stock_current ?? 0,
        stock_minimum: item.stock_minimo ?? item.stock_minimum ?? 0,
        categoria_id: item.categoria_id?.toString() || '',
        unidad_medida_id: item.unidad_medida_id?.toString() || '',
        ubicacion_id: item.ubicacion_id?.toString() || '',
        imagen_url: item.imagen_url || '',
        tipo_repuesto: item.tipo_repuesto || 'N/A',
        responsable_id: item.responsable_id || '',
        referencia_cruzada: Array.isArray(item.referencia_cruzada) ? item.referencia_cruzada : [],
        equipos_compatibles: Array.isArray(item.equipos_compatibles) ? item.equipos_compatibles : []
      }));
      if (item.imagen_url) {
        const API_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';
        setPreviewUrl(`${API_URL}/uploads/${item.imagen_url}`);
      }
    }
  }, [isEdit, itemData]);

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? catalogApi.update(id, data) : catalogApi.create(data),
    onSuccess: async (res) => {
      const itemId = id || res.data.id;
      
      // Si hay archivo seleccionado, subirlo
      if (selectedFile) {
        setIsUploading(true);
        try {
          const uploadData = new FormData();
          uploadData.append('documento', selectedFile);
          await catalogApi.uploadImagen(itemId, uploadData);
        } catch (err) {
          toast.error('Item guardado, pero la imagen falló');
        } finally {
          setIsUploading(false);
        }
      }

      toast.success(isEdit ? 'Item actualizado' : 'Item creado correctamente');
      queryClient.invalidateQueries(['catalog-items']);
      navigate('/catalogo/items');
    },
    onError: (err) => {
      toast.error('Error al guardar: ' + (err.response?.data?.message || err.message));
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value);
    
    // Sanitize ID fields to avoid UUID validation errors in backend
    if ((name.endsWith('_id') || name === 'responsable_id') && finalValue === '') {
      finalValue = null;
    }

    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  if (isEdit && isLoading) return <div className="p-12 text-center">Cargando datos...</div>;

  return (
    <div className="app-layout">
      <Topbar 
        title={isEdit ? 'Editar Item' : 'Nuevo Item al Catálogo'} 
        subtitle="Agrega productos físicos o servicios profesionales por Familia"
        rightContent={
          <button type="button" onClick={() => navigate(-1)} className="btn btn--secondary flex items-center gap-2">
            <ArrowLeft size={16} /> Volver
          </button>
        }
      />
      <main className="main-content">
        <div style={{ maxWidth: '800px', margin: '0 auto' }} className="animate-in fade-in duration-500">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Paso 1: Tipo de Item */}
            {!isEdit && (
              <div className="card">
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database size={20} color="var(--clr-primary-500)" /> Tipo de Item
                </h2>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, tipo: 'PRODUCTO' }))}
                    style={{ flex: 1, padding: '1.5rem', border: '2px solid', borderColor: formData.tipo === 'PRODUCTO' ? 'var(--clr-primary-500)' : 'var(--border-color)', borderRadius: 'var(--radius-lg)', background: formData.tipo === 'PRODUCTO' ? 'rgba(37,99,235,0.05)' : 'var(--bg-surface)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}
                  >
                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: formData.tipo === 'PRODUCTO' ? 'var(--clr-primary-500)' : 'var(--bg-elevated)', color: formData.tipo === 'PRODUCTO' ? 'white' : 'var(--text-muted)' }}>
                      <Package size={24} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.25rem', color: formData.tipo === 'PRODUCTO' ? 'var(--clr-primary-600)' : 'var(--text-primary)' }}>PRODUCTO</div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>Item físico con control de stock e inventario.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, tipo: 'SERVICIO' }))}
                    style={{ flex: 1, padding: '1.5rem', border: '2px solid', borderColor: formData.tipo === 'SERVICIO' ? 'var(--clr-info)' : 'var(--border-color)', borderRadius: 'var(--radius-lg)', background: formData.tipo === 'SERVICIO' ? 'rgba(59,130,246,0.05)' : 'var(--bg-surface)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}
                  >
                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: formData.tipo === 'SERVICIO' ? 'var(--clr-info)' : 'var(--bg-elevated)', color: formData.tipo === 'SERVICIO' ? 'white' : 'var(--text-muted)' }}>
                      <Wrench size={24} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.25rem', color: formData.tipo === 'SERVICIO' ? 'var(--clr-info)' : 'var(--text-primary)' }}>SERVICIO</div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>Servicio profesional sin stock físico.</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <Info size={18} color="var(--clr-primary-500)" />
                <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>Información General</h2>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Código Interno</label>
                  <input 
                    name="codigo_interno" value={formData.codigo_interno || ''} onChange={handleChange}
                    className="input" placeholder="Ej: PRD-00001 (Automático si se deja en blanco)"
                  />
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Referencia</label>
                  <input 
                    name="name" value={formData.name || ''} onChange={handleChange}
                    className="input" placeholder="Referencia o identificador adicional"
                  />
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Nombre Comercial (Aparece en Factura)</label>
                  <input 
                    name="nombre_comercial" value={formData.nombre_comercial} onChange={handleChange}
                    className="input" placeholder="Nombre que verá el cliente..."
                  />
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  <div className="input-group">
                    <label className="input-label">Marca</label>
                    <input type="text" name="marca" value={formData.marca} onChange={handleChange} className="input" placeholder="Ej: Caterpillar, SKF..." />
                  </div>
                  
                  {formData.tipo === 'PRODUCTO' && (
                    <>
                      <div className="input-group">
                        <label className="input-label">Clasificación Técnica</label>
                        <select 
                          name="tipo_repuesto" 
                          value={formData.tipo_repuesto} 
                          onChange={handleChange} 
                          className="input"
                        >
                          <option value="N/A">Sin Clasificar</option>
                          <option value="GENUINO_OE">Genuino OE</option>
                          <option value="OEM">OEM</option>
                          <option value="GENERICO">Genérico</option>
                        </select>
                      </div>

                      <div className="input-group">
                        <label className="input-label">Responsable / Especialista</label>
                        <select 
                          name="responsable_id" 
                          value={formData.responsable_id || ''} 
                          onChange={handleChange} 
                          className="input"
                        >
                          <option value="">Seleccione responsable...</option>
                          <option value="20ab5dea-8d8a-4439-8c12-728235dd265e">Robinson (Administrador)</option>
                          <option value="cd87f065-25d7-40c3-bbdb-9db840e1bb70">Emily (Administrador)</option>
                          <option value="3a1cedee-11da-4e1c-bb6b-591cf779c1ac">Alveiro (Especialista)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {formData.tipo === 'PRODUCTO' && (
                  <div className="card-body" style={{ borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <JSONListEditor 
                      label="Referencias Cruzadas / Opciones"
                      value={formData.referencia_cruzada}
                      onChange={(val) => setFormData(prev => ({ ...prev, referencia_cruzada: val }))}
                      placeholder="Ej: 1R-0749, BF7633..."
                    />
                    <JSONListEditor 
                      label="Equipos Compatibles"
                      value={formData.equipos_compatibles}
                      onChange={(val) => setFormData(prev => ({ ...prev, equipos_compatibles: val }))}
                      placeholder="Ej: Excavadora 320D, Motor C7..."
                    />
                  </div>
                )}
              </div>
                <div className="input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="input-label" style={{ margin: 0 }}>Familia</label>
                    <button 
                      type="button" 
                      onClick={() => navigate('/catalogo/familias')}
                      style={{ fontSize: '10px', color: 'var(--clr-primary-500)', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}
                    >
                      + Gestionar
                    </button>
                  </div>
                  <select name="categoria_id" value={formData.categoria_id} onChange={handleChange} required className="input" style={{ appearance: 'none' }}>
                    <option value="">Seleccione familia</option>
                    {catData?.data?.filter(c => c.tipo_aplicable === 'AMBOS' || c.tipo_aplicable === formData.tipo).map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                {formData.tipo === 'PRODUCTO' && (
                  <div className="input-group">
                    <label className="input-label">Unidad de Medida</label>
                    <select name="unidad_medida_id" value={formData.unidad_medida_id} onChange={handleChange} required className="input" style={{ appearance: 'none' }}>
                      <option value="">Seleccione unidad</option>
                      {uniData?.data?.map(u => (
                        <option key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {/* Panel de Precios */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <DollarSign size={18} color="var(--clr-success)" />
                  <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>Precios y Costos</h2>
                </div>
                
                {formData.tipo === 'PRODUCTO' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="input-group">
                      <label className="input-label">Costo Promedio (Sin IVA)</label>
                      <input type="number" name="unit_cost" value={formData.unit_cost} onChange={handleChange} className="input" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Precio de Venta Sugerido (Sin IVA)</label>
                      <input type="number" name="unit_price" value={formData.unit_price} onChange={handleChange} className="input" />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="input-group">
                      <label className="input-label">Precio del Servicio</label>
                      <input type="number" name="precio_servicio" value={formData.precio_servicio} onChange={handleChange} className="input" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Precio Mínimo (Negociable)</label>
                      <input type="number" name="precio_servicio_minimo" value={formData.precio_servicio_minimo} onChange={handleChange} className="input" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Unidad de Cobro</label>
                      <select name="unidad_cobro" value={formData.unidad_cobro} onChange={handleChange} className="input" style={{ appearance: 'none' }}>
                        <option value="hora">Hora</option>
                        <option value="visita">Visita</option>
                        <option value="diagnóstico">Diagnóstico</option>
                        <option value="km">Kilómetro</option>
                        <option value="unidad">Unidad</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Panel de Inventario (Solo Productos) */}
              {formData.tipo === 'PRODUCTO' && (
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <Database size={18} color="var(--clr-warning)" />
                    <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>Inventario y Ubicación</h2>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="input-group">
                      <label className="input-label">Stock Actual</label>
                      <input type="number" name="stock_current" value={formData.stock_current} onChange={handleChange} disabled={isEdit} className="input" style={{ opacity: isEdit ? 0.5 : 1 }} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Stock Mínimo (Alerta)</label>
                      <input type="number" name="stock_minimum" value={formData.stock_minimum} onChange={handleChange} className="input" />
                    </div>
                    
                    <GeneradorCodigoUbicacion 
                      value={formData.ubicacion_id} 
                      onChange={handleChange} 
                    />
                  </div>
                </div>
              )}

              {/* Configuración Adicional */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <Tag size={18} color="var(--clr-info)" />
                  <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>Configuración</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Aplica IVA</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>¿El item tiene impuesto?</div>
                    </div>
                    <input type="checkbox" name="aplica_iva" checked={formData.aplica_iva} onChange={handleChange} style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--clr-primary-500)' }} />
                  </div>
                  {formData.aplica_iva && (
                    <div className="input-group">
                      <label className="input-label">Porcentaje de IVA (%)</label>
                      <input type="number" name="iva_pct" value={formData.iva_pct} onChange={handleChange} className="input" />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Destacado</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>¿Aparece primero?</div>
                    </div>
                    <input type="checkbox" name="es_destacado" checked={formData.es_destacado} onChange={handleChange} style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--clr-primary-500)' }} />
                  </div>
                </div>
              </div>

              {/* Imagen del Producto */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <ImageIcon size={18} color="var(--clr-primary-500)" />
                  <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>Imagen del Producto</h2>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div 
                    style={{ 
                      width: '100%', 
                      height: '200px', 
                      borderRadius: 'var(--radius-md)', 
                      border: '2px dashed var(--border-color)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative',
                      background: 'var(--bg-app)'
                    }}
                  >
                    {previewUrl ? (
                      <>
                        <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        <button 
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewUrl(null);
                          }}
                          style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', padding: '0.25rem', borderRadius: '50%', background: 'rgba(239,68,68,0.8)', color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <ImageIcon size={48} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: 'var(--text-xs)' }}>Sin imagen seleccionada</div>
                      </div>
                    )}
                  </div>
                  
                  <label className="btn btn--secondary w-full flex items-center justify-center gap-2 cursor-pointer">
                    <Upload size={16} /> {selectedFile ? 'Cambiar Imagen' : 'Seleccionar Imagen'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setSelectedFile(file);
                          setPreviewUrl(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Formatos: JPG, PNG. Máximo 5MB.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button type="button" onClick={() => navigate(-1)} className="btn btn--secondary">Cancelar</button>
              <button type="submit" disabled={mutation.isLoading} className="btn btn--primary flex items-center gap-2 px-8">
                <Save size={18} /> {mutation.isLoading ? 'Guardando...' : 'Guardar Item'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

