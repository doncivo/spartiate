import { RECOVERY_SPLIT_CONFIG } from './config';
import { primaryMuscle } from './prescribe';
import type { MuscleWeight } from './types';

/**
 * Recovery Split (I5-02 point 2.2 ; § 16.3 « par muscle », § 16.4, § 16.1 niveau A). Module pur : le pourcentage vient de `muscle_recovery`
 * (écrit par l'iPhone, lu tel quel sur le PC, sans recalcul). Approximation, jamais un diagnostic.
 *
 * - Muscles montrés : le muscle principal de chaque exercice de la séance (premier de poids maximal), sans doublon, dans l'ordre.
 * - Muscle sans ligne du jour, ou valeur illisible (non finie, hors [0, 100]) : « inconnu », jamais 0 ni 100 %.
 * - Repère : « à ménager » sous `spareBelowPercent`, sinon « prêt ». La suggestion prudente signale les muscles à ménager, sans rien modifier.
 */

export type MuscleReadiness = 'ready' | 'spare' | 'unknown';

export interface SplitMuscle {
  readonly muscleId: string;
  readonly percent: number | null;
  readonly readiness: MuscleReadiness;
}

export function sessionPrimaryMuscles(exercises: readonly { readonly muscles: readonly MuscleWeight[] }[]): string[] {
  const out: string[] = [];
  for (const e of exercises) {
    const id = primaryMuscle(e.muscles);
    if (id !== null && !out.includes(id)) out.push(id);
  }
  return out;
}

export function recoverySplit(muscleIds: readonly string[], rows: readonly { readonly muscleId: string; readonly percent: number }[]): SplitMuscle[] {
  const byId = new Map(rows.map((r) => [r.muscleId, r.percent]));
  return muscleIds.map((muscleId) => {
    const raw = byId.get(muscleId);
    const percent = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 100 ? Math.round(raw) : null;
    const readiness: MuscleReadiness = percent === null ? 'unknown' : percent < RECOVERY_SPLIT_CONFIG.spareBelowPercent ? 'spare' : 'ready';
    return { muscleId, percent, readiness };
  });
}

/** Muscles à ménager (mesurés sous le seuil) ; un muscle inconnu n'est jamais signalé. */
export const musclesToSpare = (split: readonly SplitMuscle[]): string[] => split.filter((m) => m.readiness === 'spare').map((m) => m.muscleId);
