/**
 * Vues pures du journal et du dashboard (PRD § 15.1–15.2, § 18 ; I4-03). Aucune valeur inconnue ne devient zéro : un restant, une moyenne
 * ou une pente qui ne peut pas être calculée est `null`, et l'écran dit pourquoi. Une journée non complète n'entre jamais dans une moyenne.
 */

import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { FOOD_GRAMS_MAX } from './food';
import type { MealEntryDraft } from './mealEntry';
import type { TdeeEstimate } from './tdee';
import type { DayTotals, Target, TrendPoint, WeighIn } from './types';
import { trendAt } from './weightTrend';

const tenth = (x: number): number => Math.round(x * 10) / 10;

export interface Remaining {
  readonly kcal: number | null;
  readonly proteinG: number | null;
  readonly fatG: number | null;
  readonly carbG: number | null;
}

/**
 * Cible moins ce qui est loggé. Sans cible : `null`. Journée sans entrée : la cible entière (rien n'a encore été mangé de ce qui est
 * saisi, l'état de la journée reste `unknown`). Un total inconnu (une entrée ignore la valeur) donne un restant inconnu. Négatif = dépassé.
 */
export function remainingForDay(target: Target | null, day: DayTotals): Remaining | null {
  if (target === null) return null;
  if (day.entryCount === 0) return { kcal: target.kcal, proteinG: target.proteinG, fatG: target.fatG, carbG: target.carbG };
  const left = (goal: number, total: number | null): number | null => (total === null ? null : tenth(goal - total));
  return { kcal: left(target.kcal, day.kcal), proteinG: left(target.proteinG, day.proteinG), fatG: left(target.fatG, day.fatG), carbG: left(target.carbG, day.carbG) };
}

export interface WeeklyBalance {
  readonly endDate: LocalDate;
  readonly windowDays: 7;
  /** Jours complets de la fenêtre (seuls ceux-là entrent dans la moyenne). */
  readonly completeDays: number;
  readonly weighInDays: number;
  /** Moyenne des kcal des jours complets, arrondie ; `null` sans jour complet. */
  readonly averageKcal: number | null;
  /** Moyenne moins cible ; `null` sans moyenne ou sans cible. */
  readonly deltaKcal: number | null;
}

export function weeklyBalance(days: readonly DayTotals[], weighIns: readonly WeighIn[], target: Target | null, endDate: LocalDate): WeeklyBalance {
  const start = addDays(endDate, -6);
  const inWindow = (d: LocalDate): boolean => d >= start && d <= endDate;
  const complete = new Map<LocalDate, number>();
  for (const day of days) if (day.usableForTdee && day.kcal !== null && inWindow(day.date)) complete.set(day.date, day.kcal);
  const weighInDays = new Set(weighIns.filter((w) => Number.isFinite(w.kg) && w.kg > 0 && inWindow(w.date)).map((w) => w.date)).size;
  const total = [...complete.values()].reduce((sum, v) => sum + v, 0);
  const averageKcal = complete.size === 0 ? null : Math.round(total / complete.size);
  return {
    endDate,
    windowDays: 7,
    completeDays: complete.size,
    weighInDays,
    averageKcal,
    deltaKcal: averageKcal === null || target === null ? null : averageKcal - target.kcal,
  };
}

/** Variation de la tendance de poids sur 7 jours (kg / semaine) ; `null` sans pesée, ou sans pesée antérieure à J-7 ou sans pesée récente (pas d'extrapolation). */
export function weeklyTrendSlope(points: readonly TrendPoint[], endDate: LocalDate): number | null {
  const first = points[0];
  const weekAgo = addDays(endDate, -7);
  if (first === undefined || first.date > weekAgo) return null;
  // Une pesée dans les 7 derniers jours est nécessaire : sinon la pente serait celle d'un poids ancien, pas d'une tendance actuelle.
  if (!points.some((p) => p.date > weekAgo && p.date <= endDate)) return null;
  const now = trendAt(points, endDate);
  const before = trendAt(points, weekAgo);
  return now === null || before === null ? null : Math.round((now - before) * 100) / 100;
}

export type TdeeConfidence = 'none' | 'low' | 'medium' | 'high';

/**
 * Confiance affichée de la dépense (§ 15.1) : aucune sans estimation ; faible si la formule seule (ou une couverture insuffisante) ;
 * moyenne pendant la transition ; élevée quand la mesure a pris le relais sur une couverture suffisante.
 */
export function tdeeConfidence(estimate: TdeeEstimate): TdeeConfidence {
  if (estimate.value === null) return 'none';
  if (estimate.basis === 'formula' || estimate.basis === 'none') return 'low';
  if (estimate.basis === 'blend') return estimate.coverage.sufficient ? 'medium' : 'low';
  return estimate.coverage.sufficient ? 'high' : 'medium';
}

export interface RescaledEntry {
  readonly grams: number;
  readonly kcal: number | null;
  readonly proteinG: number | null;
  readonly fatG: number | null;
  readonly carbG: number | null;
}

/**
 * Correction des grammes d'une entrée : les totaux suivent la proportion (au dixième) ; une valeur inconnue reste `null`. `null` si les
 * grammes demandés sont invalides ou si la masse d'origine est inconnue (Quick Add : les valeurs se corrigent directement).
 */
export function rescaleEntry(entry: Pick<MealEntryDraft, 'grams' | 'kcal' | 'proteinG' | 'fatG' | 'carbG'>, grams: number): RescaledEntry | null {
  if (entry.grams === null || !(entry.grams > 0)) return null;
  if (!Number.isFinite(grams) || grams <= 0 || grams > FOOD_GRAMS_MAX) return null;
  const ratio = grams / entry.grams;
  const scale = (v: number | null): number | null => (v === null ? null : tenth(v * ratio));
  return { grams, kcal: scale(entry.kcal), proteinG: scale(entry.proteinG), fatG: scale(entry.fatG), carbG: scale(entry.carbG) };
}
