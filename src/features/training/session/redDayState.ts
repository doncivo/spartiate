import { DEFAULT_PROGRESSION_CONFIG } from '../../../domain/training/config';
import { isRedDay, redDaySnapshot, type RedDayChoice } from '../../../domain/training/redDay';
import type { RecoverySnapshot } from '../../../domain/training/types';
import type { WorkoutWithSets } from '../../../domain/training/session';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { localDayOf } from '../cycle/currentCycle';

/**
 * Journée rouge de la séance en cours (I5-02 point 2.2 ; § 16.7). Module à la demande, chargé par `ActiveSession` (import dynamique).
 *
 * - Lecture : Recovery du jour de DÉBUT de la séance (`recovery_day`, `recoveryRepository.getDay`), même code sur l'iPhone et le PC (le PC lit
 *   ce que la synchro lui a donné, sans recalcul). Lecture impossible, jour sans ligne ou Recovery nulle : aucune offre (jamais de faux positif).
 * - Choix d'Ali : réglage LOCAL `training.redDay` (jamais publié, aucune table ni migration), qui ne vaut que pour cette séance (`workoutId`)
 *   et garde la Recovery vue au moment du choix (une resynchronisation n'en change pas l'effet pendant la séance).
 */

export interface RedDayChoiceRecord {
  readonly v: 1;
  readonly workoutId: string;
  readonly choice: RedDayChoice;
  /** Recovery vue au moment du choix. */
  readonly recovery: number | null;
}

export interface RedDayState {
  /** Recovery du jour retenue (celle du choix s'il existe) ; null : aucune. */
  readonly recovery: number | null;
  /** Bandeau à montrer (journée rouge). */
  readonly offer: boolean;
  readonly choice: RedDayChoice | null;
  /** Entrée du moteur : seulement pour une journée rouge acceptée. */
  readonly snapshot: RecoverySnapshot | null;
}

export const NO_RED_DAY: RedDayState = { recovery: null, offer: false, choice: null, snapshot: null };

/** Valeur brute du réglage → choix de CETTE séance, ou null si absent, illisible ou d'une autre séance. */
export function parseRedDayChoice(raw: unknown, workoutId: string): RedDayChoiceRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as { v?: unknown; workoutId?: unknown; choice?: unknown; recovery?: unknown };
  if (o.v !== 1 || o.workoutId !== workoutId || (o.choice !== 'accepted' && o.choice !== 'ignored')) return null;
  const recovery = typeof o.recovery === 'number' && Number.isFinite(o.recovery) ? o.recovery : null;
  return { v: 1, workoutId, choice: o.choice, recovery };
}

function stateOf(recovery: number | null, choice: RedDayChoice | null): RedDayState {
  const offer = isRedDay(recovery, DEFAULT_PROGRESSION_CONFIG);
  if (!offer) return NO_RED_DAY;
  return { recovery, offer, choice, snapshot: redDaySnapshot(recovery, choice, DEFAULT_PROGRESSION_CONFIG) };
}

export async function loadRedDay(access: DataAccess, workout: Pick<WorkoutWithSets, 'id' | 'startedAt'>): Promise<RedDayState> {
  const [day, raw] = await Promise.all([
    access.repos
      .recovery()
      .then((repo) => repo.getDay(localDayOf(Date.parse(workout.startedAt))))
      .catch(() => null),
    access.repos.settings.get('training.redDay').catch(() => null),
  ]);
  const saved = parseRedDayChoice(raw, workout.id);
  if (saved !== null) return stateOf(saved.recovery, saved.choice);
  return stateOf(day?.summary.recovery ?? null, null);
}

/** Mémorise le choix pour cette séance ; rend le nouvel état (la base fait foi pour la reprise). */
export async function chooseRedDay(access: DataAccess, workoutId: string, state: RedDayState, choice: RedDayChoice): Promise<RedDayState> {
  const record: RedDayChoiceRecord = { v: 1, workoutId, choice, recovery: state.recovery };
  await access.repos.settings.set('training.redDay', record);
  return stateOf(state.recovery, choice);
}
