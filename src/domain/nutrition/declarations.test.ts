/** Journée complète déclarée (I4-07, § 15.2, D-74 point 2) : la déclaration prime partout, jamais zéro pour un jour sans entrée. */
import { describe, expect, it } from 'vitest';

import { date, START, twoSittings } from '../../../tests/fixtures/nutrition/eightWeeks';
import type { LocalDate, LocalTime } from '../types';
import { proposeCheckIn } from './checkIn';
import { twoWeekCoverage } from './coverage';
import { aggregateDay, aggregateDays } from './dayTotals';
import { estimateTdee } from './tdee';
import type { DayDeclaration, MealEntryInput } from './types';
import { computeTrend, trendAt } from './weightTrend';

const day = '2026-09-07' as LocalDate;
const at = (time: string): MealEntryInput => ({ date: day, time: time as LocalTime, kcal: 500, proteinG: 20, fatG: 10, carbG: 50 });
const none: MealEntryInput[] = [];
const few = [at('09:00'), at('12:00')];
const wide = [at('08:00'), at('12:30'), at('17:00')];
const narrow = [at('13:00'), at('13:30'), at('14:00')];

type Decl = DayDeclaration | undefined;
const cases: readonly [string, MealEntryInput[], Decl, string, boolean][] = [
  ['0 entrée, non déclaré', none, undefined, 'unknown', false],
  ['0 entrée, complet', none, 'complete', 'unknown', false],
  ['0 entrée, incomplet', none, 'incomplete', 'unknown', false],
  ['2 entrées, non déclaré', few, undefined, 'partial', false],
  ['2 entrées, complet', few, 'complete', 'complete', true],
  ['2 entrées, incomplet', few, 'incomplete', 'partial', false],
  ['3 entrées sur 8 h+, non déclaré', wide, undefined, 'complete', true],
  ['3 entrées sur 8 h+, complet', wide, 'complete', 'complete', true],
  ['3 entrées sur 8 h+, incomplet', wide, 'incomplete', 'partial', false],
  ['3 entrées sur 1 h, non déclaré', narrow, undefined, 'partial', false],
  ['3 entrées sur 1 h, complet', narrow, 'complete', 'complete', true],
];

describe('I4-07 : aggregateDay avec et sans déclaration', () => {
  it.each(cases)('%s', (_name, entries, declaration, state, usable) => {
    const t = aggregateDay(day, entries, declaration);
    expect(t.state).toBe(state);
    expect(t.usableForTdee).toBe(usable);
    if (entries.length === 0) {
      expect(t.kcal).toBeNull();
      expect(t.proteinG).toBeNull();
    }
  });

  it('origine : déclarée si déclaration, inférée sinon, aucune sans entrée', () => {
    expect(aggregateDay(day, wide, 'incomplete').origin).toBe('declared');
    expect(aggregateDay(day, wide).origin).toBe('inferred');
    expect(aggregateDay(day, none, 'complete').origin).toBe('none');
    expect(aggregateDay(day, none, 'complete').reasons).toContain('declared-without-entries');
  });

  it('une énergie inconnue empêche la dépense même pour un jour déclaré complet', () => {
    const t = aggregateDay(day, [at('09:00'), { ...at('12:00'), kcal: null }], 'complete');
    expect(t.state).toBe('complete');
    expect(t.kcal).toBeNull();
    expect(t.usableForTdee).toBe(false);
  });
});

describe('I4-07 : aggregateDays reçoit un dictionnaire date -> déclaration', () => {
  it('applique chaque déclaration à sa date, ignore les autres', () => {
    const d2 = '2026-09-08' as LocalDate;
    const entries = [...few, { ...at('09:00'), date: d2 }, { ...at('12:00'), date: d2 }];
    const days = aggregateDays(day, '2026-09-09' as LocalDate, entries, { [day]: 'complete', [d2]: 'incomplete' });
    expect(days.map((d) => [d.state, d.usableForTdee])).toEqual([
      ['complete', true],
      ['partial', false],
      ['unknown', false],
    ]);
  });
});

describe('I4-07 : 8 semaines « saisie en deux fois »', () => {
  const scenario = twoSittings();
  const end = date(21);
  const profile = { sex: 'male', birthYear: 1996, heightCm: 180 } as const;
  const target = { kcal: 2400, proteinG: 150, fatG: 70, carbG: 292.5 };
  const run = (declarations: Record<string, DayDeclaration>) => {
    const days = aggregateDays(START, end, scenario.entries, declarations);
    const tdee = estimateTdee({ endDate: end, days, weighIns: scenario.weighIns, profile, activity: 'moderate', previousSmoothed: null });
    const checkIn = proposeCheckIn({
      style: 'guided',
      weekEnd: end,
      days,
      weighIns: scenario.weighIns,
      tdee: tdee.value,
      weightKg: trendAt(computeTrend(scenario.weighIns), end),
      goal: { kind: 'maintain' },
      currentTarget: target,
      lowFloorConfirmed: false,
    });
    return { days, tdee, checkIn };
  };
  const allComplete = Object.fromEntries(Array.from({ length: 22 }, (_, i) => [date(i), 'complete' as const]));

  it('sans déclaration : 7,5 h déduit partiel, dépense mesurée absente, check-in suspendu', () => {
    const r = run({});
    expect(r.days.every((d) => d.state === 'partial' && d.reasons.includes('span-too-short'))).toBe(true);
    expect(twoWeekCoverage(r.days, scenario.weighIns, end).sufficient).toBe(false);
    expect(r.tdee.measuredRaw).toBeNull();
    expect(r.checkIn.status).toBe('suspended');
    expect(r.checkIn.proposal).toBeNull();
  });

  it('déclarées complètes : la dépense est mesurée et le check-in est calculable', () => {
    const r = run(allComplete);
    expect(r.days.every((d) => d.state === 'complete' && d.origin === 'declared')).toBe(true);
    expect(twoWeekCoverage(r.days, scenario.weighIns, end).sufficient).toBe(true);
    expect(r.tdee.measuredRaw).not.toBeNull();
    expect(r.checkIn.status).toBe('proposal');
  });

  it('déclarées incomplètes : exclues même avec 3 entrées', () => {
    const r = run(Object.fromEntries(Object.keys(allComplete).map((k) => [k, 'incomplete' as const])));
    expect(r.days.every((d) => !d.usableForTdee)).toBe(true);
    expect(r.tdee.measuredRaw).toBeNull();
    expect(r.checkIn.status).toBe('suspended');
  });
});
