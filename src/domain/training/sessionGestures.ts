/**
 * GEST-0303 (BL-169, D-653, § 18.1) : seuils et calculs purs des deux gestes iPhone de la séance active. Module pur (aucun DOM).
 *
 * - Glisser une série vers la gauche : l'axe est choisi après `GESTURE_SLOP_PX` (vertical en cas d'égalité : le défilement l'emporte) et ne
 *   change plus pendant le geste ; seule une série glissée horizontalement d'au moins `SWIPE_DELETE_PX` vers la gauche est supprimée.
 * - Appui long sur un exercice : tenu `LONG_PRESS_MS` sans sortir de `GESTURE_SLOP_PX` (sinon c'est un défilement) ; la place d'insertion
 *   est le nombre des autres exercices dont le milieu est au-dessus du doigt (index de `moveUnitOrder`).
 */

export const GESTURE_SLOP_PX = 10;
export const SWIPE_DELETE_PX = 96;
export const LONG_PRESS_MS = 500;

export type GestureAxis = 'pending' | 'horizontal' | 'vertical';
export type SwipeOutcome = 'delete' | 'return';

export interface Span {
  readonly top: number;
  readonly bottom: number;
}

const finite = (...values: readonly number[]): boolean => values.every((v) => Number.isFinite(v));

/** Axe du geste après un déplacement (dx, dy) depuis le point de départ ; un axe choisi est gardé. */
export function lockAxis(axis: GestureAxis, dx: number, dy: number, slop: number = GESTURE_SLOP_PX): GestureAxis {
  if (axis !== 'pending') return axis;
  if (!finite(dx, dy) || Math.max(Math.abs(dx), Math.abs(dy)) < slop) return 'pending';
  return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
}

/** Décalage affiché de la série : vers la gauche seulement, sur l'axe horizontal seulement. */
export function swipeOffset(axis: GestureAxis, dx: number): number {
  if (axis !== 'horizontal' || !finite(dx)) return 0;
  return Math.min(0, dx);
}

/** Issue du geste au relâchement : suppression au-delà du seuil (compris), sinon retour élastique. */
export function swipeOutcome(axis: GestureAxis, dx: number, threshold: number = SWIPE_DELETE_PX): SwipeOutcome {
  return axis === 'horizontal' && finite(dx) && dx <= -threshold ? 'delete' : 'return';
}

/** Le doigt est resté dans le seuil depuis l'appui (l'appui long continue). */
export function withinSlop(dx: number, dy: number, slop: number = GESTURE_SLOP_PX): boolean {
  return finite(dx, dy) && Math.max(Math.abs(dx), Math.abs(dy)) < slop;
}

/**
 * Place d'insertion de l'exercice soulevé (`from`, index dans `spans`) quand le doigt est à `y` : nombre des autres boîtes dont le milieu
 * est au-dessus de `y`. Position non finie : `from` (rien ne bouge) ; `from` hors de la liste : 0.
 */
export function dropIndex(spans: readonly Span[], from: number, y: number): number {
  if (!Number.isInteger(from) || from < 0 || from >= spans.length) return 0;
  if (!finite(y)) return from;
  return spans.filter((span, index) => index !== from && (span.top + span.bottom) / 2 < y).length;
}
