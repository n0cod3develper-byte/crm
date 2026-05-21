import { useState, useEffect } from 'react';

/**
 * Hook reactivo para media queries.
 * Útil para detectar viewport mobile/tablet/desktop.
 *
 * @param {string} query - CSS media query (ej: '(max-width: 768px)')
 * @returns {boolean} true si la query coincide
 *
 * @example
 *   const isMobile = useMediaQuery('(max-width: 768px)');
 *   const isTablet = useMediaQuery('(max-width: 1024px)');
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Hook que clasifica el viewport en 3 categorías:
 * - isMobile  (≤ 767px) → drawer overlay
 * - isTablet  (768-1024px) → drawer overlay
 * - isDesktop (≥ 1025px) → colapsable
 */
export function useViewportType() {
  const isMobile  = useMediaQuery('(max-width: 767px)');
  const isTablet  = useMediaQuery('(min-width: 768px) and (max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1025px)');
  return {
    isMobile,
    isTablet,
    isDesktop,
    /** true en mobile o tablet (usar drawer), false en desktop (usar collapse) */
    isDrawerMode: isMobile || isTablet,
  };
}
