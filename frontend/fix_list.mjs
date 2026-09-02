import fs from 'fs';

const filePath = 'c:/Users/Sistemas/CRM/crm/frontend/src/pages/Facturacion/FacturasListPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// We need to add multiple imports and state variables
const importsToAdd = `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Receipt, 
  FileText, 
  Download, 
  Eye,
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  XCircle,
  X,
  Trash2
} from 'lucide-react';
`;

content = content.replace(/import \{ useQuery \}[\s\S]*?from 'lucide-react';/, importsToAdd);

const stateAndHooksToAdd = `  const queryClient = useQueryClient();
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [numFactura, setNumFactura] = useState('');
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [sistemaContable, setSistemaContable] = useState('SIIGO');

  // Query to fetch full details of the selected prefactura when modal opens
  const { data: fullFacturaRes, isLoading: loadingFullFactura } = useQuery({
    queryKey: ['factura', selectedFactura?.id],
    queryFn: () => facturacionApi.getFactura(selectedFactura?.id),
    enabled: !!selectedFactura && isModalOpen
  });

  const fullFactura = fullFacturaRes?.data;

  const confirmMutation = useMutation({
    mutationFn: (data) => facturacionApi.confirmarFactura(selectedFactura?.id, data),
    onSuccess: () => {
      toast.success('Factura confirmada correctamente');
      queryClient.invalidateQueries(['facturas']);
      setIsModalOpen(false);
      setSelectedFactura(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al confirmar la factura');
    }
  });

  const toggleSelect = (factura, e) => {
    e.stopPropagation();
    if (selectedFactura?.id === factura.id) {
      setSelectedFactura(null);
    } else {
      setSelectedFactura(factura);
    }
  };
`;

content = content.replace(/const { data: facturas, isLoading, isFetching } = useQuery\({/, stateAndHooksToAdd + '\n  const { data: facturas, isLoading, isFetching } = useQuery({');


// We need to add the checkbox header
const thReplace = `<th className="px-6 py-4 text-left">Nro Factura</th>`;
const thNew = `{tab === 'PREFACTURA' && <th className="px-5 py-4 text-center w-12">Sel</th>}
                <th className="px-6 py-4 text-left">Nro Factura</th>`;
content = content.replace(thReplace, thNew);

// We need to add the checkbox body cell and onClick override
const trReplace = `<tr 
                  key={factura.id} 
                  className="hover:bg-subtle/30 transition-colors group cursor-pointer"
                  onClick={() => navigate(\`/facturacion/facturas/\${factura.id}\`)}
                >
                  <td className="px-6 py-4">`;

const trNew = `<tr 
                  key={factura.id} 
                  className={\`transition-all group cursor-pointer \${selectedFactura?.id === factura.id ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-subtle/30'}\`}
                  onClick={() => navigate(\`/facturacion/facturas/\${factura.id}\`)}
                >
                  {tab === 'PREFACTURA' && (
                    <td className="px-5 py-4 text-center" onClick={(e) => toggleSelect(factura, e)}>
                      <div className={\`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto \${
                        selectedFactura?.id === factura.id ? 'bg-accent border-accent text-white' : 'border-color'
                      }\`}>
                        {selectedFactura?.id === factura.id && <CheckCircle2 size={12} />}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">`;
content = content.replace(trReplace, trNew);


// We need to add the floating bottom bar and modal right before </Layout>
const floatingAndModal = `
      {/* Barra flotante inferior */}
      {selectedFactura && tab === 'PREFACTURA' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300 w-full px-4" style={{ maxWidth: '800px' }}>
          <div className="card-premium flex items-center justify-between p-4 shadow-2xl shadow-black/50 border border-accent/30 bg-background/95 backdrop-blur-xl">
            <div className="flex items-center gap-6 pl-2">
              <div className="flex items-center gap-3 border-r border-color pr-6">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted tracking-wider">Prefactura</p>
                  <p className="font-bold text-sm">1 Seleccionada</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted">
                <Building2 size={16} />
                <span className="font-bold text-foreground">{selectedFactura.empresa_nombre}</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted font-bold tracking-widest">Subtotal</p>
                  <p className="font-semibold">{formatCurrency(parseFloat(selectedFactura.subtotal) || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted font-bold tracking-widest">IVA</p>
                  <p className="font-semibold">{formatCurrency(parseFloat(selectedFactura.iva_valor) || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-accent font-bold tracking-widest">Total</p>
                  <p className="font-bold text-lg text-accent">{formatCurrency(parseFloat(selectedFactura.total) || 0)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 border-l border-color pl-6">
                <button 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                  onClick={() => setSelectedFactura(null)}
                  title="Cancelar Selección"
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  className="btn-primary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-accent/20"
                  onClick={() => setIsModalOpen(true)}
                >
                  <CheckCircle2 size={18} /> Generar Factura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Confirmar Factura */}
      {isModalOpen && fullFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)}>
          <div 
            className="card-premium w-full animate-in zoom-in-95 duration-200"
            style={{ 
              maxWidth: '700px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              animation: 'modalIn 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-color" style={{ padding: '2rem 3rem', background: 'var(--color-subtle, rgba(255,255,255,0.03))' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <FileText size={24} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Confirmar Facturación</h3>
                  <p className="text-sm text-muted font-medium">Asignar número definitivo a la prefactura</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-subtle transition-colors text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div className="space-y-8" style={{ padding: '2.5rem 3rem' }}>
              
              {/* Tabla Resumen */}
              <div className="bg-subtle/40 rounded-2xl border border-color overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-subtle/50 text-xs uppercase text-muted sticky top-0 backdrop-blur-md">
                    <tr>
                      <th className="px-5 py-3 text-left tracking-wider">Documento</th>
                      <th className="px-5 py-3 text-right tracking-wider">Monto a Confirmar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-color">
                    {fullFactura.remisiones?.map(r => (
                      <tr key={r.id} className="hover:bg-subtle/20 transition-colors">
                        <td className="px-5 py-3 font-bold">{r.numero_remision}</td>
                        <td className="px-5 py-3 text-right font-medium text-accent">{formatCurrency(r.total_rem)}</td>
                      </tr>
                    ))}
                    {fullFactura.ots?.map(o => (
                      <tr key={o.id} className="hover:bg-subtle/20 transition-colors">
                        <td className="px-5 py-3 font-bold">{o.ot_consecutivo}</td>
                        <td className="px-5 py-3 text-right font-medium text-accent">{formatCurrency(o.total_ot)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-subtle/50 sticky bottom-0 border-t border-color">
                    <tr>
                      <td className="px-5 py-3 text-right font-bold uppercase text-muted tracking-widest text-[11px]">Total General:</td>
                      <td className="px-5 py-3 text-right font-black text-lg text-accent">{formatCurrency(fullFactura.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Campos del formulario */}
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                    Número de Factura Real <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    className="input-premium w-full font-bold text-accent text-xl py-4 px-5"
                    placeholder="Ej: FV-2026-00123"
                    value={numFactura}
                    onChange={(e) => setNumFactura(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted mt-2 font-medium">Ingresa el número generado en su sistema contable externo.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                      Fecha Factura <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      className="input-premium w-full font-bold text-base py-4 px-5"
                      value={fechaFactura}
                      onChange={(e) => setFechaFactura(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-4 border-t border-color" style={{ padding: '2rem 3rem', background: 'var(--color-subtle, rgba(255,255,255,0.02))' }}>
              <button 
                className="btn-secondary flex-1 py-4 rounded-2xl font-bold text-base hover:bg-subtle transition-colors" 
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary flex-[2] py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                onClick={() => confirmMutation.mutate({
                  numero_factura: numFactura,
                  fecha_factura: fechaFactura,
                  sistema_contable: sistemaContable
                })}
                disabled={!numFactura.trim() || confirmMutation.isLoading}
              >
                {confirmMutation.isLoading ? (
                  <>
                    <div className="spinner h-5 w-5 border-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} strokeWidth={2.5} />
                    Confirmar y Finalizar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>`;

content = content.replace('    </Layout>', floatingAndModal);

// when changing tabs, reset selected factura
content = content.replace('onClick={() => setTab(t.id)}', 'onClick={() => { setTab(t.id); setSelectedFactura(null); }}');

fs.writeFileSync(filePath, content);
console.log("Updated FacturasListPage with floating bar and modal.");
