import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export function Error403Page() {
  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <div style={{ 
        background: 'rgba(239, 68, 68, 0.1)', 
        padding: '1.5rem', 
        borderRadius: '50%',
        marginBottom: '1.5rem'
      }}>
        <ShieldAlert size={48} color="#EF4444" />
      </div>
      <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginBottom: '1rem' }}>
        Acceso Denegado
      </h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '2rem' }}>
        No tienes los permisos necesarios para acceder a este módulo. 
        Si crees que esto es un error, contacta al administrador del sistema.
      </p>
      <Link to="/dashboard" className="btn btn--primary">
        Volver al Dashboard
      </Link>
    </div>
  );
}
