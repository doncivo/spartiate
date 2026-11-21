import { addDays, weekdayOf } from '../localDate';
import type { LocalDate } from '../types';

/**
 * SUIVIS-029a : objectif de pas. Source : totaux par jour importés de `pas.csv` (H-25 UNVERIFIED). Sans total lisible, la valeur est inconnue avec sa
 * raison, jamais 0 ; un total de 0 lu dans le fichier est un fait. Les pas restent sur l'iPhone (table locale `recovery_sample`). Module pur.
 */

export interface StepsDay {
  readonly day: string;
  readonly steps: number;
}

export type StepsTodayReason = 'on_pc' | 'never_read' | 'no_today' | 'read_failed';
export type StepsToday =
  | { readonly kind: 'value'; readonly steps: number; readonly goal: number; readonly percent: number; readonly reached: boolean }
  | { readonly kind: 'unknown'; readonly reason: StepsTodayReason; readonly goal: number };

export interface StepsTodayInput {
  readonly platform: 'phone' | 'pc';
  /** Totaux par jour ; null : lecture impossible. */
  readonly days: readonly StepsDay[] | null;
  /** Un `pas.csv` a-t-il déjà été lu sur cet appareil (état d'import du type `pas`) ? */
  readonly everRead: boolean;
  readonly today: string;
  readonly goal: number;
}

/** Dernier total connu de chaque jour (un total remplace le précédent, jamais additionné). */
function byDay(days: readonly StepsDay[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of days) if (Number.isFinite(d.steps) && d.steps >= 0) map.set(d.day, d.steps);
  return map;
}

export function stepsToday(input: StepsTodayInput): StepsToday {
  const { goal } = input;
  if (input.platform === 'pc') return { kind: 'unknown', reason: 'on_pc', goal };
  if (input.days === null) return { kind: 'unknown', reason: 'read_failed', goal };
  if (!input.everRead) return { kind: 'unknown', reason: 'never_read', goal };
  const steps = byDay(input.days).get(input.today);
  if (steps === undefined) return { kind: 'unknown', reason: 'no_today', goal };
  return { kind: 'value', steps, goal, percent: Math.round((steps * 100) / goal), reached: steps >= goal };
}

export interface StepsWeek {
  /** Lundi de la semaine. */
  readonly weekStart: string;
  /** Moyenne des jours connus, arrondie ; null sans jour connu (jamais 0). */
  readonly average: number | null;
  readonly knownDays: number;
  readonly daysAtGoal: number;
}

export const STEPS_WEEKS = 4;

const mondayOf = (day: LocalDate): LocalDate => addDays(day, 1 - weekdayOf(day));

/** Semaines du lundi, la plus récente d'abord ; jours après `today` ignorés. */
export function stepsWeeks(days: readonly StepsDay[], today: string, goal: number, weeks: number = STEPS_WEEKS): StepsWeek[] {
  const first = mondayOf(today as LocalDate);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(first, -7 * i) as string);
  const acc = new Map(starts.map((w) => [w, [] as number[]]));
  for (const [day, steps] of byDay(days)) {
    if (day > today || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    acc.get(mondayOf(day as LocalDate))?.push(steps);
  }
  return starts.map((weekStart) => {
    const values = acc.get(weekStart) ?? [];
    return {
      weekStart,
      average: values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      knownDays: values.length,
      daysAtGoal: values.filter((v) => v >= goal).length,
    };
  });
}
