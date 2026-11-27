import { LONG_PRESS_MS, dropIndex, lockAxis, swipeOffset, swipeOutcome, withinSlop, type GestureAxis, type Span } from '../../../domain/training/sessionGestures';

/**
 * GEST-0303 (BL-169, D-653, § 18.1) : les deux gestes iPhone de la séance active, et rien d'autre. Bloc chargé à la demande par la séance
 * (jamais dans le départ, jamais sur un PC sans écran tactile) ; écouteurs posés directement sur le DOM, seuils et calculs dans le domaine.
 *
 * - `attachSwipeToDelete` : glisser une série d'un doigt vers la gauche au-delà du seuil appelle `onSwipe` ; en deçà, retour élastique
 *   (classe `ct-session__set--returning`) ; un défilement vertical, un pointeur qui n'est pas un doigt ou un geste parti d'un champ ne fait rien.
 * - `attachLongPressReorder` : appui long sur la tête d'un exercice (`[data-reorder-handle]` dans `[data-reorder-key]`) : `onLift`, puis le
 *   doigt glisse vers le haut ou le bas (le défilement est bloqué) et `onDrop` reçoit la place d'insertion au relâchement.
 * Chaque geste relit `enabled()` à l'appui (pause, écriture en cours). Le geste est un raccourci : boutons et clavier restent.
 */

export interface SwipeOptions {
  readonly enabled: () => boolean;
  readonly onSwipe: () => void;
}

export interface ReorderOptions {
  readonly enabled: () => boolean;
  readonly onLift: (key: string) => void;
  /** `toIndex` : place d'insertion (`moveUnitOrder`) ; différente de la place d'origine. */
  readonly onDrop: (key: string, toIndex: number) => void;
  readonly onCancel: () => void;
}

export interface SessionGestures {
  attachSwipeToDelete(row: HTMLElement, options: SwipeOptions): () => void;
  attachLongPressReorder(root: HTMLElement, options: ReorderOptions): () => void;
}

const SWIPING = 'ct-session__set--swiping';
const ARMED = 'ct-session__set--armed';
const RETURNING = 'ct-session__set--returning';
const LIFTED = 'ct-session__block--lifted';
const FIELDS = 'input, select, textarea';

const isFinger = (event: PointerEvent): boolean => event.pointerType === 'touch' && event.isPrimary !== false;
const capture = (el: Element, pointerId: number): void => {
  try {
    el.setPointerCapture?.(pointerId);
  } catch {
    // Pointeur déjà relâché ou synthétique : le geste continue sans capture.
  }
};

export function attachSwipeToDelete(row: HTMLElement, options: SwipeOptions): () => void {
  let start: { readonly id: number; readonly x: number; readonly y: number } | null = null;
  let axis: GestureAxis = 'pending';
  const previousTouchAction = row.style.touchAction;
  // Les glissés horizontaux arrivent au geste, le défilement vertical et le zoom restent au système.
  row.style.touchAction = 'pan-y pinch-zoom';

  const reset = (): void => {
    row.classList.remove(SWIPING, ARMED);
    row.style.transform = '';
  };
  const down = (event: PointerEvent): void => {
    if (!isFinger(event) || !options.enabled()) return;
    if (event.target instanceof Element && event.target.closest(FIELDS) !== null) return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    axis = 'pending';
    row.classList.remove(RETURNING);
  };
  const move = (event: PointerEvent): void => {
    if (start === null || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const wasPending = axis === 'pending';
    axis = lockAxis(axis, dx, event.clientY - start.y);
    if (axis === 'vertical') {
      start = null;
      reset();
      return;
    }
    if (axis !== 'horizontal') return;
    if (wasPending) capture(row, event.pointerId);
    const offset = swipeOffset(axis, dx);
    row.classList.add(SWIPING);
    row.classList.toggle(ARMED, swipeOutcome(axis, dx) === 'delete');
    row.style.transform = `translateX(${String(offset)}px)`;
  };
  const up = (event: PointerEvent): void => {
    if (start === null || event.pointerId !== start.id) return;
    const outcome = swipeOutcome(axis, event.clientX - start.x);
    const swiped = axis === 'horizontal';
    start = null;
    axis = 'pending';
    reset();
    if (outcome === 'delete' && options.enabled()) {
      options.onSwipe();
      return;
    }
    if (swiped) row.classList.add(RETURNING);
  };
  const cancel = (): void => {
    if (start === null) return;
    const swiped = axis === 'horizontal';
    start = null;
    axis = 'pending';
    reset();
    if (swiped) row.classList.add(RETURNING);
  };
  const settled = (): void => row.classList.remove(RETURNING);

  row.addEventListener('pointerdown', down);
  row.addEventListener('pointermove', move);
  row.addEventListener('pointerup', up);
  row.addEventListener('pointercancel', cancel);
  row.addEventListener('transitionend', settled);
  return () => {
    row.removeEventListener('pointerdown', down);
    row.removeEventListener('pointermove', move);
    row.removeEventListener('pointerup', up);
    row.removeEventListener('pointercancel', cancel);
    row.removeEventListener('transitionend', settled);
    reset();
    row.classList.remove(RETURNING);
    row.style.touchAction = previousTouchAction;
  };
}

/** Boîte verticale de chaque unité (exercice libre ou groupe : réunion de ses blocs), dans l'ordre affiché. */
function unitSpans(root: HTMLElement): { readonly keys: string[]; readonly spans: Span[] } {
  const byKey = new Map<string, { top: number; bottom: number }>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-reorder-key]')) {
    const key = el.dataset.reorderKey ?? '';
    const rect = el.getBoundingClientRect();
    const span = byKey.get(key);
    if (span === undefined) byKey.set(key, { top: rect.top, bottom: rect.bottom });
    else byKey.set(key, { top: Math.min(span.top, rect.top), bottom: Math.max(span.bottom, rect.bottom) });
  }
  return { keys: [...byKey.keys()], spans: [...byKey.values()] };
}

export function attachLongPressReorder(root: HTMLElement, options: ReorderOptions): () => void {
  let press: { readonly id: number; readonly key: string; readonly x: number; readonly y: number; readonly target: Element } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lifted: { readonly id: number; readonly key: string; readonly startY: number; lastY: number } | null = null;

  const blocks = (key: string): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('[data-reorder-key]')].filter((el) => el.dataset.reorderKey === key);
  const clearTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const drop = (): void => {
    if (lifted === null) return;
    for (const el of blocks(lifted.key)) {
      el.classList.remove(LIFTED);
      el.style.transform = '';
    }
    lifted = null;
  };
  const down = (event: PointerEvent): void => {
    if (!isFinger(event) || press !== null || lifted !== null) return;
    const handle = event.target instanceof Element ? event.target.closest('[data-reorder-handle]') : null;
    const key = handle?.closest<HTMLElement>('[data-reorder-key]')?.dataset.reorderKey;
    if (handle === null || handle === undefined || key === undefined || !options.enabled()) return;
    press = { id: event.pointerId, key, x: event.clientX, y: event.clientY, target: handle };
    timer = setTimeout(() => {
      timer = null;
      const held = press;
      press = null;
      if (held === null || !options.enabled()) return;
      lifted = { id: held.id, key: held.key, startY: held.y, lastY: held.y };
      capture(held.target, held.id);
      for (const el of blocks(held.key)) el.classList.add(LIFTED);
      options.onLift(held.key);
    }, LONG_PRESS_MS);
  };
  const move = (event: PointerEvent): void => {
    if (press !== null && event.pointerId === press.id) {
      // Le doigt bouge avant l'appui long : c'est un défilement.
      if (!withinSlop(event.clientX - press.x, event.clientY - press.y)) {
        clearTimer();
        press = null;
      }
      return;
    }
    if (lifted === null || event.pointerId !== lifted.id) return;
    lifted.lastY = event.clientY;
    const shift = event.clientY - lifted.startY;
    for (const el of blocks(lifted.key)) el.style.transform = `translateY(${String(shift)}px)`;
  };
  const up = (event: PointerEvent): void => {
    if (press !== null && event.pointerId === press.id) {
      clearTimer();
      press = null;
      return;
    }
    if (lifted === null || event.pointerId !== lifted.id) return;
    const { key } = lifted;
    const y = event.clientY;
    // Boîtes lues sans le décalage visuel de l'exercice soulevé.
    for (const el of blocks(key)) el.style.transform = '';
    const { keys, spans } = unitSpans(root);
    const from = keys.indexOf(key);
    const to = from < 0 ? -1 : dropIndex(spans, from, y);
    drop();
    if (to >= 0 && to !== from && options.enabled()) options.onDrop(key, to);
    else options.onCancel();
  };
  const cancel = (event: PointerEvent): void => {
    if (press !== null && event.pointerId === press.id) {
      clearTimer();
      press = null;
    }
    if (lifted !== null && event.pointerId === lifted.id) {
      drop();
      options.onCancel();
    }
  };
  // Doigt soulevé : le défilement de la page est bloqué tant que l'exercice est tenu (écouteur non passif).
  const touchMove = (event: TouchEvent): void => {
    if (lifted !== null && event.cancelable) event.preventDefault();
  };
  // Menu contextuel et loupe du système sur un appui long d'une tête d'exercice : retirés (le geste est l'appui long).
  const contextMenu = (event: Event): void => {
    if (event.target instanceof Element && event.target.closest('[data-reorder-handle]') !== null) event.preventDefault();
  };

  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('touchmove', touchMove, { passive: false });
  root.addEventListener('contextmenu', contextMenu);
  return () => {
    clearTimer();
    press = null;
    drop();
    root.removeEventListener('pointerdown', down);
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerup', up);
    root.removeEventListener('pointercancel', cancel);
    root.removeEventListener('touchmove', touchMove);
    root.removeEventListener('contextmenu', contextMenu);
  };
}

export const sessionGestures: SessionGestures = { attachSwipeToDelete, attachLongPressReorder };
