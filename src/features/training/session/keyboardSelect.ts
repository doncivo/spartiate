import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

/**
 * SEANCE-0292 (C-080, D-524) : liste déroulante qui n'écrit pas à chaque flèche. Au clavier (flèches, Début, Fin, Page), le choix parcouru
 * reste affiché sans être écrit ; il est écrit à Entrée ou à la sortie du champ. Au doigt ou à la souris (un seul événement), il est écrit
 * aussitôt, comme avant.
 */
const BROWSE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

export function useKeyboardSelect(value: string, commit: (next: string) => void): {
  readonly value: string;
  readonly onKeyDown: (event: KeyboardEvent<HTMLSelectElement>) => void;
  readonly onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onBlur: () => void;
} {
  const browsing = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const flush = (): void => {
    browsing.current = false;
    if (pending !== null) {
      setPending(null);
      if (pending !== value) commit(pending);
    }
  };
  return {
    value: pending ?? value,
    onKeyDown: (event) => {
      if (BROWSE_KEYS.has(event.key)) browsing.current = true;
      else if (event.key === 'Enter') flush();
    },
    onChange: (event) => {
      if (browsing.current) setPending(event.target.value);
      else commit(event.target.value);
    },
    onBlur: flush,
  };
}
