import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { SessionUnit } from '../../../domain/training/sessionOrder';
import { tSession } from '../../../i18n/trainingSessionText';

/**
 * SESS-01b (§ 13.2 « Bandeau : vignettes réordonnables ; glisser ») : une vignette par exercice libre ou par groupe, dans l'ordre de la séance.
 * Glisser une vignette sur une autre (pointeur : doigt ou souris) la place à cet endroit ; au clavier, Alt + flèche gauche / droite. Un appui
 * simple amène l'exercice à l'écran. L'ordre est écrit par l'appelant (`onMove`) ; le focus suit la vignette déplacée.
 */

export interface SessionStripProps {
  readonly units: readonly SessionUnit[];
  readonly nameOf: (unit: SessionUnit) => string;
  /** Unité de la série en cours. */
  readonly currentKey: string | null;
  readonly busy: boolean;
  readonly onMove: (key: string, toIndex: number) => void;
  readonly onShow: (unit: SessionUnit) => void;
}

export function SessionStrip({ units, nameOf, currentKey, busy, onMove, onShow }: SessionStripProps) {
  const drag = useRef<{ readonly key: string; readonly pointerId: number } | null>(null);
  /** Vignette à refocaliser quand l'ordre aura changé (déplacement écrit puis séance relue) ; effacée aussitôt après. */
  const pending = useRef<{ readonly key: string; readonly order: string } | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const order = units.map((u) => u.key).join('|');

  useEffect(() => {
    const wanted = pending.current;
    if (wanted === null || wanted.order === order) return;
    pending.current = null;
    buttons.current.get(wanted.key)?.focus();
  }, [order]);

  if (units.length < 2) return null;

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, key: string, index: number): void => {
    if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const to = index + (event.key === 'ArrowLeft' ? -1 : 1);
    if (busy || to < 0 || to >= units.length) return;
    pending.current = { key, order };
    onMove(key, to);
  };
  const onDown = (event: PointerEvent<HTMLButtonElement>, key: string): void => {
    if (busy) return;
    drag.current = { key, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onUp = (event: PointerEvent<HTMLButtonElement>, unit: SessionUnit, index: number): void => {
    const started = drag.current;
    drag.current = null;
    if (started === null || started.pointerId !== event.pointerId) return;
    const over = document.elementFromPoint?.(event.clientX, event.clientY)?.closest<HTMLElement>('[data-unit-index]');
    const to = over ? Number(over.dataset.unitIndex) : index;
    if (Number.isInteger(to) && to !== index) {
      pending.current = { key: started.key, order };
      onMove(started.key, to);
    } else onShow(unit);
  };

  return (
    <div className="ct-session__strip-wrap">
      <ol className="ct-session__strip" aria-label={tSession('stripLabel')} aria-describedby="ct-session-strip-hint">
        {units.map((unit, index) => (
          <li key={unit.key} className="ct-session__strip-item">
            <button
              type="button"
              ref={(el) => {
                if (el) buttons.current.set(unit.key, el);
                else buttons.current.delete(unit.key);
              }}
              className="ct-session__chip"
              data-unit-index={index}
              aria-current={unit.key === currentKey ? 'step' : undefined}
              onKeyDown={(e) => onKey(e, unit.key, index)}
              onPointerDown={(e) => onDown(e, unit.key)}
              onPointerUp={(e) => onUp(e, unit, index)}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onClick={(e) => {
                // Clic clavier (Entrée, Espace) : aucun pointeur ; un clic de pointeur est traité au relâchement.
                if (e.detail === 0) onShow(unit);
              }}
            >
              {tSession('stripItem', { n: index + 1, name: nameOf(unit) })}
            </button>
          </li>
        ))}
      </ol>
      <p id="ct-session-strip-hint" className="ct-session__hint">
        {tSession('stripHint')}
      </p>
    </div>
  );
}
