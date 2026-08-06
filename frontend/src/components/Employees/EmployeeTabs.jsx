import React, { useState } from 'react';
import { User, Briefcase, Shield, Heart, AlertTriangle } from 'lucide-react';
import { EmployeeForm } from './EmployeeForm';
import { EmployeeDatosLaborales } from './EmployeeDatosLaborales';
import { EmployeeSeguridadSocial } from './EmployeeSeguridadSocial';
import { EmployeeLlamados } from './EmployeeLlamados';
import { EmployeeSaludOcupacional } from './EmployeeSaludOcupacional';

const TABS = [
  { key: 'general', label: 'Información General', icon: User },
  { key: 'laboral', label: 'Datos Laborales', icon: Briefcase },
  { key: 'seguridad', label: 'Seguridad Social', icon: Shield },
  { key: 'llamados', label: 'Llamados y Felicitaciones', icon: AlertTriangle },
  { key: 'salud', label: 'Salud Ocupacional', icon: Heart },
];

export function EmployeeTabs({ employee, onSuccess, onCancel, userRole }) {
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
        {activeTab === 'laboral' && <EmployeeDatosLaborales employee={employee} userRole={userRole} onSuccess={onSuccess} />}
        {activeTab === 'seguridad' && <EmployeeSeguridadSocial employee={employee} onSuccess={onSuccess} />}
        {activeTab === 'llamados' && <EmployeeLlamados employee={employee} />}
        {activeTab === 'salud' && <EmployeeSaludOcupacional employee={employee} userRole={userRole} />}
      </div>
    </div>
  );
}
