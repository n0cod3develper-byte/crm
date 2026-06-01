import React from 'react';
import { ESTADOS_EQUIPO } from '../../constants/equipos';

export function EstadoEquipoBadge({ estado }) {
  const matching = ESTADOS_EQUIPO.find(e => e.valor === estado);
  if (!matching) return <span className="badge badge--gray">{estado}</span>;

  let badgeClass = 'badge--gray';
  if (matching.color === 'verde') badgeClass = 'badge--success';
  else if (matching.color === 'naranja') badgeClass = 'badge--warning';
  else if (matching.color === 'rojo') badgeClass = 'badge--danger';
  else if (matching.color === 'azul') badgeClass = 'badge--primary';

  return (
    <span className={`badge ${badgeClass}`}>
      {matching.label}
    </span>
  );
}
