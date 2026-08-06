import React, { useState, useEffect, useRef, useCallback } from 'react';
import slide1 from '../../assets/carousel/slide1.jpg';
import slide2 from '../../assets/carousel/slide2.jpg';
import slide3 from '../../assets/carousel/slide3.jpg';
import stratumLogo from '../../assets/stratum_logo.png';

/* ─── Contenido — orientado al CRM como herramienta de gestión ─── */
const SLIDES = [
  {
    id: 1,
    image: slide1,
    tag: 'Visión 360°',
    headline: 'Todo tu negocio,\nun solo lugar',
    body: 'Clientes, empresas, oportunidades y actividad comercial centralizada. Toma decisiones con datos en tiempo real.',
    stats: [
      { value: 'CRM', label: 'Clientes & Empresas' },
      { value: '↑', label: 'Cotizaciones & Pipeline' },
    ],
  },
  {
    id: 2,
    image: slide2,
    tag: 'Operaciones',
    headline: 'Equipos y\nmantenimientos\nbajo control',
    body: 'Gestiona el ciclo completo de equipos, ordenes de trabajo, mantenimientos programados e historial técnico.',
    stats: [
      { value: 'OT', label: 'Órdenes de trabajo' },
      { value: '⚙', label: 'Mantenimiento predictivo' },
    ],
  },
  {
    id: 3,
    image: slide3,
    tag: 'Inteligencia',
    headline: 'Informes que\nimpulsan\nresultados',
    body: 'Facturación, presupuestos, compras e informes gerenciales. Toda la información financiera y operativa integrada.',
    stats: [
      { value: '$', label: 'Facturación & Compras' },
      { value: '📊', label: 'Reportes gerenciales' },
    ],
  },
];

const SLIDE_DURATION = 5500;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const h = (e) => setReduced(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return reduced;
}

export function LoginCarousel() {
  const [active, setActive]           = useState(0);
  const [prev, setPrev]               = useState(null);
  const [transitioning, setTrans]     = useState(false);
  const [paused, setPaused]           = useState(false);
  const [progress, setProgress]       = useState(0);
  const startRef                      = useRef(null);
  const timerRef                      = useRef(null);
  const rafRef                        = useRef(null);
  const reducedMotion                 = usePrefersReducedMotion();

  const goTo = useCallback((idx) => {
    if (transitioning || idx === active) return;
    setPrev(active);
    setTrans(true);
    setActive(idx);
    setProgress(0);
    startRef.current = performance.now();
    setTimeout(() => { setPrev(null); setTrans(false); }, reducedMotion ? 0 : 700);
  }, [active, transitioning, reducedMotion]);

  const goNext = useCallback(() => goTo((active + 1) % SLIDES.length), [active, goTo]);
  const goPrev = useCallback(() => goTo((active - 1 + SLIDES.length) % SLIDES.length), [active, goTo]);

  /* Auto-avance + barra de progreso */
  useEffect(() => {
    if (reducedMotion || paused) {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
      return;
    }
    setProgress(0);
    startRef.current = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      setProgress(Math.min((elapsed / SLIDE_DURATION) * 100, 100));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    timerRef.current = setTimeout(() => {
      setActive(cur => {
        const next = (cur + 1) % SLIDES.length;
        setPrev(cur);
        setTrans(true);
        setTimeout(() => { setPrev(null); setTrans(false); }, 700);
        setProgress(0);
        startRef.current = performance.now();
        return next;
      });
    }, SLIDE_DURATION);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, [active, paused, reducedMotion]);

  const slide = SLIDES[active];

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100vh', overflow: 'hidden', background: '#07101f' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tagPop {
          from { opacity: 0; transform: scale(0.9); }
          to   { opacity: 1; transform: scale(1); }
        }
        .crm-stat-card {
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .crm-stat-card:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,0.09) !important;
        }
        .crm-nav-btn {
          transition: all 0.18s ease;
          cursor: pointer;
        }
        .crm-nav-btn:hover {
          background: rgba(255,255,255,0.18) !important;
          border-color: rgba(255,255,255,0.4) !important;
          transform: scale(1.06);
        }
        .crm-nav-btn:active { transform: scale(0.97); }
        .crm-dot {
          transition: all 0.25s ease;
          cursor: pointer;
        }
        .crm-dot:hover { transform: scaleX(1.15); }
      `}</style>

      {/* ── Capas de imagen con crossfade ─────────────────────── */}
      {SLIDES.map((s, i) => {
        const isActive = i === active;
        const isPrev   = i === prev;
        return (
          <div key={s.id} style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${s.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            opacity: isActive ? 1 : 0,
            transform: isActive ? 'scale(1.04)' : isPrev ? 'scale(1)' : 'scale(1.08)',
            transition: reducedMotion ? 'none' : 'opacity 0.7s cubic-bezier(.4,0,.2,1), transform 7s ease-out',
            zIndex: isActive ? 2 : isPrev ? 1 : 0,
          }} />
        );
      })}

      {/* ── Overlays ──────────────────────────────────────────── */}
      {/* Overlay base oscuro */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 3,
        background: 'linear-gradient(to bottom, rgba(7,16,31,0.35) 0%, rgba(7,16,31,0.6) 40%, rgba(7,16,31,0.93) 100%)',
      }} />
      {/* Overlay lateral izquierdo para separación con el formulario */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 4,
        background: 'linear-gradient(to right, rgba(7,16,31,0.5) 0%, transparent 40%)',
      }} />
      {/* Grid sutil */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)',
      }} />

      {/* ── Contenido principal ───────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 6,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '2.5rem 2.25rem',
      }}>

        {/* Tag */}
        <div
          key={`tag-${active}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.3rem 0.875rem', borderRadius: '9999px', width: 'fit-content',
            background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.4)',
            backdropFilter: 'blur(10px)',
            color: '#93c5fd', fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: '1rem',
            animation: reducedMotion ? 'none' : 'tagPop 0.4s ease both',
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', boxShadow: '0 0 8px #3b82f6' }} />
          {slide.tag}
        </div>

        {/* Titular */}
        <h2
          key={`headline-${active}`}
          style={{
            color: '#ffffff', fontFamily: "'Inter', sans-serif",
            fontSize: 'clamp(1.75rem, 2.8vw, 2.35rem)',
            fontWeight: 800, lineHeight: 1.12,
            letterSpacing: '-0.03em', whiteSpace: 'pre-line',
            marginBottom: '0.875rem',
            textShadow: '0 2px 24px rgba(0,0,0,0.6)',
            animation: reducedMotion ? 'none' : 'fadeSlideIn 0.5s 0.08s ease both',
          }}
        >
          {slide.headline}
        </h2>

        {/* Cuerpo */}
        <p
          key={`body-${active}`}
          style={{
            color: 'rgba(203,213,225,0.85)', fontSize: '0.875rem',
            lineHeight: 1.7, maxWidth: '340px', marginBottom: '1.5rem',
            animation: reducedMotion ? 'none' : 'fadeSlideIn 0.5s 0.16s ease both',
          }}
        >
          {slide.body}
        </p>

        {/* Stat cards */}
        <div
          key={`stats-${active}`}
          style={{
            display: 'flex', gap: '0.75rem', marginBottom: '2rem',
            animation: reducedMotion ? 'none' : 'fadeSlideIn 0.5s 0.24s ease both',
          }}
        >
          {slide.stats.map((st, i) => (
            <div
              key={i}
              className="crm-stat-card"
              style={{
                flex: 1, padding: '0.75rem 1rem', borderRadius: '10px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#60a5fa', lineHeight: 1, marginBottom: '0.25rem' }}>
                {st.value}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(148,163,184,0.9)', fontWeight: 500, lineHeight: 1.3 }}>
                {st.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Controles ──────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>

          {/* Prev */}
          <button onClick={goPrev} aria-label="Anterior" className="crm-nav-btn" style={{
            width: 34, height: 34, borderRadius: '50%', padding: 0, flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Barras de progreso */}
          <div style={{ flex: 1, display: 'flex', gap: '6px', alignItems: 'center' }}>
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1}`}
                className="crm-dot"
                style={{
                  flex: 1, height: '2px', border: 'none', padding: 0,
                  borderRadius: '9999px',
                  background: i < active ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {i === active && (
                  <span style={{
                    display: 'block', position: 'absolute', left: 0, top: 0,
                    height: '100%', width: reducedMotion ? '100%' : `${progress}%`,
                    background: '#ffffff', borderRadius: '9999px',
                  }} />
                )}
              </button>
            ))}
          </div>

          {/* Next */}
          <button onClick={goNext} aria-label="Siguiente" className="crm-nav-btn" style={{
            width: 34, height: 34, borderRadius: '50%', padding: 0, flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Logo / watermark STRATUM (esquina superior) ─── */}
      <div style={{
        position: 'absolute', top: '2rem', left: '2.25rem', zIndex: 7,
        display: 'flex', alignItems: 'center', gap: '0.625rem',
      }}>
        <img src={stratumLogo} alt="STRATUM" style={{ height: '64px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
      </div>
    </div>
  );
}
