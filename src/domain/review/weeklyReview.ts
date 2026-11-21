import { addDays } from '../localDate';
import { computeTrend } from '../nutrition/weightTrend';
import type { TrendPoint, WeighIn } from '../nutrition/types';
import type { CycleWeekMarker } from '../training/cycleWeek';
import type { MesocycleState } from '../training/mesocycle';
import type { MesocyclePause } from '../training/mesocycle';
import { pausedOn, trailingWeeks, weeklyMuscleVolume, type ProgressWorkout, type WeeklyTarget } from '../training/progressStats';
import type { MuscleWeight } from '../training/types';
import type { LocalDate } from '../types';
import type { FirstWeekday } from '../week';

/**
 * BILAN-029 (PRD § 17.3, modèle de secours ; D-294, D-410) : bilan hebdomadaire écrit par règles, sur l'appareil, sans fournisseur d'IA.
 * À partir des FAITS d'une semaine complète, une phrase par thème ; chaque phrase porte ses sources (clé de fait + valeur) et le texte n'a
 * d'autres paramètres que ces valeurs : aucun chiffre inventé. Un thème sans donnée donne `insufficient` (« pas assez de données »), jamais
 * une valeur 0 ; un 0 n'apparaît que s'il est un fait (0 séance sur 3 prévues, aucun record dans une semaine avec séances).
 * Règles pures, sans horloge : la semaine et le début de semaine sont fournis ; les entrées ne sont jamais modifiées. Recalculé à la
 * demande (archivage sans table : une semaine passée se relit depuis les données).
 */

export const REVIEW_CONFIG = {
  /** Semaines listées : la dernière semaine complète et les 6 précédentes (journal relu sur 60 jours, `SNAPSHOT_DAYS`). */
  archiveWeeks: 7,
  /** Nuits mesurées minimales pour une moyenne de sommeil. */
  minSleepNights: 3,
  /** Muscles cités dans la phrase du volume. */
  volumeTop: 3,
  /** Exercices nommés dans la phrase des records. */
  recordNames: 3,
} as const;

export const REVIEW_THEMES = ['sessions', 'records', 'volume', 'weight', 'nutrition', 'sleep', 'cycle'] as const;
export type ReviewTheme = (typeof REVIEW_THEMES)[number];

export type FactKey =
  | 'sessions.done'
  | 'sessions.planned'
  | 'records.count'
  | 'records.exercise'
  | 'records.others'
  | 'volume.muscle'
  | 'volume.sets'
  | 'weight.trendKg'
  | 'weight.rateKg'
  | 'nutrition.completeDays'
  | 'nutrition.meanKcal'
  | 'nutrition.targetKcal'
  | 'sleep.nights'
  | 'sleep.meanMinutes'
  | 'cycle.week'
  | 'cycle.total'
  | 'cycle.deload';

export interface ReviewSource {
  readonly fact: FactKey;
  readonly value: number | string | boolean;
}

export type SentenceKind =
  | 'insufficient'
  | 'sessionsPlanned'
  | 'sessionsDone'
  | 'sessionsPaused'
  | 'recordsSome'
  | 'recordsNone'
  | 'volumeTop'
  | 'weightTrendRate'
  | 'weightTrend'
  | 'nutritionTarget'
  | 'nutritionDays'
  | 'sleepMean'
  | 'cycleWeek'
  | 'cycleDeload'
  | 'cycleNone';

export interface ReviewSentence {
  readonly theme: ReviewTheme;
  readonly kind: SentenceKind;
  readonly sources: readonly ReviewSource[];
}

export interface WeekReview {
  readonly weekStart: LocalDate;
  readonly weekEnd: LocalDate;
  readonly sentences: readonly ReviewSentence[];
}

export interface ReviewData {
  readonly firstWeekday?: FirstWeekday;
  /** Jour local du début de chaque séance close (une entrée par séance). */
  readonly sessionDays: readonly LocalDate[];
  /** Objectif du programme suivi ; `null` : aucun. */
  readonly target: WeeklyTarget | null;
  readonly pauses: readonly MesocyclePause[];
  /** Séances closes et leurs séries (volume). */
  readonly workouts: readonly ProgressWorkout[];
  readonly musclesOf: (exerciseId: string) => readonly MuscleWeight[] | null;
  /** Un élément par record d'une séance close (règles du résumé de séance), au jour local de la séance. */
  readonly records: readonly { readonly day: LocalDate; readonly exerciseName: string }[];
  readonly weighIns: readonly WeighIn[];
  /** Jours du journal alimentaire (`DayTotals`) : seuls les jours complets à énergie connue comptent. */
  readonly nutritionDays: readonly { readonly date: LocalDate; readonly usableForTdee: boolean; readonly kcal: number | null }[];
  /** Cible calorique unique en vigueur à la date ; `null` : aucune, ou cible différente les jours de repos. */
  readonly targetKcal: (date: LocalDate) => number | null;
  /** Nuits de `recovery_day` (`null` : nuit non mesurée). */
  readonly sleep: readonly { readonly day: LocalDate; readonly minutes: number | null }[];
  /** Repère du cycle suivi à la date ; `null` : aucun cycle en cours. */
  readonly cycleAt: (date: LocalDate) => CycleWeekMarker | null;
}

const DEFAULT_FIRST: FirstWeekday = 'monday';

/*
 * Règles recopiées (mesure du bundle) : importer weeklyRate.ts et cycleWeek.ts depuis ce bloc à la demande les sortait chacun dans un bloc
 * partagé listé au préchargement du départ (+44 octets normalisés). Équivalence gardée par weeklyReview.copies.test.ts.
 */
/** Dernier point de tendance au plus tard à `anchor` et pas plus de 7 jours avant (`weeklyRate.ts`). */
function recentPoint(trend: readonly TrendPoint[], anchor: LocalDate): TrendPoint | null {
  const floor = addDays(anchor, -7);
  let found: TrendPoint | null = null;
  for (const point of trend) if (point.date <= anchor && point.date >= floor && (found === null || point.date > found.date)) found = point;
  return found;
}

/** Tendance de poids en fin de semaine (`weekTrendKg`). */
export function reviewTrendKg(trend: readonly TrendPoint[], weekEnd: LocalDate): number | null {
  return recentPoint(trend, weekEnd)?.trend ?? null;
}

/** Variation de la tendance sur la semaine, au centième ; `null` si une extrémité manque (`weeklyRateKg`). */
export function reviewRateKg(trend: readonly TrendPoint[], weekEnd: LocalDate): number | null {
  const end = recentPoint(trend, weekEnd);
  const start = recentPoint(trend, addDays(weekEnd, -7));
  if (end === null || start === null) return null;
  const rate = Math.round((end.trend - start.trend) * 100) / 100;
  return rate === 0 ? 0 : rate;
}

/** Repère « Semaine N sur M » d'un état de cycle (`cycleWeekMarker`). */
export function reviewCycleMarker(state: Pick<MesocycleState, 'phase' | 'week' | 'blockWeek' | 'blockLength' | 'totalWeeks' | 'kind'>): CycleWeekMarker | null {
  if (state.phase !== 'active' && state.phase !== 'paused') return null;
  const limited = state.totalWeeks !== null;
  const week = limited ? state.week : state.blockWeek;
  const total = state.totalWeeks ?? state.blockLength;
  if (!(week >= 1 && week <= total)) return null;
  return { week, total, deload: state.kind === 'deload' };
}
const weekStartOf = (day: LocalDate, first: FirstWeekday): LocalDate => trailingWeeks(day, 1, first)[0] ?? day;
const tenth = (n: number): number => Math.round(n * 10) / 10;

/** Semaines du bilan, la plus récente d'abord : la dernière semaine COMPLÈTE avant celle de `today`, puis les précédentes. */
export function reviewWeekStarts(today: LocalDate, first: FirstWeekday = DEFAULT_FIRST, count: number = REVIEW_CONFIG.archiveWeeks): LocalDate[] {
  return trailingWeeks(today, count + 1, first).slice(0, count).reverse();
}

const insufficient = (theme: ReviewTheme, sources: readonly ReviewSource[] = []): ReviewSentence => ({ theme, kind: 'insufficient', sources });

function sessionsSentence(data: ReviewData, start: LocalDate, end: LocalDate, first: FirstWeekday): ReviewSentence {
  const done = data.sessionDays.filter((day) => day >= start && day <= end).length;
  const planned = data.target !== null && data.target.perWeek > 0 && start >= weekStartOf(data.target.since, first) ? data.target.perWeek : null;
  const known = planned !== null || data.sessionDays.some((day) => day <= end);
  if (!known) return insufficient('sessions');
  const paused = Array.from({ length: 7 }, (_, i) => addDays(start, i)).some((day) => pausedOn(data.pauses, day));
  const doneSource: ReviewSource = { fact: 'sessions.done', value: done };
  if (paused) return { theme: 'sessions', kind: 'sessionsPaused', sources: [doneSource] };
  if (planned === null) return { theme: 'sessions', kind: 'sessionsDone', sources: [doneSource] };
  return { theme: 'sessions', kind: 'sessionsPlanned', sources: [doneSource, { fact: 'sessions.planned', value: planned }] };
}

function recordsSentence(data: ReviewData, start: LocalDate, end: LocalDate): ReviewSentence {
  if (!data.sessionDays.some((day) => day >= start && day <= end)) return insufficient('records');
  const week = data.records.filter((r) => r.day >= start && r.day <= end);
  if (week.length === 0) return { theme: 'records', kind: 'recordsNone', sources: [{ fact: 'records.count', value: 0 }] };
  const names = [...new Set(week.map((r) => r.exerciseName))];
  const shown = names.slice(0, REVIEW_CONFIG.recordNames);
  const sources: ReviewSource[] = [{ fact: 'records.count', value: week.length }, ...shown.map((name): ReviewSource => ({ fact: 'records.exercise', value: name }))];
  if (names.length > shown.length) sources.push({ fact: 'records.others', value: names.length - shown.length });
  return { theme: 'records', kind: 'recordsSome', sources };
}

function volumeSentence(data: ReviewData, end: LocalDate, first: FirstWeekday): ReviewSentence {
  const volume = weeklyMuscleVolume({ workouts: data.workouts, musclesOf: data.musclesOf, today: end, firstWeekday: first, weeks: 1 });
  const top = volume.muscles.slice(0, REVIEW_CONFIG.volumeTop);
  if (top.length === 0) return insufficient('volume');
  return { theme: 'volume', kind: 'volumeTop', sources: top.flatMap((m): ReviewSource[] => [{ fact: 'volume.muscle', value: m.muscleId }, { fact: 'volume.sets', value: m.total }]) };
}

function weightSentence(data: ReviewData, end: LocalDate): ReviewSentence {
  const trend = computeTrend(data.weighIns);
  const kg = reviewTrendKg(trend, end);
  if (kg === null) return insufficient('weight');
  const trendSource: ReviewSource = { fact: 'weight.trendKg', value: tenth(kg) };
  const rate = reviewRateKg(trend, end);
  if (rate === null) return { theme: 'weight', kind: 'weightTrend', sources: [trendSource] };
  return { theme: 'weight', kind: 'weightTrendRate', sources: [trendSource, { fact: 'weight.rateKg', value: rate }] };
}

function nutritionSentence(data: ReviewData, start: LocalDate, end: LocalDate): ReviewSentence {
  const kcal = new Map<LocalDate, number>();
  for (const day of data.nutritionDays) if (day.usableForTdee && day.kcal !== null && Number.isFinite(day.kcal) && day.date >= start && day.date <= end) kcal.set(day.date, day.kcal);
  if (kcal.size === 0) return insufficient('nutrition');
  const values = [...kcal.values()];
  const sources: ReviewSource[] = [
    { fact: 'nutrition.completeDays', value: kcal.size },
    { fact: 'nutrition.meanKcal', value: Math.round(values.reduce((a, b) => a + b, 0) / values.length) },
  ];
  const target = data.targetKcal(end);
  if (target === null) return { theme: 'nutrition', kind: 'nutritionDays', sources };
  return { theme: 'nutrition', kind: 'nutritionTarget', sources: [...sources, { fact: 'nutrition.targetKcal', value: Math.round(target) }] };
}

function sleepSentence(data: ReviewData, start: LocalDate, end: LocalDate): ReviewSentence {
  const nights = new Map<LocalDate, number>();
  for (const night of data.sleep) if (night.minutes !== null && Number.isFinite(night.minutes) && night.day >= start && night.day <= end) nights.set(night.day, night.minutes);
  const nightsSource: ReviewSource = { fact: 'sleep.nights', value: nights.size };
  if (nights.size < REVIEW_CONFIG.minSleepNights) return insufficient('sleep', [nightsSource]);
  const values = [...nights.values()];
  return { theme: 'sleep', kind: 'sleepMean', sources: [nightsSource, { fact: 'sleep.meanMinutes', value: Math.round(values.reduce((a, b) => a + b, 0) / values.length) }] };
}

function cycleSentence(data: ReviewData, end: LocalDate): ReviewSentence {
  const marker = data.cycleAt(end);
  if (marker === null) return { theme: 'cycle', kind: 'cycleNone', sources: [] };
  const sources: ReviewSource[] = [
    { fact: 'cycle.week', value: marker.week },
    { fact: 'cycle.total', value: marker.total },
  ];
  return marker.deload ? { theme: 'cycle', kind: 'cycleDeload', sources: [...sources, { fact: 'cycle.deload', value: true }] } : { theme: 'cycle', kind: 'cycleWeek', sources };
}

/** Bilan de la semaine qui commence à `weekStart` (sept jours, bornes comprises). */
export function weeklyReview(data: ReviewData, weekStart: LocalDate): WeekReview {
  const first = data.firstWeekday ?? DEFAULT_FIRST;
  const weekEnd = addDays(weekStart, 6);
  return {
    weekStart,
    weekEnd,
    sentences: [
      sessionsSentence(data, weekStart, weekEnd, first),
      recordsSentence(data, weekStart, weekEnd),
      volumeSentence(data, weekEnd, first),
      weightSentence(data, weekEnd),
      nutritionSentence(data, weekStart, weekEnd),
      sleepSentence(data, weekStart, weekEnd),
      cycleSentence(data, weekEnd),
    ],
  };
}

/**
 * Nombres d'un texte (vérification du § 17.3 « chaque nombre existe dans l'agrégat ») : suites de chiffres, décimales à virgule, groupes de
 * milliers séparés par une espace insécable (fine ou non) ; le signe n'est pas retenu.
 */
export function numbersIn(text: string): string[] {
  const nbsp = `${String.fromCharCode(0xa0)}${String.fromCharCode(0x202f)}`;
  const pattern = new RegExp(`\\d+(?:[${nbsp}]\\d{3})*(?:,\\d+)?`, 'g');
  return (text.match(pattern) ?? []).map((n) => n.replace(new RegExp(`[${nbsp}]`, 'g'), ''));
}
