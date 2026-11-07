import type { ProgressionConfig } from './config';
import type { Difficulty, ExerciseSession, HistorySet } from './types';

/**
 * Estimation du 1RM (PRD § 11.2 point 1, § 11.3 ; D-72 point 2). Module pur.
 *
 * - Epley `w × (1 + reps/30)`, indicatif.
 * - 1RM d'une séance = sa meilleure série Epley ; une séance n'est jamais comptée série par série.
 * - 1RM courant = moyenne pondérée des trois dernières séances valides (1 / 0,6 / 0,3), chaque séance gardant le poids 0,25 de sa
 *   meilleure série si elle dépasse 15 reps ou reste sous 60 % du 1RM courant d'avant elle.
 * - Exclus des statistiques (gardés dans l'historique brut) : échauffements, drops, partielles, chronométrées, séries non faites, séries
 *   aberrantes non confirmées (> 150 % du 1RM courant), séances à moins de 50 % de séries faites, séances de deload (I2-02).
 */

export const epley = (loadKg: number, reps: number): number => loadKg * (1 + reps / 30);

/** Série de travail validée, reps entières ≥ 1 et charge finie > 0. */
export function isEligibleSet(set: HistorySet): boolean {
  return set.done && set.setKind === 'work' && set.reps !== null && Number.isInteger(set.reps) && set.reps >= 1 && set.loadKg !== null && Number.isFinite(set.loadKg) && set.loadKg > 0;
}

/** Poids d'une série : `lowQualityWeight` au-delà de `maxRepsForEstimate` reps ou sous `lowLoadRatio` du 1RM courant, sinon 1. */
export function setWeight(set: { readonly loadKg: number; readonly reps: number }, current1rmKg: number | null, config: ProgressionConfig): number {
  const tooManyReps = set.reps > config.maxRepsForEstimate;
  const tooLight = current1rmKg !== null && set.loadKg < config.lowLoadRatio * current1rmKg;
  return tooManyReps || tooLight ? config.lowQualityWeight : 1;
}

/** Moyenne pondérée par récence (séances de la plus récente à la plus ancienne) ; null sans séance. */
export function current1rmFromSessions(sessions: readonly { readonly e1rmKg: number; readonly quality: number }[], config: ProgressionConfig): number | null {
  let sum = 0;
  let weights = 0;
  config.recencyWeights.forEach((recency, i) => {
    const s = sessions[i];
    if (s === undefined) return;
    sum += recency * s.quality * s.e1rmKg;
    weights += recency * s.quality;
  });
  return weights > 0 ? sum / weights : null;
}

/** Séance valide, résumée par sa meilleure série. */
export interface SessionEstimate {
  readonly workoutId: string;
  readonly endedAt: ExerciseSession['endedAt'];
  readonly difficulty: Difficulty | null;
  readonly e1rmKg: number;
  readonly quality: number;
  readonly validSets: number;
  /** Séries retenues (éligibles, non aberrantes), par position. */
  readonly sets: readonly (HistorySet & { readonly loadKg: number; readonly reps: number })[];
}

export interface HistoryAnalysis {
  /** Séances valides, de la plus récente à la plus ancienne. */
  readonly estimates: readonly SessionEstimate[];
  /** Séance la plus récente ayant au moins une série de travail : ignorée (moins de 50 % faites) ou séries aberrantes écartées. */
  readonly latest: { readonly workoutId: string; readonly partial: boolean; readonly outliers: number } | null;
}

/** Ordre chronologique stable : fin de séance, puis identifiant. */
const chronological = (a: ExerciseSession, b: ExerciseSession): number => (a.endedAt < b.endedAt ? -1 : a.endedAt > b.endedAt ? 1 : a.workoutId < b.workoutId ? -1 : a.workoutId > b.workoutId ? 1 : 0);

export function analyzeHistory(history: readonly ExerciseSession[], config: ProgressionConfig): HistoryAnalysis {
  const valid: SessionEstimate[] = [];
  let latest: HistoryAnalysis['latest'] = null;
  for (const session of [...history].sort(chronological)) {
    // Deload (I2-02, § 11.3) : visible dans l'historique brut, exclu des statistiques.
    if (session.deload === true) continue;
    const work = session.sets.filter((s) => s.setKind === 'work');
    if (work.length === 0) continue;
    const eligible = work.filter(isEligibleSet) as (HistorySet & { loadKg: number; reps: number })[];
    if (eligible.length < config.minCompletedFraction * work.length) {
      latest = { workoutId: session.workoutId, partial: true, outliers: 0 };
      continue;
    }
    const current = current1rmFromSessions(valid, config);
    const kept = eligible.filter((s) => s.confirmed === true || current === null || epley(s.loadKg, s.reps) <= config.outlierRatio * current);
    latest = { workoutId: session.workoutId, partial: false, outliers: eligible.length - kept.length };
    if (kept.length === 0) continue;
    const sets = [...kept].sort((a, b) => a.position - b.position);
    // Meilleure série : e1RM maximal, la première par position à égalité.
    const best = sets.reduce((top, s) => (epley(s.loadKg, s.reps) > epley(top.loadKg, top.reps) ? s : top));
    valid.unshift({
      workoutId: session.workoutId,
      endedAt: session.endedAt,
      difficulty: session.difficulty,
      e1rmKg: epley(best.loadKg, best.reps),
      quality: setWeight(best, current, config),
      validSets: sets.length,
      sets,
    });
  }
  return { estimates: valid, latest };
}
