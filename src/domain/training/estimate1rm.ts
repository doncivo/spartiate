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
 * - FIX-ABERR (C-005, C-028) : une série aberrante est confirmée par le champ `confirmed`, ou par une séance ULTÉRIEURE COMPLÈTE (≥ 50 %
 *   des séries faites) hors décharge qui l'atteint à 90 % ; une séance partielle ou de décharge ne confirme jamais.
 */

export const epley = (loadKg: number, reps: number): number => loadKg * (1 + reps / 30);

/**
 * Exercice au poids du corps lesté ou assisté (REV-01, `bodyweightFraction`) : charge TOTALE = `baseKg` (poids de corps × fraction) + lest
 * (`sign` 1) ou − assistance (`sign` −1). La charge saisie et affichée reste le lest (ou l'assistance) ; seuls le 1RM estimé et les écarts
 * de charge se calculent sur le total. Null : exercice ordinaire, ou poids de corps inconnu (comportement d'avant).
 */
export interface BodyLoad {
  readonly baseKg: number;
  readonly sign: 1 | -1;
}

/** Charge totale d'une série ; la charge saisie elle-même sans `body`. */
export const totalLoad = (loadKg: number, body: BodyLoad | null | undefined): number => (body == null ? loadKg : body.baseKg + body.sign * loadKg);

/**
 * Série de travail validée, reps entières ≥ 1 et charge finie > 0. Avec un poids de corps connu, un lest nul ou absent compte (traction au
 * poids du corps) tant que la charge totale est positive.
 */
export function isEligibleSet(set: HistorySet, body: BodyLoad | null = null): boolean {
  if (!(set.done && set.setKind === 'work' && set.reps !== null && Number.isInteger(set.reps) && set.reps >= 1)) return false;
  if (body !== null) {
    const entered = set.loadKg ?? 0;
    return Number.isFinite(entered) && entered >= 0 && totalLoad(entered, body) > 0;
  }
  return set.loadKg !== null && Number.isFinite(set.loadKg) && set.loadKg > 0;
}

/** Poids d'une série : `lowQualityWeight` au-delà de `maxRepsForEstimate` reps ou sous `lowLoadRatio` du 1RM courant, sinon 1. */
export function setWeight(set: { readonly loadKg: number; readonly reps: number }, current1rmKg: number | null, config: ProgressionConfig, body: BodyLoad | null = null): number {
  const tooManyReps = set.reps > config.maxRepsForEstimate;
  const tooLight = current1rmKg !== null && totalLoad(set.loadKg, body) < config.lowLoadRatio * current1rmKg;
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
  /** I4-08 : choix de fatigue retenu pour cette séance (`ExerciseSession.fatigueChoice`) ; absent : non. */
  readonly fatigueChoice?: boolean;
}

export interface HistoryAnalysis {
  /** Séances valides, de la plus récente à la plus ancienne. */
  readonly estimates: readonly SessionEstimate[];
  /** Séance la plus récente ayant au moins une série de travail : ignorée (moins de 50 % faites) ou séries aberrantes écartées. */
  readonly latest: { readonly workoutId: string; readonly partial: boolean; readonly outliers: number } | null;
  /**
   * FIX-ABERR (C-005) : séries aberrantes non confirmées de toutes les séances (partielles et décharges comprises), par séance et position,
   * ordre chronologique. Gardées dans l'historique brut, jamais un record ni une référence.
   */
  readonly unconfirmed: readonly OutlierRef[];
}

/** Série repérée par sa séance et sa position. */
export interface OutlierRef {
  readonly workoutId: string;
  readonly position: number;
}

export interface AnalyzeOptions {
  /**
   * Repérage des aberrantes (défaut : oui). Non pour un exercice assisté au poids de corps inconnu : la charge saisie est une assistance,
   * dont une valeur « haute » rend l'exercice plus facile (FIX-ABERR, choix prudent).
   */
  readonly outliers?: boolean;
}

/** Facteur sous lequel une séance ultérieure « répète » une série aberrante (e1RM ≥ 90 % du sien) et la confirme. */
const REPEAT_CONFIRMS_FROM = 0.9;

/** Ordre chronologique stable : fin de séance, puis identifiant. */
const chronological = (a: ExerciseSession, b: ExerciseSession): number => (a.endedAt < b.endedAt ? -1 : a.endedAt > b.endedAt ? 1 : a.workoutId < b.workoutId ? -1 : a.workoutId > b.workoutId ? 1 : 0);

const fatigueMark = (session: ExerciseSession): { readonly fatigueChoice?: true } => (session.fatigueChoice === true ? { fatigueChoice: true } : {});

type EligibleSet = HistorySet & { loadKg: number; reps: number };

export function analyzeHistory(history: readonly ExerciseSession[], config: ProgressionConfig, body: BodyLoad | null = null, options: AnalyzeOptions = {}): HistoryAnalysis {
  const e1rm = (s: { readonly loadKg: number; readonly reps: number }): number => epley(totalLoad(s.loadKg, body), s.reps);
  const eligibleSet = (s: HistorySet): boolean => isEligibleSet(s, body);
  const detect = options.outliers !== false;
  const valid: SessionEstimate[] = [];
  const unconfirmed: OutlierRef[] = [];
  let latest: HistoryAnalysis['latest'] = null;
  const ordered = [...history].sort(chronological);
  const workOf = (session: ExerciseSession): readonly HistorySet[] => session.sets.filter((s) => s.setKind === 'work');
  // Lest nul ou absent d'une série éligible (poids de corps connu) : lu comme 0.
  const eligibleOf = (session: ExerciseSession): EligibleSet[] => workOf(session).filter(eligibleSet).map((s) => ({ ...s, loadKg: s.loadKg ?? 0 })) as EligibleSet[];
  const isPartial = (session: ExerciseSession): boolean => eligibleOf(session).length < config.minCompletedFraction * workOf(session).length;
  // Séance complète hors décharge : seule capable de confirmer une aberrante antérieure (C-028). Meilleur e1RM éligible, 0 sinon.
  const confirmingBest = ordered.map((session) => {
    if (session.deload === true || workOf(session).length === 0 || isPartial(session)) return 0;
    const values = eligibleOf(session).map(e1rm);
    return values.length > 0 ? Math.max(...values) : 0;
  });
  const repeatedLater = (index: number, value: number): boolean => confirmingBest.slice(index + 1).some((b) => b >= REPEAT_CONFIRMS_FROM * value);
  for (const [index, session] of ordered.entries()) {
    const work = workOf(session);
    if (work.length === 0) continue;
    const eligible = eligibleOf(session);
    const current = current1rmFromSessions(valid, config);
    const outlier = (s: EligibleSet): boolean => detect && s.confirmed !== true && current !== null && e1rm(s) > config.outlierRatio * current && !repeatedLater(index, e1rm(s));
    for (const s of eligible) if (outlier(s)) unconfirmed.push({ workoutId: session.workoutId, position: s.position });
    // Deload (I2-02, § 11.3) : visible dans l'historique brut, exclu des statistiques.
    if (session.deload === true) continue;
    if (eligible.length < config.minCompletedFraction * work.length) {
      latest = { workoutId: session.workoutId, partial: true, outliers: 0 };
      continue;
    }
    const kept = eligible.filter((s) => !outlier(s));
    latest = { workoutId: session.workoutId, partial: false, outliers: eligible.length - kept.length };
    if (kept.length === 0) continue;
    const sets = [...kept].sort((a, b) => a.position - b.position);
    // Meilleure série : e1RM maximal, la première par position à égalité.
    const best = sets.reduce((top, s) => (e1rm(s) > e1rm(top) ? s : top));
    valid.unshift({
      workoutId: session.workoutId,
      endedAt: session.endedAt,
      difficulty: session.difficulty,
      e1rmKg: e1rm(best),
      quality: setWeight(best, current, config, body),
      validSets: sets.length,
      sets,
      ...fatigueMark(session),
    });
  }
  return { estimates: valid, latest, unconfirmed };
}

/** Prédicat « série aberrante non confirmée » tiré d'une analyse. */
export function isUnconfirmedOutlier(analysis: HistoryAnalysis): (workoutId: string, position: number) => boolean {
  const keys = new Set(analysis.unconfirmed.map((r) => `${r.workoutId}\u0000${String(r.position)}`));
  return (workoutId, position) => keys.has(`${workoutId}\u0000${String(position)}`);
}
