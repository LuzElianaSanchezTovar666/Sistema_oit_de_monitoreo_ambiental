import { useState, useEffect } from 'react';

/**
 * Hook para aplicar debounce a búsquedas y autocompletado,
 * evitando ejecuciones o llamadas a la API en cada pulsación de tecla.
 */
export function useDebounce<T>(value: T, delayMs: number = 280): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

