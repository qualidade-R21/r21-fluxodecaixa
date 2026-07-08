import { useState } from 'react';

const STORAGE_KEY = 'gc_modo_oculto';

export function useModoOculto() {
  const [modoOculto, setModoOculto] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setModoOculto(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  return { modoOculto, toggle };
}