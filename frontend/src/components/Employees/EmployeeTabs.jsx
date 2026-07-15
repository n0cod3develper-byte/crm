import React, { useState } from 'react';
import { User, Briefcase, Shield, Heart } from 'lucide-react';
import { EmployeeForm } from './EmployeeForm';

const TABS = [
  { key: 'general', label: 'Información General', icon: User },
  { key: 'laboral', label: 'Datos Laborales', icon: Briefcase },
  { key: 'seguridad', label: 'Seguridad Social', icon: Shield },
  { key: 'salud', label: 'Salud Ocupacional', icon: Heart },
];

export function EmployeeTabs({ employee, onSuccess, onCancel }) {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div>
      <div style={{
        display: 'flex', gap: '2px', borderBottom: '1px solid var(--border-color)',
        marginBottom: '1.25rem', overflowX: 'auto'
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                padding: '0.6rem 1rem', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--clr-primary-500)' : 'var(--text-muted)',
                borderBottom: isActive ? '2px solid var(--clr-primary-500)' : '2px solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === 'general' && <EmployeeForm employee={employee} onSuccess={onSuccess} onCancel={onCancel} />}
        {activeTab !== 'general' && (
          <div style={{
            textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)',
            fontSize: '0.9rem'
          }}>
            <p>Próximamente: información detallada de esta sección.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
              Por ahora, usa la pestaña de Información General para editar los datos del empleado.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
