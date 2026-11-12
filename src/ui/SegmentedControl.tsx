import { useCallback, useEffect, useRef, useState } from 'react';
import './SegmentedControl.css';

export interface SegmentedOption<V extends string> {
  readonly value: V;
  readonly label: string;
}

export interface SegmentedControlProps<V extends string> {
  readonly options: readonly SegmentedOption<V>[];
  readonly value: V;
  readonly onChange: (value: V) => void;
  /** Nom accessible du groupe (clé i18n résolue par l'appelant). */
  readonly label: string;
  readonly disabled?: boolean;
  /** Disposition en grille de deux colonnes (quatre choix : 2 × 2) ; sans valeur, une rangée qui passe à la ligne si besoin. */
  readonly columns?: 2;
  /** Une seule ligne qui défile horizontalement (comme une barre d'onglets iOS), choix actif toujours visible ; pour cinq choix ou plus à 440 px. */
  readonly scrollable?: boolean;
}

/**
 * Contrôle segmenté à choix unique (P-02, P-03 : thème, premier jour, format d'heure), aspect de `SpaceSegmented`, boutons de 44 pt.
 * Accessibilité : `radiogroup` ; flèches gauche / droite déplacent le choix, une seule tabulation pour le groupe.
 */
export function SegmentedControl<V extends string>({ options, value, onChange, label, disabled = false, columns, scrollable = false }: SegmentedControlProps<V>) {
  const root = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ start: false, end: false });
  /** Choix observés : la liste change quand un choix est ajouté ou retiré (pas à chaque rendu d'un tableau recréé). */
  const optionsKey = options.map((o) => o.value).join('|');
  /** FIX-0115 : fondu sur un bord tant qu'il reste des choix cachés de ce côté (1 px de tolérance pour les arrondis). */
  const measureFade = useCallback((): void => {
    const el = root.current;
    if (!scrollable || !el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade((old) => (old.start === start && old.end === end ? old : { start, end }));
  }, [scrollable]);
  useEffect(() => {
    if (!scrollable) return;
    root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    measureFade();
  }, [scrollable, value, measureFade]);
  useEffect(() => {
    if (!scrollable) return;
    // FIX-0173 : la rangée ET ses choix sont observés (police plus grande, libellé changé, panneau redimensionné) ; sans ResizeObserver, la fenêtre.
    const Observer = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    const el = root.current;
    if (typeof Observer === 'function' && el) {
      const observer = new Observer(() => measureFade());
      observer.observe(el);
      for (const child of Array.from(el.children)) observer.observe(child);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measureFade);
    return () => window.removeEventListener('resize', measureFade);
  }, [scrollable, measureFade, optionsKey]);
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[(index + step + options.length) % options.length]?.focus();
  }
  return (
    <div className="ct-segmented" ref={root} data-columns={columns} data-scroll={scrollable || undefined} data-fade-start={fade.start || undefined} data-fade-end={fade.end || undefined} onScroll={scrollable ? measureFade : undefined} role="radiogroup" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          disabled={disabled}
          className="ct-segmented__button"
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
