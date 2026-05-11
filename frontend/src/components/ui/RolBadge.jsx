import React from 'react';

const ROL_CONFIG = {
  admin:           { label: 'Administrador',    color: 'bg-red-100 text-red-800' },
  supervisor_mant: { label: 'Sup. Mantenimiento',color: 'bg-blue-100 text-blue-800' },
  tecnico:         { label: 'Técnico',           color: 'bg-green-100 text-green-800' },
  almacenista:     { label: 'Almacenista',       color: 'bg-orange-100 text-orange-800' },
  comprador:       { label: 'Comprador',         color: 'bg-purple-100 text-purple-800' },
  aprobador_1:     { label: 'Aprobador N1',      color: 'bg-indigo-100 text-indigo-800' },
  aprobador_2:     { label: 'Aprobador N2',      color: 'bg-indigo-100 text-indigo-800' },
  aprobador_3:     { label: 'Aprobador N3',      color: 'bg-indigo-100 text-indigo-800' },
  consulta:        { label: 'Consulta',          color: 'bg-gray-100 text-gray-700' },
};

export function RolBadge({ slug, size = 'md' }) {
  const config = ROL_CONFIG[slug] || { label: slug, color: 'bg-gray-100 text-gray-700' };
  
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center font-bold rounded-full ${config.color} ${sizeClasses}`} style={{
      textTransform: 'uppercase',
      letterSpacing: '0.02em'
    }}>
      {config.label}
    </span>
  );
}
