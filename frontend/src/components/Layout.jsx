import React from 'react';
import { Sidebar } from './layout/Sidebar';
import { Topbar } from './layout/Topbar';

/**
 * Layout component that wraps the Sidebar, Topbar and main content.
 */
export const Layout = ({ title, subtitle, children, rightContent }) => {
  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar 
        title={title} 
        subtitle={subtitle} 
        rightContent={rightContent}
      />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

