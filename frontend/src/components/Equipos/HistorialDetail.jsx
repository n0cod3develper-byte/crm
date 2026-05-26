import React from 'react';
import { Lock, Clock, Package, User, AlertTriangle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

const TIPO_LABELS = {
  correctivo: 'Correctivo', preventivo_250h: 'Preventivo 250h',
  preventivo_500h: 'Preventivo 500h', preventivo_1000h: 'Preventivo 1000h',
  inspeccion: 'Inspección', otro: 'Otro',
};

const CRITICIDAD_COLORS = { leve: '#4ade80', moderado: '#fbbf24', critico: '#f87171' };
const ESTADO_COLORS = {
  operativo: '#4ade80', operativo_con_restricciones: '#fbbf24',
  en_espera_repuestos: '#60a5fa', fuera_de_servicio: '#f87171',
};

function formatMin(min) {
  if (min == null) return '—';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function formatDT(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function InfoRow({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.2rem' }}>
      <span style={{ fontSize:'10px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</span>
      <span style={{ fontSize:'var(--text-sm)', color:'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{value}</span>
    </div>
  );
}

function SectionCard({ title, children, accent }) {
  return (
    <div style={{ border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
      <div style={{ padding:'0.625rem 1rem', background:'var(--bg-elevated)', borderBottom:'1px solid var(--border-color)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
        {accent && <div style={{ width:3, height:14, borderRadius:2, background:accent }} />}
        <span style={{ fontSize:'var(--text-xs)', fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{title}</span>
      </div>
      <div style={{ padding:'1rem', display:'flex', flexDirection:'column', gap:'0.875rem' }}>{children}</div>
    </div>
  );
}

export function HistorialDetail({ registro, onEditar }) {
  if (!registro) return null;

  const critColor = registro.nivel_criticidad ? CRITICIDAD_COLORS[registro.nivel_criticidad] : null;
  const estadoColor = registro.estado_equipo_al_cierre ? ESTADO_COLORS[registro.estado_equipo_al_cierre] : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

      {/* Header de estado */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.75rem', flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
          <span style={{
            padding:'0.2rem 0.75rem', borderRadius:'var(--radius-full)',
            fontSize:'var(--text-xs)', fontWeight:700, background:'rgba(99,102,241,0.12)', color:'var(--clr-primary-400)',
          }}>
            {TIPO_LABELS[registro.tipo_mantenimiento] || registro.tipo_mantenimiento}
          </span>
          {critColor && (
            <span style={{ padding:'0.2rem 0.75rem', borderRadius:'var(--radius-full)', fontSize:'var(--text-xs)', fontWeight:700, background:`${critColor}18`, color:critColor }}>
              ⚠ {registro.nivel_criticidad}
            </span>
          )}
          {registro.ot_cerrada && (
            <span style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.2rem 0.75rem', borderRadius:'var(--radius-full)', fontSize:'var(--text-xs)', fontWeight:700, background:'rgba(34,197,94,0.1)', color:'#4ade80' }}>
              <Lock size={10}/> OT Cerrada
            </span>
          )}
        </div>
      </div>

      {/* Datos generales */}
      <SectionCard title="Datos Generales" accent="var(--clr-primary-500)">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem' }}>
          <InfoRow label="OT" value={registro.numero_ot || registro.ot_consecutivo} mono />
          <InfoRow label="Horómetro al ingreso" value={`${registro.horometro_al_ingreso} h`} />
          <InfoRow label="Supervisor" value={registro.supervisor_nombre} />
          <InfoRow label="Creado por" value={registro.creado_por_nombre} />
          <InfoRow label="Costo total" value={registro.costo_total_mantenimiento > 0 ? `$${Number(registro.costo_total_mantenimiento).toLocaleString('es-CO')}` : null} />
          <InfoRow label="Próximo mantenimiento" value={registro.proxima_fecha_mantenimiento ? new Date(registro.proxima_fecha_mantenimiento).toLocaleDateString('es-CO') : null} />
        </div>
        {registro.tecnicos?.length > 0 && (
          <div>
            <span style={{ fontSize:'10px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Técnicos</span>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.375rem', marginTop:'0.375rem' }}>
              {registro.tecnicos.map(t => (
                <span key={t.empleado_id} style={{ padding:'0.15rem 0.6rem', background:'var(--bg-elevated)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-full)', fontSize:'var(--text-xs)' }}>
                  {t.full_name}
                </span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Fallas y diagnóstico */}
      {(registro.fallas_encontradas || registro.causa_raiz) && (
        <SectionCard title="Fallas y Diagnóstico" accent={critColor || '#9ca3af'}>
          <InfoRow label="Fallas encontradas" value={registro.fallas_encontradas} />
          <InfoRow label="Causa raíz" value={registro.causa_raiz} />
        </SectionCard>
      )}

      {/* Trabajos */}
      {(registro.trabajos_detalle?.length > 0 || registro.trabajos_realizados || registro.observaciones_seguridad) && (
        <SectionCard title={`Trabajos Realizados${registro.trabajos_detalle?.length > 0 ? ` (${registro.trabajos_detalle.length})` : ''}`} accent="#60a5fa">

          {/* Entradas estructuradas con fecha/hora */}
          {registro.trabajos_detalle?.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
              {registro.trabajos_detalle.map((t, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:'0.75rem', padding:'0.75rem', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-color)' }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.2rem' }}>
                    <span style={{ fontSize:'9px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Fecha y hora</span>
                    <span style={{ fontSize:'var(--text-xs)', fontWeight:600, color:'#60a5fa' }}>
                      {t.fecha_hora ? new Date(t.fecha_hora).toLocaleString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
                    </span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.2rem' }}>
                    <span style={{ fontSize:'9px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Descripción</span>
                    <span style={{ fontSize:'var(--text-sm)', color:'var(--text-primary)', whiteSpace:'pre-line' }}>{t.descripcion || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fallback: campo de texto plano */}
          {registro.trabajos_realizados && (
            <InfoRow label="Notas adicionales" value={registro.trabajos_realizados} />
          )}

          {registro.observaciones_seguridad && (
            <div style={{ padding:'0.75rem', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'var(--radius-md)' }}>
              <span style={{ fontSize:'10px', fontWeight:700, color:'#fbbf24', textTransform:'uppercase', display:'block', marginBottom:'0.375rem' }}>⚠ Observaciones de Seguridad</span>
              <span style={{ fontSize:'var(--text-sm)', color:'var(--text-primary)' }}>{registro.observaciones_seguridad}</span>
            </div>
          )}
        </SectionCard>
      )}


      {/* Tiempos */}
      <SectionCard title="Tiempos" accent="#a78bfa">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem' }}>
          <InfoRow label="Ingreso al taller" value={formatDT(registro.fecha_hora_ingreso_taller)} />
          <InfoRow label="Salida del taller" value={formatDT(registro.fecha_hora_salida_taller)} />
          {registro.tiempo_en_taller_min != null && (
            <div style={{ padding:'0.5rem 0.875rem', background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.18)', borderRadius:'var(--radius-md)', gridColumn:'span 2' }}>
              <span style={{ fontSize:'var(--text-xs)', color:'#4ade80', fontWeight:700 }}>⏱ Tiempo en taller: {formatMin(registro.tiempo_en_taller_min)}</span>
            </div>
          )}
          <InfoRow label="Inicio en bodega" value={formatDT(registro.fecha_inicio_bodega)} />
          <InfoRow label="Fin en bodega" value={formatDT(registro.fecha_fin_bodega)} />
          {registro.tiempo_en_bodega_min != null && (
            <div style={{ padding:'0.5rem 0.875rem', background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.18)', borderRadius:'var(--radius-md)', gridColumn:'span 2' }}>
              <span style={{ fontSize:'var(--text-xs)', color:'#60a5fa', fontWeight:700 }}>📦 Tiempo en bodega: {formatMin(registro.tiempo_en_bodega_min)}</span>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Estado al cierre */}
      {registro.estado_equipo_al_cierre && (
        <div style={{ padding:'0.875rem 1rem', borderRadius:'var(--radius-md)', border:`1px solid ${estadoColor}30`, background:`${estadoColor}0e`, display:'flex', alignItems:'center', gap:'0.625rem' }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:estadoColor, flexShrink:0 }} />
          <span style={{ fontSize:'var(--text-sm)', fontWeight:700, color:estadoColor }}>
            {registro.estado_equipo_al_cierre.replace(/_/g,' ')}
          </span>
        </div>
      )}

      {/* Repuestos */}
      {registro.repuestos?.length > 0 && (
        <SectionCard title={`Repuestos (${registro.repuestos.length})`} accent="#f59e0b">
          {registro.repuestos.map((r, i) => (
            <div key={r.id || i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', padding:'0.875rem', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)' }}>
              <div>
                <p style={{ fontSize:'10px', fontWeight:700, color:'#f87171', textTransform:'uppercase', marginBottom:'0.5rem' }}>↑ Retirado</p>
                <InfoRow label="Nombre" value={r.retirado_nombre} />
                <InfoRow label="Código" value={r.retirado_codigo} mono />
                <InfoRow label="Estado" value={r.retirado_estado} />
                <InfoRow label="Motivo" value={r.retirado_motivo} />
              </div>
              <div>
                <p style={{ fontSize:'10px', fontWeight:700, color:'#4ade80', textTransform:'uppercase', marginBottom:'0.5rem' }}>↓ Instalado</p>
                <InfoRow label="Nombre" value={r.instalado_nombre} />
                <InfoRow label="Código" value={r.instalado_codigo} mono />
                <InfoRow label="Procedencia" value={r.instalado_procedencia} />
                <InfoRow label="Garantía" value={r.instalado_garantia_hasta ? new Date(r.instalado_garantia_hasta).toLocaleDateString('es-CO') : null} />
                <InfoRow label="Costo" value={r.instalado_costo_unitario > 0 ? `$${Number(r.instalado_costo_unitario).toLocaleString('es-CO')}` : null} />
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {/* Adjuntos */}
      {registro.adjuntos?.length > 0 && (
        <SectionCard title="Adjuntos">
          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem' }}>
            {registro.adjuntos.map((url, i) => {
              const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
              const backendUrl = `${import.meta.env.VITE_API_URL?.replace('/api/v1','') || ''}${url}`;
              return isImg ? (
                <a key={i} href={backendUrl} target="_blank" rel="noreferrer">
                  <img src={backendUrl} alt={`adjunto-${i}`} style={{ width:80, height:80, objectFit:'cover', borderRadius:'var(--radius-md)', border:'1px solid var(--border-color)' }} />
                </a>
              ) : (
                <a key={i} href={backendUrl} target="_blank" rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', gap:'0.375rem', padding:'0.4rem 0.75rem', background:'var(--bg-elevated)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', fontSize:'var(--text-xs)', color:'var(--text-secondary)' }}>
                  <ExternalLink size={12}/> {url.split('/').pop()}
                </a>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
