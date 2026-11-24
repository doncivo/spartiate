import { describe, expect, it } from 'vitest';

import { completeDay, partialDay } from '../../../tests/fixtures/nutrition/dayKit';
import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { proposeCheckIn, type CheckInInput } from './checkIn';

/** NUTRI-0292 (C-038, D-475) : sans cible en cours, le premier check-in n'exige aucune couverture. Test qui fige le comportement conservé. */
const d0 = '2026-09-07' as LocalDate;
const base = (over: Partial<CheckInInput>): CheckInInput => ({
  style: 'guided',
  weekEnd: addDays(d0, 13),
  days: [],
  weighIns: [],
  tdee: 2600,
  weightKg: 70,
  goal: { kind: 'maintain' },
  currentTarget: null,
  lowFloorConfirmed: false,
  ...over,
});

describe('C-038 (D-475) : premier check-in sans cible', () => {
  it('un seul jour partiel et une seule pesée : la proposition initiale est faite', () => {
    const r = proposeCheckIn(base({ days: [partialDay(d0, 600)], weighIns: [{ date: d0, kg: 70 }] }));
    expect(r.status).toBe('proposal');
    expect(r.proposal?.initial).toBe(true);
  });

  it('une couverture complète n\'y change rien', () => {
    const days = Array.from({ length: 14 }, (_, i) => completeDay(addDays(d0, i), 2400));
    expect(proposeCheckIn(base({ days })).proposal?.target).toEqual(proposeCheckIn(base({})).proposal?.target);
  });

  it('avec une cible en cours, la couverture insuffisante suspend toujours (l\'exemption ne vaut que sans cible)', () => {
    const target = { kcal: 2500, proteinG: 140, fatG: 70, carbG: 328 };
    expect(proposeCheckIn(base({ currentTarget: target })).status).toBe('suspended');
  });
});
