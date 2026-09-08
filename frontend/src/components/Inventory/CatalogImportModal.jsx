import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, 
  AlertTriangle, X, Info, FileText 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { catalogApi } from '../../services/catalogApi';

export function CatalogImportModal({ isOpen, onClose, onSuccess, familias = [], unidades = [] }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Generar y descargar plantilla Excel
  const handleDownloadTemplate = () => {
    try {
      const famNombres = familias.map(f => f.nombre).join(', ') || 'Sistema Eléctrico, Sistema Hidráulico, Repuestos, Insumos';
      const uniNombres = unidades.map(u => u.nombre || u.abreviatura).join(', ') || 'Unidad, Metro, Galón, Litro, Kg';

      const COLUMNAS = [
        'Código Interno',
        'Nombre Comercial',
        'Referencia',
        'Tipo',
        'Familia',
        'Unidad de Medida',
        'Marca',
        'Costo Unitario',
        'Precio Venta',
        'Stock Actual',
        'Stock Mínimo',
        'Precio Servicio',
        'Unidad de Cobro',
        'Aplica IVA',
        'Porcentaje IVA',
        'Clasificación Técnica',
        'Referencias Cruzadas',
        'Equipos Compatibles'
      ];

      const dataItems = [
        COLUMNAS,
        // Ejemplo 1: Producto Repuesto
        [
          'PRD-00101',
          'Filtro de Aceite Primario',
          'Filtro 1R-0716',
          'PRODUCTO',
          familias[0]?.nombre || 'Sistema Mecánico',
          unidades[0]?.nombre || 'Unidad',
          'Caterpillar',
          45000,
          68000,
          15,
          5,
          '',
          '',
          'SI',
          19,
          'GENUINO_OE',
          '1R-0716, LF667, P554005',
          'Excavadora 320D, Cargador 950H'
        ],
        // Ejemplo 2: Producto Insumo
        [
          'PRD-00102',
          'Aceite Hidráulico ISO 68 55GL',
          'Tambor Aceite HD 68',
          'PRODUCTO',
          familias[1]?.nombre || familias[0]?.nombre || 'Insumos',
          'Tambor',
          'Mobil',
          850000,
          1150000,
          4,
          2,
          '',
          '',
          'SI',
          19,
          'GENERICO',
          'MOBIL-DTE-10-68',
          'Equipos de Planta, Maquinaria Amarilla'
        ],
        // Ejemplo 3: Servicio Profesional
        [
          'SRV-00101',
          'Mantenimiento Preventivo 250 Horas',
          'PM 250H',
          'SERVICIO',
          familias[0]?.nombre || 'Mantenimiento General',
          '',
          'Cargar SAS',
          0,
          0,
          0,
          0,
          350000,
          'hora',
          'SI',
          19,
          'N/A',
          '',
          'Retroexcavadoras, Minicargadores'
        ]
      ];

      const dataInstrucciones = [
        ['Campo / Columna', 'Descripción y Reglas', '¿Obligatorio?', 'Tipo de Dato', 'Ejemplo / Opciones Válidas'],
        ['Código Interno', 'Código o SKU único. Si ya existe en el sistema, SE ACTUALIZARÁ el item; si no existe, SE CREARÁ uno nuevo.', 'Opcional (Auto si se omite)', 'Texto', 'PRD-00101, FIL-002'],
        ['Nombre Comercial', 'Nombre visible para facturas y cotizaciones.', 'SÍ', 'Texto', 'Filtro de Aceite Primario'],
        ['Referencia', 'Referencia técnica o nombre interno.', 'Opcional', 'Texto', '1R-0716'],
        ['Tipo', 'Tipo de item del catálogo. Debe ser PRODUCTO o SERVICIO.', 'SÍ (Default PRODUCTO)', 'Texto', 'PRODUCTO o SERVICIO'],
        ['Familia', 'Familia a la que pertenece. Opciones actuales en su sistema: [' + famNombres + ']', 'SÍ (Para productos)', 'Texto', familias[0]?.nombre || 'Sistema Eléctrico'],
        ['Unidad de Medida', 'Unidad de inventario. Opciones actuales: [' + uniNombres + ']', 'SÍ (Para productos)', 'Texto', unidades[0]?.nombre || 'Unidad'],
        ['Marca', 'Marca del producto o fabricante.', 'Opcional', 'Texto', 'Caterpillar, Donaldson, Komatsu'],
        ['Costo Unitario', 'Costo de adquisición sin IVA.', 'Opcional (Default 0)', 'Número', '45000'],
        ['Precio Venta', 'Precio sugerido de venta sin IVA.', 'Opcional (Default 0)', 'Número', '68000'],
        ['Stock Actual', 'Cantidad física inicial en bodega.', 'Opcional (Default 0)', 'Número', '10'],
        ['Stock Mínimo', 'Nivel mínimo para alertas de reposición.', 'Opcional (Default 0)', 'Número', '2'],
        ['Precio Servicio', 'Precio estándar de cobro si el item es SERVICIO.', 'Opcional', 'Número', '120000'],
        ['Unidad de Cobro', 'Modalidad de cobro si es SERVICIO (hora, visita, diagnóstico, km, unidad).', 'Opcional (Default hora)', 'Texto', 'hora, visita, diagnóstico, km'],
        ['Aplica IVA', 'Si el item genera IVA en facturación.', 'Opcional (Default SI)', 'Texto', 'SI / NO'],
        ['Porcentaje IVA', 'Porcentaje de IVA aplicable.', 'Opcional (Default 19)', 'Número', '19'],
        ['Clasificación Técnica', 'Para repuestos: GENUINO_OE, OEM, GENERICO o N/A.', 'Opcional', 'Texto', 'GENUINO_OE, OEM, GENERICO, N/A'],
        ['Referencias Cruzadas', 'Códigos equivalentes o referencias de otros fabricantes separados por comas.', 'Opcional', 'Texto CSV', '1R-0716, LF667, P554005'],
        ['Equipos Compatibles', 'Modelos o maquinaria compatible separados por comas.', 'Opcional', 'Texto CSV', 'Excavadora 320D, Cargador 950H']
      ];

      const wsItems = XLSX.utils.aoa_to_sheet(dataItems);
      const wsInstrucciones = XLSX.utils.aoa_to_sheet(dataInstrucciones);

      wsItems['!cols'] = COLUMNAS.map(() => ({ wch: 24 }));
      wsInstrucciones['!cols'] = [
        { wch: 22 },
        { wch: 55 },
        { wch: 22 },
        { wch: 18 },
        { wch: 45 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsItems, 'Items');
      XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');

      XLSX.writeFile(wb, 'plantilla_catalogo_productos_servicios.xlsx');
      toast.success('Plantilla descargada correctamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al generar la plantilla: ' + err.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
      setImportResult(null);
    } else {
      toast.error('Por favor arrastra un archivo Excel (.xlsx o .xls)');
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('archivo', selectedFile);
      const res = await catalogApi.importExcel(formData);
      
      setImportResult(res.data);
      toast.success(res.message || 'Catálogo actualizado correctamente');
      onSuccess?.();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Error al procesar el archivo Excel';
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImportResult(null);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(2px)' }}>
      <div style={{ maxWidth: '650px', width: '92%', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileSpreadsheet size={22} color="var(--clr-primary-500)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Importar / Actualizar Catálogo vía Excel
            </h2>
          </div>
          <button onClick={handleClose} className="btn btn--ghost btn--sm" style={{ padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
          {!importResult ? (
            <>
              {/* Banner de descarga de plantilla */}
              <div 
                style={{ 
                  background: 'rgba(37,99,235,0.06)', 
                  border: '1px solid rgba(37,99,235,0.2)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <Info size={20} color="var(--clr-primary-500)" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      ¿Aún no tienes el formato?
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      Descarga la plantilla oficial con ejemplos y las familias registradas en el sistema.
                    </div>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={handleDownloadTemplate} 
                  className="btn btn--secondary btn--sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
                >
                  <Download size={15} /> Bajar Plantilla
                </button>
              </div>

              {/* Zona Drag & Drop */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed ' + (isDragging ? 'var(--clr-primary-500)' : 'var(--border-color)'),
                  borderRadius: 'var(--radius-lg)',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragging ? 'rgba(37,99,235,0.04)' : 'var(--bg-app)',
                  transition: 'all 0.2s',
                  marginBottom: '1.25rem'
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  style={{ display: 'none' }}
                />
                
                {selectedFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', color: 'var(--clr-success)' }}>
                      <FileText size={32} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{selectedFile.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB — Clic o arrastra otro archivo para cambiarlo
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '50%', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                      <Upload size={32} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      Arrastra tu archivo Excel aquí o haz clic para seleccionarlo
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      Formatos compatibles: .xlsx, .xls (Máximo 10MB)
                    </div>
                  </div>
                )}
              </div>

              {/* Guía rápida */}
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                💡 <strong>Actualización inteligente:</strong> Si el <em>Código Interno</em> ya existe en el catálogo, la información se <strong>actualizará</strong>. Si no existe o se deja en blanco, se <strong>creará</strong> un nuevo item y se le asignará automáticamente su consecutivo de ubicación por familia.
              </div>
            </>
          ) : (
            /* Vista de Resultados */
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(34,197,94,0.1)', textAlign: 'center', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <CheckCircle size={22} color="var(--clr-success)" style={{ margin: '0 auto 0.25rem' }} />
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--clr-success)' }}>{importResult.creados}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Items Creados</div>
                </div>
                <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(59,130,246,0.1)', textAlign: 'center', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <FileSpreadsheet size={22} color="var(--clr-info)" style={{ margin: '0 auto 0.25rem' }} />
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--clr-info)' }}>{importResult.actualizados}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Actualizados</div>
                </div>
                <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: importResult.errores?.length > 0 ? 'rgba(239,68,68,0.1)' : 'var(--bg-app)', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                  <AlertTriangle size={22} color={importResult.errores?.length > 0 ? 'var(--clr-danger)' : 'var(--text-muted)'} style={{ margin: '0 auto 0.25rem' }} />
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: importResult.errores?.length > 0 ? 'var(--clr-danger)' : 'var(--text-muted)' }}>{importResult.errores?.length || 0}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Errores</div>
                </div>
              </div>

              {importResult.errores?.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--clr-danger)' }}>
                    Detalle de filas con error:
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <table style={{ width: '100%', fontSize: 'var(--text-xs)', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Fila</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Código / Item</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.errores.map((err, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.5rem', fontWeight: 700 }}>{err.fila}</td>
                            <td style={{ padding: '0.5rem' }}>{err.codigo}</td>
                            <td style={{ padding: '0.5rem', color: 'var(--clr-danger)' }}>{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-app)' }}>
          {!importResult ? (
            <>
              <button type="button" onClick={handleClose} className="btn btn--secondary" disabled={isImporting}>
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleImport} 
                disabled={!selectedFile || isImporting} 
                className="btn btn--primary flex items-center gap-2"
              >
                {isImporting ? 'Procesando Catálogo...' : 'Procesar e Importar'}
              </button>
            </>
          ) : (
            <button type="button" onClick={handleClose} className="btn btn--primary">
              Cerrar y Ver Catálogo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
