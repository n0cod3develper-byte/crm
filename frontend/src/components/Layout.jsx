import React from 'react';
import { Topbar } from './layout/Topbar';

/**
 * Layout principal que envuelve Topbar y contenido.
 * El Sidebar ahora se renderiza en App.jsx fuera de <Routes>.
 */
export const Layout = ({ title, subtitle, children, rightContent }) => {
  return (
    <div className="app-layout">
      <Topbar
        title={title}
        subtitle={subtitle}
        rightContent={rightContent}
      />
      <main className="main-content" role="main">
        {children}
      </main>
    </div>
  );
};
