/**
 * Agrégation d'une journée et complétude (PRD § 15.1–15.2 ; D-74 points 1 et 2). Le total est distinct de l'état : une journée
 * partielle expose son total loggé, une journée sans entrée n'expose AUCUN total (jamais 0). La déclaration d'Ali prime sur l'inférence.
 */

import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { NUTRITION_CONFIG } from './config';
import type { DayDeclaration, DayReason, DayState, DayTotals, MealEntryInput } from './types';

const minutesOf = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const isKnown = (v: number | null): v is number => v !== null && Number.isFinite(v) && v >= 0;

/** Somme des valeurs ; `null` dès qu'une entrée ignore la valeur. */
function sumKnown(values: readonly (number | null)[]): number | null {
  let total = 0;
  for (const v of values) {
    if (!isKnown(v)) return null;
    total += v;
  }
  return total;
}

export function aggregateDay(
  date: LocalDate,
  entries: readonly MealEntryInput[],
  declaration?: DayDeclaration,
): DayTotals {
  const own = entries.filter((e) => e.date === date);
  if (own.length === 0) {
    const reasons: DayReason[] = ['no-entries'];
    if (declaration === 'complete') reasons.push('declared-without-entries');
    return {
      date,
      state: 'unknown',
      origin: 'none',
      entryCount: 0,
      spanHours: null,
      kcal: null,
      proteinG: null,
      fatG: null,
      carbG: null,
      usableForTdee: false,
      reasons,
    };
  }

  const minutes = own.map((e) => minutesOf(e.time));
  const spanHours = (Math.max(...minutes) - Math.min(...minutes)) / 60;
  const kcal = sumKnown(own.map((e) => e.kcal));
  const proteinG = sumKnown(own.map((e) => e.proteinG));
  const fatG = sumKnown(own.map((e) => e.fatG));
  const carbG = sumKnown(own.map((e) => e.carbG));

  const reasons: DayReason[] = [];
  let state: DayState;
  let origin: DayTotals['origin'];
  if (declaration === 'complete') {
    state = 'complete';
    origin = 'declared';
    reasons.push('declared-complete');
  } else if (declaration === 'incomplete') {
    state = 'partial';
    origin = 'declared';
    reasons.push('declared-incomplete');
  } else {
    origin = 'inferred';
    const enough = own.length >= NUTRITION_CONFIG.inferredMinEntries;
    const wide = spanHours >= NUTRITION_CONFIG.inferredMinSpanHours;
    if (enough && wide) {
      state = 'complete';
      reasons.push('inferred-complete');
    } else {
      state = 'partial';
      if (!enough) reasons.push('too-few-entries');
      if (!wide) reasons.push('span-too-short');
    }
  }
  if (kcal === null || proteinG === null || fatG === null || carbG === null) reasons.push('unknown-values');

  return {
    date,
    state,
    origin,
    entryCount: own.length,
    spanHours,
    kcal,
    proteinG,
    fatG,
    carbG,
    usableForTdee: state === 'complete' && kcal !== null,
    reasons,
  };
}

/** Un `DayTotals` par date de `from` à `to` incluses ; les jours sans entrée sont `unknown`. */
export function aggregateDays(
  from: LocalDate,
  to: LocalDate,
  entries: readonly MealEntryInput[],
  declarations: Readonly<Record<string, DayDeclaration | undefined>>,
): DayTotals[] {
  const byDate = new Map<string, MealEntryInput[]>();
  for (const e of entries) {
    const list = byDate.get(e.date);
    if (list) list.push(e);
    else byDate.set(e.date, [e]);
  }
  const out: DayTotals[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.push(aggregateDay(d, byDate.get(d) ?? [], declarations[d]));
  }
  return out;
}
