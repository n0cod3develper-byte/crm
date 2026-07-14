import React from 'react';

export default function DashboardEnConstruccion({ nombreModulo }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Dashboard {nombreModulo || 'en Construcción'}</h2>
      <p>Este módulo aún no tiene un dashboard específico asignado.</p>
    </div>
  );
}
