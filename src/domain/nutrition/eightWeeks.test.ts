import { describe, expect, it } from 'vitest';

import {
  completeCoverage,
  date,
  floorCase,
  goalChange,
  outlierWeighIn,
  partialCoverage,
  START,
  type Scenario,
} from '../../../tests/fixtures/nutrition/eightWeeks';
import { proposeCheckIn, type CheckInResult, type Goal } from './checkIn';
import { aggregateDays } from './dayTotals';
import { estimateTdee, type TdeeEstimate } from './tdee';
import type { Target } from './types';
import { computeTrend, trendAt } from './weightTrend';
import type { ActivityLevel } from './config';

interface WeekReview {
  readonly weekEnd: number;
  readonly tdee: TdeeEstimate;
  readonly result: CheckInResult;
}

interface Run {
  readonly goal: (weekEnd: number) => Goal;
  readonly start: Target;
  readonly profile: { sex: 'male' | 'female'; birthYear: number; heightCm: number };
  readonly activity: ActivityLevel;
  readonly weightKg: number;
}

/** Rejoue les check-ins hebdomadaires : chaque proposition est acceptée telle quelle, puis sert de cible courante. */
function replay(scenario: Scenario, run: Run): WeekReview[] {
  const reviews: WeekReview[] = [];
  let current = run.start;
  let previous: { date: ReturnType<typeof date>; value: number } | null = null;
  for (let weekEnd = 13; weekEnd < 56; weekEnd += 7) {
    const endDate = date(weekEnd);
    const days = aggregateDays(START, endDate, scenario.entries, {});
    const weighIns = scenario.weighIns.filter((w) => w.date <= endDate);
    const tdee = estimateTdee({
      endDate,
      days,
      weighIns,
      profile: run.profile,
      activity: run.activity,
      previousSmoothed: previous,
    });
    if (tdee.measuredSmoothed !== null) previous = { date: endDate, value: tdee.measuredSmoothed };
    const result = proposeCheckIn({
      style: 'guided',
      weekEnd: endDate,
      days,
      weighIns,
      tdee: tdee.value,
      weightKg: trendAt(computeTrend(weighIns), endDate),
      goal: run.goal(weekEnd),
      currentTarget: current,
      lowFloorConfirmed: false,
    });
    if (result.proposal) current = result.proposal.target;
    reviews.push({ weekEnd, tdee, result });
  }
  return reviews;
}

const male = { sex: 'male', birthYear: 1996, heightCm: 180 } as const;
const base: Run = {
  goal: () => ({ kind: 'maintain' }),
  start: { kcal: 2400, proteinG: 150, fatG: 70, carbG: 292.5 },
  profile: male,
  activity: 'moderate',
  weightKg: 80,
};

function expectInvariants(reviews: WeekReview[], start: Target): void {
  let previous = start.kcal;
  for (const { tdee, result } of reviews) {
    if (tdee.value !== null) {
      expect(Number.isFinite(tdee.value)).toBe(true);
      expect(tdee.value).toBeGreaterThan(0);
    }
    if (result.proposal) {
      const kcal = result.proposal.target.kcal;
      expect(Math.abs(kcal - previous)).toBeLessThanOrEqual(150);
      expect(kcal).toBeGreaterThanOrEqual(1200);
      expect(result.proposal.target.carbG).toBeGreaterThanOrEqual(0);
      expect(result.proposal.applied).toBe(false);
      previous = kcal;
    }
  }
}

describe('8 semaines : couverture complète', () => {
  const reviews = replay(completeCoverage(), base);

  it('chaque semaine produit une proposition bornée', () => {
    expect(reviews.every((r) => r.result.status === 'proposal')).toBe(true);
    expectInvariants(reviews, base.start);
  });

  it('la dépense mesurée prend le relais et dépasse les apports (perte de poids)', () => {
    const last = reviews[reviews.length - 1];
    expect(last?.tdee.basis).toBe('measured');
    expect(last?.tdee.value).toBeGreaterThan(2400);
    expect(last?.tdee.value).toBeLessThan(2400 + 0.07 * 7700 + 1);
  });

  it('la première semaine repose sur la formule déclarée, sans mesure', () => {
    expect(reviews[0]?.tdee.basis).toBe('formula');
    expect(reviews[0]?.tdee.measuredRaw).toBeNull();
  });
});

describe('8 semaines : couverture partielle', () => {
  const scenario = partialCoverage();
  const reviews = replay(scenario, base);

  it('check-in suspendu chaque semaine (3 jours complets / 7)', () => {
    expect(reviews.every((r) => r.result.status === 'suspended')).toBe(true);
    expect(reviews.every((r) => r.result.proposal === null)).toBe(true);
  });

  it('aucune dépense mesurée, et aucun jour non loggé n\'a valu zéro', () => {
    expect(reviews.every((r) => r.tdee.measuredRaw === null)).toBe(true);
    const days = aggregateDays(START, date(55), scenario.entries, {});
    for (const d of days) {
      if (d.state === 'unknown') expect(d.kcal).toBeNull();
    }
  });
});

describe('8 semaines : pesée aberrante', () => {
  const scenario = outlierWeighIn();
  const trend = computeTrend(scenario.weighIns);

  it('la pesée à 83 kg est pondérée 0,25 et déplace peu la tendance', () => {
    const spike = trend.find((p) => p.date === date(30));
    expect(spike?.outlier).toBe(true);
    const jump = (spike?.trend ?? 0) - 80;
    expect(jump).toBeGreaterThan(0);
    expect(jump).toBeLessThan(0.1);
  });

  it('la dépense mesurée reste proche des apports (poids stable)', () => {
    const last = replay(scenario, { ...base, start: { kcal: 2500, proteinG: 150, fatG: 70, carbG: 310 } }).pop();
    expect(Math.abs((last?.tdee.value ?? 0) - 2500)).toBeLessThan(30);
  });
});

describe("8 semaines : changement d'objectif", () => {
  const goal = (weekEnd: number): Goal => (weekEnd < 34 ? { kind: 'loss', weeklyRateKg: 0.5 } : { kind: 'gain', weeklyRateKg: 0.25 });
  const reviews = replay(goalChange(), { ...base, goal });

  it('toutes les semaines respectent la borne et sont indépendantes', () => {
    expect(reviews.every((r) => r.result.status === 'proposal')).toBe(true);
    expectInvariants(reviews, base.start);
  });

  it('la cible baisse pendant la perte puis remonte après le changement', () => {
    const kcal = reviews.map((r) => r.result.proposal?.target.kcal ?? 0);
    const lowIndex = kcal.indexOf(Math.min(...kcal));
    expect(lowIndex).toBeLessThan(kcal.length - 1);
    expect(kcal[kcal.length - 1]).toBeGreaterThan(Math.min(...kcal));
  });
});

describe('8 semaines : plancher', () => {
  const run: Run = {
    goal: () => ({ kind: 'loss', weeklyRateKg: 0.5 }),
    start: { kcal: 1300, proteinG: 100, fatG: 40, carbG: 135 },
    profile: { sex: 'female', birthYear: 1996, heightCm: 160 },
    activity: 'sedentary',
    weightKg: 60,
  };
  const reviews = replay(floorCase(), run);

  it('jamais sous 1 200 kcal sans confirmation', () => {
    expectInvariants(reviews, run.start);
    expect(reviews.some((r) => r.result.proposal?.clampedBy.includes('floor'))).toBe(true);
    expect(reviews.every((r) => r.result.proposal?.belowStandardFloor !== true)).toBe(true);
  });
});
