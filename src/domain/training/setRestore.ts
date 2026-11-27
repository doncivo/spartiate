import type { WorkoutSet } from './session';

/**
 * GEST-0303 (BL-169, D-653 ; relecture) : place d'une série supprimée d'un geste quand Ali l'annule. Module pur.
 *
 * Le repère est relevé au geste, dans l'unité de la série (exercice libre, ou groupe entier) : la série vivante qui la précédait (`after`),
 * sinon celle qui la suivait (`before`) ; seule de son unité, sa place et l'ordre des autres séries (`alone`). À l'annulation, la série revient à
 * côté de son repère, quel que soit l'ordre des exercices entre-temps ; repère disparu ou passé dans une autre unité, groupe défait, ou
 * (`alone`) ordre changé : null, rien n'est écrit.
 */
export type RestoreAnchor =
  | { readonly kind: 'after'; readonly id: string }
  | { readonly kind: 'before'; readonly id: string }
  | { readonly kind: 'alone'; readonly index: number; readonly order: readonly string[] };

const live = (sets: readonly WorkoutSet[]): WorkoutSet[] =>
  sets.filter((s) => (s.deletedAt ?? null) === null).sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Même unité : même groupe, ou, hors groupe, même exercice. */
const sameUnit = (a: WorkoutSet, b: WorkoutSet): boolean => {
  const group = a.circuitId ?? null;
  if (group !== (b.circuitId ?? null)) return false;
  return group !== null || a.exerciseId === b.exerciseId;
};

/** Repère de `setId` dans la séance AVANT sa suppression ; série absente : null. */
export function restoreAnchor(sets: readonly WorkoutSet[], setId: string): RestoreAnchor | null {
  const rows = live(sets);
  const index = rows.findIndex((s) => s.id === setId);
  const target = rows[index];
  if (target === undefined) return null;
  const previous = rows.slice(0, index).filter((s) => sameUnit(s, target)).at(-1);
  if (previous !== undefined) return { kind: 'after', id: previous.id };
  const next = rows.slice(index + 1).find((s) => sameUnit(s, target));
  if (next !== undefined) return { kind: 'before', id: next.id };
  return { kind: 'alone', index, order: rows.filter((s) => s.id !== setId).map((s) => s.id) };
}

/**
 * Ordre des séries vivantes avec `restored` remise à côté de son repère (`sets` : séance actuelle ; la ligne supprimée y est ignorée) ;
 * impossible à situer : null.
 */
export function restoreOrder(sets: readonly WorkoutSet[], restored: WorkoutSet, anchor: RestoreAnchor): string[] | null {
  const rows = live(sets).filter((s) => s.id !== restored.id);
  const group = restored.circuitId ?? null;
  if (group !== null && !rows.some((s) => s.circuitId === group)) return null;
  const ids = rows.map((s) => s.id);
  if (anchor.kind === 'alone') {
    if (ids.length !== anchor.order.length || ids.some((id, i) => id !== anchor.order[i])) return null;
    const at = Math.max(0, Math.min(ids.length, anchor.index));
    return [...ids.slice(0, at), restored.id, ...ids.slice(at)];
  }
  const index = rows.findIndex((s) => s.id === anchor.id);
  const neighbour = rows[index];
  if (neighbour === undefined || !sameUnit(neighbour, restored)) return null;
  const at = anchor.kind === 'after' ? index + 1 : index;
  return [...ids.slice(0, at), restored.id, ...ids.slice(at)];
}
