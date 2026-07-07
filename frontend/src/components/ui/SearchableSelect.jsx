import React from 'react';
import { Search, AlertCircle, Check } from 'lucide-react';

// Animación CSS para el spinner (evita depender de Tailwind)
const spinKeyframes = `
@keyframes ss-spin {
  from { transform: translateY(-50%) rotate(0deg); }
  to   { transform: translateY(-50%) rotate(360deg); }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('ss-spin-style')) {
  const style = document.createElement('style');
  style.id = 'ss-spin-style';
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
}

/**
 * SearchableSelect — Componente de selección con búsqueda predictiva (server-side).
 *
 * Props:
 *   fetchFn:    (searchTerm: string) => Promise<Array<item>>  — Función que retorna resultados según el término de búsqueda
 *   value:      string|number|null                             — Valor seleccionado actualmente (id del item)
 *   onChange:   (value: string|number, item: object) => void  — Callback al seleccionar
 *   getOptionLabel: (item) => string                           — Texto a mostrar cuando hay un item seleccionado
 *   renderOption:   (item, { isHighlighted, isSelected }) => ReactNode  — Render personalizado de cada opción
 *   placeholder:    string                                     — Placeholder del input
 *   disabled:       boolean                                    — Deshabilitar el campo
 *   debounceMs:     number                                     — Tiempo de debounce (default: 300)
 *   minSearchLength: number                                    — Mínimo de caracteres para buscar (default: 1)
 *   name:           string                                     — Nombre del campo (para formularios)
 *   noOptionsMessage: string                                   — Mensaje cuando no hay resultados
 *   errorMessage:    string                                     — Mensaje de error
 *   className:       string                                     — Clase CSS adicional para el wrapper
 */
export function SearchableSelect({
  fetchFn,
  value,
  onChange,
  getOptionLabel = (item) => item.name || item.label || '',
  renderOption,
  placeholder = 'Buscar...',
  disabled = false,
  debounceMs = 300,
  minSearchLength = 1,
  name,
  noOptionsMessage = 'Sin resultados',
  errorMessage = 'Error al buscar',
  initialItem = null,
  className = '',
}) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [selectedItem, setSelectedItem] = React.useState(null);
  const [hasSearched, setHasSearched] = React.useState(false);

  const inputRef = React.useRef(null);
  const dropdownRef = React.useRef(null);
  const wrapperRef = React.useRef(null);

  // ─── Cargar el item inicial ─────────────────────────────
  React.useEffect(() => {
    if (initialItem && String((initialItem.id ?? initialItem.value)) === String(value)) {
      setSelectedItem(initialItem);
    }
  }, [initialItem, value]);

  // ─── Búsqueda con debounce ──────────────────────────────
  React.useEffect(() => {
    if (!fetchFn) return;

    if (searchTerm.length < minSearchLength) {
      setResults([]);
      setHasSearched(false);
      setIsError(false);
      return;
    }

    setHasSearched(true);
    setIsLoading(true);
    setIsError(false);

    const timer = setTimeout(async () => {
      try {
        const items = await fetchFn(searchTerm);
        setResults(Array.isArray(items) ? items : []);
        if (document.activeElement === inputRef.current) {
          setIsOpen(true);
        }
        setHighlightedIndex(-1);
      } catch {
        setResults([]);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, fetchFn, debounceMs, minSearchLength]);

  // ─── Cerrar al hacer click fuera ─────────────────────────
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Handlers de teclado ─────────────────────────────────
  const handleKeyDown = (e) => {
    if (!isOpen && e.key === 'ArrowDown') {
      setIsOpen(true);
      e.preventDefault();
      return;
    }
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          selectItem(results[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // ─── Seleccionar un item ──────────────────────────────────
  const selectItem = (item) => {
    const itemValue = item.id ?? item.value;
    setSelectedItem(item);
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
    onChange(itemValue, item);
  };

  // ─── Limpiar selección ────────────────────────────────────
  const handleClear = () => {
    setSelectedItem(null);
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
    onChange('', null);
  };

  // ─── Focus ────────────────────────────────────────────────
  const handleFocus = () => {
    if (results.length > 0 && hasSearched) {
      setIsOpen(true);
    }
  };

  // ─── Renderizar opción (por defecto) ─────────────────────
  const defaultRenderOption = (item, { isHighlighted, isSelected }) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    }}>
      <div>
        <div style={{ fontWeight: 600 }}>{getOptionLabel(item)}</div>
      </div>
      {isSelected && (
        <Check size={16} style={{ color: 'var(--clr-primary-500)', flexShrink: 0 }} />
      )}
    </div>
  );

  const optionRenderer = renderOption || defaultRenderOption;

  // ─── Determinar texto mostrado en el input ────────────────
  const displayValue = selectedItem
    ? (renderOption ? getOptionLabel(selectedItem) : `${selectedItem.nit ? `[${selectedItem.nit}] ` : ''}${getOptionLabel(selectedItem)}`)
    : '';

  const hasValue = Boolean(value && selectedItem);

  return (
    <div
      ref={wrapperRef}
      className={`searchable-select ${className}`}
      style={{ position: 'relative' }}
    >
      {/* Input de búsqueda / display */}
      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
        <input
          ref={inputRef}
          type="text"
          className="input"
          name={name}
          value={hasValue && !isOpen ? displayValue : searchTerm}
          onChange={(e) => {
            if (hasValue) {
              // Si había un valor seleccionado y el usuario empieza a escribir,
              // limpiamos la selección y empezamos a buscar
              setSelectedItem(null);
              onChange('', null);
            }
            setSearchTerm(e.target.value);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={hasValue ? displayValue : placeholder}
          disabled={disabled}
          style={{
            paddingLeft: '2.25rem',
            paddingRight: hasValue ? '2rem' : '0.75rem',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        {/* Spinner de carga */}
        {isLoading && (
          <div
            className="spinner"
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              width: 14,
              height: 14,
            }}
          />
        )}
        {/* Botón de limpiar */}
        {hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              fontSize: '14px',
              lineHeight: 1,
            }}
            title="Limpiar selección"
            tabIndex={-1}
            aria-label="Limpiar selección"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {isOpen && !hasValue && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 1000,
            minWidth: '100%',
            width: 'max-content',
            maxWidth: '450px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
          role="listbox"
        >
          {/* Estado: cargando */}
          {isLoading && (
            <div style={{
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-muted)',
              fontSize: '13px',
              justifyContent: 'center',
            }}>
              <div className="spinner" style={{ width: 14, height: 14 }} />
              Buscando...
            </div>
          )}

          {/* Estado: error */}
          {!isLoading && isError && (
            <div style={{
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--clr-danger)',
              fontSize: '13px',
              justifyContent: 'center',
            }}>
              <AlertCircle size={16} />
              {errorMessage}
            </div>
          )}

          {/* Estado: sin resultados */}
          {!isLoading && !isError && hasSearched && results.length === 0 && searchTerm.length >= minSearchLength && (
            <div style={{
              padding: '1rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}>
              {noOptionsMessage}
            </div>
          )}

          {/* Lista de resultados */}
          {!isLoading && !isError && results.length > 0 && (
            results.map((item, index) => {
              const isHighlighted = index === highlightedIndex;
              const itemValue = item.id ?? item.value;
              const isSelected = String(itemValue) === String(value);

              return (
                <div
                  key={itemValue}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectItem(item);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{
                    padding: '0.625rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--border-color)',
                    background: isHighlighted
                      ? 'var(--bg-elevated)'
                      : isSelected
                        ? 'rgba(99,102,241,0.08)'
                        : 'transparent',
                    transition: 'background 0.1s ease',
                  }}
                >
                  {optionRenderer(item, { isHighlighted, isSelected })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
