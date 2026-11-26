import { addDays, daysInMonth, makeLocalDate, parseLocalDate } from '../localDate';
import { isLocalDate, type LocalDate } from '../types';
import { isMeasurementKind, type MeasurementKind, type MeasurementPoint } from './measurements';

/**
 * PROG-0301b (BL-178, D-718, D-730, D-731) : outils communs des calculs de Corps › Mesures. Règles pures, sans accès base ni plateforme.
 *
 * Toutes les fonctions de tendance, ratios, symétrie et séances reçoivent la liste COMPLÈTE des mesures (table `measurement`, tous genres)
 * et choisissent elles-mêmes leurs genres : seules les 11 zones saisies (`MEASUREMENT_KINDS`) sont lues, jamais `health_*`, `note_*` ni
 * `visbody_*` (D-713, D-715). La hauteur de Santé n'est lue que par `resolveHeight` (./ratios.ts).
 */

/** Une ligne de la table `measurement` (genre quelconque, valeur dans l'unité du genre). */
export interface BodySample {
  readonly kind: string;
  readonly date: LocalDate;
  readonly value: number;
}

/** Périodes de la courbe (D-706) : 4 semaines, 3 mois, 6 mois, tout. */
export const BODY_PERIODS = ['4w', '3m', '6m', 'all'] as const;
export type BodyPeriod = (typeof BODY_PERIODS)[number];
/** Période par défaut : 3 mois, la plus proche des 12 dernières mesures de l'écran actuel (D-718). */
export const DEFAULT_BODY_PERIOD: BodyPeriod = '3m';

const DAY_MS = 86_400_000;
const dayNumber = (date: LocalDate): number => Date.parse(`${date}T00:00:00Z`) / DAY_MS;
/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export const daysBetween = (from: LocalDate, to: LocalDate): number => Math.round(dayNumber(to) - dayNumber(from));

/** Même jour, `months` mois plus tard (ou plus tôt) ; borné au dernier jour du mois d'arrivée (31 mai − 3 mois = 28 février). */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  return makeLocalDate(y, m, Math.min(day, daysInMonth(y, m)));
}

/** Premier jour (inclus) de la période finissant le jour `end` (inclus) ; `null` pour « Tout » (D-731). */
export function periodStart(period: BodyPeriod, end: LocalDate): LocalDate | null {
  switch (period) {
    case '4w':
      return addDays(end, -28);
    case '3m':
      return addMonths(end, -3);
    case '6m':
      return addMonths(end, -6);
    case 'all':
      return null;
  }
}

export const inPeriod = (date: LocalDate, start: LocalDate | null, end: LocalDate): boolean => (start === null || date >= start) && date <= end;

const byDate = (a: MeasurementPoint, b: MeasurementPoint): number => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Série d'un genre : date valide, valeur finie, une valeur par date (la dernière reçue), triée par date (D-730). */
export function kindSeries(samples: readonly BodySample[], kind: string): MeasurementPoint[] {
  const byDay = new Map<LocalDate, number>();
  for (const s of samples) if (s.kind === kind && isLocalDate(s.date) && Number.isFinite(s.value)) byDay.set(s.date, s.value);
  return [...byDay].map(([date, value]) => ({ date, value })).sort(byDate);
}

/** Série d'une zone saisie seulement (jamais un genre importé ou une note, même s'il portait le même nom). */
export const zoneSeries = (samples: readonly BodySample[], kind: MeasurementKind): MeasurementPoint[] => (isMeasurementKind(kind) ? kindSeries(samples, kind) : []);

/** Arrondi au pas donné (0,1 ou 0,01), sans « −0 ». */
export const roundTo = (n: number, digits: number): number => {
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return r === 0 ? 0 : r;
};
