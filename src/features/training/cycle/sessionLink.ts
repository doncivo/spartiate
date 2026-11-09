import type { Workout } from '../../../domain/training/session';

/**
 * I4-08 (points 4 et 5) : lien local d'une séance proposée (« Séance proposée », I3-01) avec sa routine source et le RIR cible de chaque
 * exercice. Une séance proposée est une séance libre (`source = 'empty'`, aucune routine liée, pas de « Mettre à jour la routine ? ») : sans
 * colonne pour ce lien (aucune migration en 0.9.1), il est gardé dans le réglage LOCAL `training.cycleSession` (jamais publié), écrit dans la
 * transaction qui crée la séance, et ne vaut que pour cette séance (`workoutId`). Le RIR cible suit ensuite la séance dans la prescription
 * tracée (`recommendation_decision.prescription.rirTarget`, publiée à la clôture, D-27 inchangé).
 */

export interface SessionLink {
  readonly v: 1;
  readonly workoutId: string;
  /** Routine dont la séance a été proposée. */
  readonly routineId: string;
  /** RIR cible proposé par exercice (semaine du cycle, sinon ligne de la routine) ; null : aucun. */
  readonly rir: Readonly<Record<string, number | null>>;
}

const isRir = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10);

/** Valeur brute du réglage → lien, ou null si absente ou illisible (aucune valeur inventée). */
export function parseSessionLink(raw: unknown): SessionLink | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as { v?: unknown; workoutId?: unknown; routineId?: unknown; rir?: unknown };
  if (o.v !== 1 || typeof o.workoutId !== 'string' || o.workoutId === '' || typeof o.routineId !== 'string' || o.routineId === '') return null;
  if (typeof o.rir !== 'object' || o.rir === null || Array.isArray(o.rir)) return null;
  const rir: Record<string, number | null> = {};
  for (const [id, value] of Object.entries(o.rir as Record<string, unknown>)) if (isRir(value)) rir[id] = value;
  return { v: 1, workoutId: o.workoutId, routineId: o.routineId, rir };
}

/** Routine dont la séance est issue : démarrée depuis la routine, ou proposée depuis elle (lien local de cette séance) ; sinon null. */
export function sessionRoutineId(workout: Pick<Workout, 'id' | 'routineId'>, link: SessionLink | null): string | null {
  if (workout.routineId !== null) return workout.routineId;
  return link !== null && link.workoutId === workout.id ? link.routineId : null;
}

/** RIR cible proposé pour cet exercice de cette séance (séance proposée seulement) ; null sinon. */
export function linkedRir(workout: Pick<Workout, 'id'>, link: SessionLink | null, exerciseId: string): number | null {
  if (link === null || link.workoutId !== workout.id) return null;
  return link.rir[exerciseId] ?? null;
}
