import { restAfterCircuitSet, roundOf } from './circuit';
import type { WorkoutSet } from './session';

/**
 * Déroulé chronologique d'une séance passée (I6-03b, § 13.8 « Replay set par set » ; constat 11 de la relecture Codex du 12/11). Module pur.
 *
 * - Ordre RÉEL d'exécution : séries validées triées par instant de validation (`doneAt`), à égalité par position. Une série validée sans instant (base
 *   ancienne, import) est placée juste après la série datée qui la précède dans la séance (en tête s'il n'y en a pas) : son rang est une estimation,
 *   son repos est inconnu.
 * - Repos réel après une série = intervalle jusqu'à la validation de la série suivante du déroulé, moins la durée de cette suivante si elle est
 *   chronométrée (au plus jusqu'à 0). Aucun instant de début de série n'est enregistré : pour une série à répétitions, l'exécution de la suivante est
 *   comprise (D-151). Un instant manquant d'un côté ou de l'autre : repos INCONNU (null), jamais 0.
 * - Cible du repos : dans un groupe, entre deux exercices d'un même tour, le repos du groupe (0 = aucun) ; sinon la cible de repos de la série (null :
 *   sans cible). Écart de `REPLAY_REST_TOLERANCE_SEC` ou moins : conforme.
 * - Charge et répétitions (ou durée d'une série chronométrée) face aux cibles de la série : au-dessus, en dessous, conforme, sans cible, non saisie.
 */

/** Écart toléré entre repos réel et cible (secondes, borne comprise) ; choix prudent révisable par Ali (D-151). */
export const REPLAY_REST_TOLERANCE_SEC = 15;

export type ReplayDeviation = 'onTarget' | 'above' | 'below' | 'noTarget' | 'noValue';
export type ReplayRestDeviation = 'onTarget' | 'longer' | 'shorter' | 'noTarget' | 'unknown' | 'last';

export interface ReplayLoad {
  readonly actual: number | null;
  readonly target: number | null;
  readonly deviation: ReplayDeviation;
  /** Réel − cible (kg, au centième) ; null sans cible ou sans valeur. */
  readonly delta: number | null;
}

export interface ReplayEffort {
  /** `duration` pour une série chronométrée (secondes), sinon `reps`. */
  readonly measure: 'reps' | 'duration';
  readonly actual: number | null;
  readonly targetMin: number | null;
  readonly targetMax: number | null;
  readonly deviation: ReplayDeviation;
  /** Écart à la borne franchie (négatif sous la borne basse) ; 0 dans la plage ; null sans cible ou sans valeur. */
  readonly delta: number | null;
}

export interface ReplayRest {
  /** Repos mesuré (secondes) ; null : inconnu (instant manquant) ou dernière série. */
  readonly actualSec: number | null;
  readonly targetSec: number | null;
  readonly deviation: ReplayRestDeviation;
  /** Réel − cible (secondes) ; null quand l'un des deux manque. */
  readonly deltaSec: number | null;
}

export interface ReplayStep {
  /** Rang dans le déroulé, à partir de 1. */
  readonly order: number;
  readonly set: WorkoutSet;
  /** Rang de la série parmi les séries de travail de son exercice (par position) ; null pour un échauffement. */
  readonly setNumber: number | null;
  /** Tour d'une série de groupe ; null hors groupe. */
  readonly round: number | null;
  readonly load: ReplayLoad;
  readonly effort: ReplayEffort;
  /** Repos pris APRÈS cette série. */
  readonly rest: ReplayRest;
}

export interface WorkoutReplay {
  readonly steps: readonly ReplayStep[];
  /** Séries non validées (absentes du déroulé). */
  readonly notDone: number;
  /** Séries validées sans instant de validation. */
  readonly missingInstants: number;
}

const byPosition = (a: WorkoutSet, b: WorkoutSet): number => a.position - b.position || a.id.localeCompare(b.id);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Ordre réel : séries datées par instant, puis chaque série sans instant après la série datée qui la précède par position. */
function executionOrder(done: readonly WorkoutSet[]): WorkoutSet[] {
  const timed = done.filter((s) => s.doneAt !== null).sort((a, b) => Date.parse(a.doneAt as string) - Date.parse(b.doneAt as string) || byPosition(a, b));
  const untimed = done.filter((s) => s.doneAt === null).sort(byPosition);
  const after = new Map<string | null, WorkoutSet[]>();
  for (const u of untimed) {
    const anchor = [...timed].filter((t) => byPosition(t, u) < 0).sort(byPosition).at(-1);
    const key = anchor?.id ?? null;
    after.set(key, [...(after.get(key) ?? []), u]);
  }
  return [...(after.get(null) ?? []), ...timed.flatMap((t) => [t, ...(after.get(t.id) ?? [])])];
}

function loadOf(set: WorkoutSet): ReplayLoad {
  const actual = set.loadKg;
  const target = set.targetLoadKg;
  if (actual === null) return { actual, target, deviation: 'noValue', delta: null };
  if (target === null) return { actual, target, deviation: 'noTarget', delta: null };
  const delta = round2(actual - target);
  return delta === 0 ? { actual, target, deviation: 'onTarget', delta: 0 } : { actual, target, deviation: delta > 0 ? 'above' : 'below', delta };
}

function effortOf(set: WorkoutSet): ReplayEffort {
  const measure = set.setKind === 'timed' ? 'duration' : 'reps';
  const actual = measure === 'duration' ? set.durationSec : set.reps;
  const base = { measure, actual, targetMin: set.targetRepsMin, targetMax: set.targetRepsMax } as const;
  if (actual === null) return { ...base, deviation: 'noValue', delta: null };
  if (set.targetRepsMin === null && set.targetRepsMax === null) return { ...base, deviation: 'noTarget', delta: null };
  if (set.targetRepsMin !== null && actual < set.targetRepsMin) return { ...base, deviation: 'below', delta: actual - set.targetRepsMin };
  if (set.targetRepsMax !== null && actual > set.targetRepsMax) return { ...base, deviation: 'above', delta: actual - set.targetRepsMax };
  return { ...base, deviation: 'onTarget', delta: 0 };
}

/** Cible du repos après `set` : repos du groupe entre deux exercices d'un tour, sinon cible de repos de la série. */
function restTarget(sets: readonly WorkoutSet[], set: WorkoutSet): number | null {
  const circuit = restAfterCircuitSet(sets, set.id);
  if (circuit !== null && circuit.phase === 'between') return set.circuitRestSec ?? 0;
  return set.targetRestSec;
}

function restOf(sets: readonly WorkoutSet[], set: WorkoutSet, next: WorkoutSet | undefined): ReplayRest {
  if (next === undefined) return { actualSec: null, targetSec: null, deviation: 'last', deltaSec: null };
  const targetSec = restTarget(sets, set);
  if (set.doneAt === null || next.doneAt === null) return { actualSec: null, targetSec, deviation: 'unknown', deltaSec: null };
  const interval = Math.round((Date.parse(next.doneAt) - Date.parse(set.doneAt)) / 1000);
  const actualSec = Math.max(0, interval - (next.setKind === 'timed' && next.durationSec !== null ? next.durationSec : 0));
  if (targetSec === null) return { actualSec, targetSec, deviation: 'noTarget', deltaSec: null };
  const deltaSec = actualSec - targetSec;
  const deviation: ReplayRestDeviation = Math.abs(deltaSec) <= REPLAY_REST_TOLERANCE_SEC ? 'onTarget' : deltaSec > 0 ? 'longer' : 'shorter';
  return { actualSec, targetSec, deviation, deltaSec };
}

/** Déroulé d'une séance (close en pratique) : étapes dans l'ordre réel, écarts, repos réels ; séries non validées comptées à part. */
export function replayWorkout(workout: { readonly sets: readonly WorkoutSet[] }): WorkoutReplay {
  const sets = [...workout.sets].sort(byPosition);
  const done = sets.filter((s) => s.done);
  const ordered = executionOrder(done);
  const numberOf = (set: WorkoutSet): number | null =>
    set.setKind === 'warmup' ? null : sets.filter((s) => s.exerciseId === set.exerciseId && s.setKind !== 'warmup').findIndex((s) => s.id === set.id) + 1;
  const steps = ordered.map(
    (set, index): ReplayStep => ({
      order: index + 1,
      set,
      setNumber: numberOf(set),
      round: roundOf(sets, set.id),
      load: loadOf(set),
      effort: effortOf(set),
      rest: restOf(sets, set, ordered[index + 1]),
    }),
  );
  return { steps, notDone: sets.length - done.length, missingInstants: done.filter((s) => s.doneAt === null).length };
}
