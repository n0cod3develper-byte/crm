import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSidebarStore = create(
  persist(
    (set) => ({
      expanded: true,

      setExpanded: (val) => set({ expanded: val }),

      toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),

      mobileOpen: false,

      openMobile: () => set({ mobileOpen: true }),
      closeMobile: () => set({ mobileOpen: false }),
      toggleMobile: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
    }),
    {
      name: 'cargar-crm-sidebar',
      partialize: (state) => ({ expanded: state.expanded }),
    }
  )
);
