import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'system', // 'light' | 'dark' | 'system'

      setTheme: (theme) => {
        set({ theme });
        get().applyTheme();
      },

      applyTheme: () => {
        const theme = get().theme;
        const root = window.document.documentElement;
        
        let effectiveTheme = theme;
        if (theme === 'system') {
          effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        root.setAttribute('data-theme', effectiveTheme);
        
        // Listener para cambios de sistema en tiempo real
        if (theme === 'system') {
          if (!window.__themeQueryListener) {
            window.__themeQueryListener = (e) => {
              if (get().theme === 'system') {
                root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
              }
            };
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', window.__themeQueryListener);
          }
        } else {
          // Remover listener si no es system
          if (window.__themeQueryListener) {
            window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', window.__themeQueryListener);
            window.__themeQueryListener = null;
          }
        }
      },
    }),
    {
      name: 'cargar-crm-theme',
    }
  )
);
