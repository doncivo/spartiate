import { confidenceOf } from '../../../domain/training/confidence';
import { DEFAULT_PROGRESSION_CONFIG } from '../../../domain/training/config';
import { analyzeHistory, current1rmFromSessions } from '../../../domain/training/estimate1rm';
import type { Difficulty, Exercise, ExerciseSession } from '../../../domain/training/types';
import type { IsoDateTime } from '../../../domain/types';

/**
 * ERGO-02 : chiffres de la fiche exercice (aperçu Fiche-apres, PC-Fiche-apres), lus de l'historique clos de l'exercice. Aucune règle neuve :
 * le 1RM estimé et sa confiance sont ceux du moteur (`analyzeHistory`, `current1rmFromSessions`, `confidenceOf`, config du PRD) ; le reste est
 * une lecture (meilleure série validée, séances récentes). Module à la demande, avec la fiche.
 */

export type SheetOneRm =
  | { readonly kind: 'value'; readonly kg: number; readonly confidence: number; readonly sessions: number }
  | { readonly kind: 'none'; readonly reason: 'noHistory' | 'noValid' | 'notLoad' | 'bodyweight' };

export interface SheetRecord {
  readonly loadKg: number;
  readonly reps: number;
  readonly endedAt: IsoDateTime;
}

/** Évolution du 1RM estimé : une valeur par séance valide des 8 dernières semaines, de la plus ancienne à la plus récente. */
export interface SheetTrend {
  readonly values: readonly number[];
  readonly deltaKg: number;
}

/** Séries de travail validées d'une séance, groupées par charge consécutive (« 67,5 × 8, 8, 7 »). */
export interface SheetSession {
  readonly workoutId: string;
  readonly endedAt: IsoDateTime;
  readonly difficulty: Difficulty | null;
  readonly deload: boolean;
  readonly groups: readonly { readonly loadKg: number | null; readonly reps: readonly number[] }[];
}

export interface SheetStats {
  readonly oneRm: SheetOneRm;
  readonly record: SheetRecord | null;
  /** Null : moins de deux séances valides en 8 semaines. */
  readonly trend: SheetTrend | null;
  /** Séances closes ayant au moins une série de travail validée, de la plus récente à la plus ancienne. */
  readonly sessions: readonly SheetSession[];
}

export const TREND_DAYS = 56;
const DAY_MS = 86_400_000;

const byRecent = (a: { readonly endedAt: string }, b: { readonly endedAt: string }): number => (a.endedAt < b.endedAt ? 1 : a.endedAt > b.endedAt ? -1 : 0);

function oneRmOf(history: readonly ExerciseSession[], exercise: Pick<Exercise, 'metric' | 'bodyweightFraction'>, now: IsoDateTime): SheetOneRm {
  if (exercise.metric !== 'load-reps') return { kind: 'none', reason: 'notLoad' };
  if (exercise.bodyweightFraction) return { kind: 'none', reason: 'bodyweight' };
  if (history.length === 0) return { kind: 'none', reason: 'noHistory' };
  const { estimates } = analyzeHistory(history, DEFAULT_PROGRESSION_CONFIG);
  const kg = current1rmFromSessions(estimates, DEFAULT_PROGRESSION_CONFIG);
  if (kg === null) return { kind: 'none', reason: 'noValid' };
  return { kind: 'value', kg, confidence: confidenceOf(estimates, now, DEFAULT_PROGRESSION_CONFIG), sessions: estimates.length };
}

export function sheetStats(history: readonly ExerciseSession[], exercise: Pick<Exercise, 'metric' | 'bodyweightFraction'>, now: IsoDateTime): SheetStats {
  const sessions: SheetSession[] = [];
  let record: SheetRecord | null = null;
  for (const session of [...history].sort(byRecent)) {
    const work = session.sets.filter((s) => s.done && s.setKind === 'work' && s.reps !== null).sort((a, b) => a.position - b.position);
    if (work.length === 0) continue;
    const groups: { loadKg: number | null; reps: number[] }[] = [];
    for (const set of work) {
      const last = groups.at(-1);
      if (last !== undefined && last.loadKg === set.loadKg) last.reps.push(set.reps as number);
      else groups.push({ loadKg: set.loadKg, reps: [set.reps as number] });
      // Record : charge la plus lourde, puis le plus de répétitions à cette charge ; à égalité, la séance la plus ancienne l'a établi.
      if (set.loadKg !== null && set.loadKg > 0 && (record === null || set.loadKg > record.loadKg || (set.loadKg === record.loadKg && (set.reps as number) >= record.reps)))
        record = { loadKg: set.loadKg, reps: set.reps as number, endedAt: session.endedAt };
    }
    sessions.push({ workoutId: session.workoutId, endedAt: session.endedAt, difficulty: session.difficulty, deload: session.deload === true, groups });
  }
  const oneRm = oneRmOf(history, exercise, now);
  let trend: SheetTrend | null = null;
  if (oneRm.kind === 'value') {
    const from = Date.parse(now) - TREND_DAYS * DAY_MS;
    const values = analyzeHistory(history, DEFAULT_PROGRESSION_CONFIG)
      .estimates.filter((e) => Date.parse(e.endedAt) >= from)
      .map((e) => e.e1rmKg)
      .reverse();
    const first = values[0];
    const last = values.at(-1);
    if (values.length >= 2 && first !== undefined && last !== undefined) trend = { values, deltaKg: last - first };
  }
  return { oneRm, record, trend, sessions };
}
