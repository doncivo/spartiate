import { describe, expect, it } from 'vitest';
import { numbersIn, weeklyReview, type ReviewData, type ReviewSentence } from '../domain/review/weeklyReview';
import type { LocalDate } from '../domain/types';
import { reviewSourceValues, reviewText, reviewWeekLabel } from './weeklyReviewText';

/** BILAN-029, passe qa-test : cas limites du rendu (accords, années, dates de bord, valeurs non finies). Valeurs synthétiques. */

const d = (s: string): LocalDate => s as LocalDate;
const name = (id: string): string => id;
const text = (sentence: ReviewSentence): string => reviewText(sentence, name);

describe('BILAN-029 qa : accords au singulier', () => {
  it('1 séance sur 1 prévue ; 1 record ; 0,5 série ; 1 nuit ; 1 jour complet ; « et 1 autre »', () => {
    expect(text({ theme: 'sessions', kind: 'sessionsPlanned', sources: [{ fact: 'sessions.done', value: 1 }, { fact: 'sessions.planned', value: 1 }] })).toBe('1 séance sur 1 prévue');
    expect(text({ theme: 'sessions', kind: 'sessionsPaused', sources: [{ fact: 'sessions.done', value: 2 }] })).toBe('2 séances, semaine en pause');
    expect(text({ theme: 'records', kind: 'recordsSome', sources: [{ fact: 'records.count', value: 1 }, { fact: 'records.exercise', value: 'Squat' }] })).toBe('1 record : Squat');
    expect(
      text({ theme: 'records', kind: 'recordsSome', sources: [{ fact: 'records.count', value: 4 }, { fact: 'records.exercise', value: 'A' }, { fact: 'records.exercise', value: 'B' }, { fact: 'records.exercise', value: 'C' }, { fact: 'records.others', value: 1 }] }),
    ).toBe('4 records : A, B, C et 1 autre');
    expect(text({ theme: 'volume', kind: 'volumeTop', sources: [{ fact: 'volume.muscle', value: 'triceps' }, { fact: 'volume.sets', value: 0.5 }] })).toBe('Volume : triceps 0,5 série');
    expect(text({ theme: 'sleep', kind: 'insufficient', sources: [{ fact: 'sleep.nights', value: 1 }] })).toBe('Sommeil : pas assez de données (1 nuit mesurée)');
    expect(text({ theme: 'sleep', kind: 'insufficient', sources: [{ fact: 'sleep.nights', value: 0 }] })).toBe('Sommeil : pas assez de données (aucune nuit mesurée)');
    expect(text({ theme: 'nutrition', kind: 'nutritionDays', sources: [{ fact: 'nutrition.completeDays', value: 1 }, { fact: 'nutrition.meanKcal', value: 2100 }] })).toBe(`Journal : 1 jour complet, 2${String.fromCharCode(0x202f)}100 kcal en moyenne`);
  });

  it('cycle : semaine, décharge, aucun cycle ; variation nulle « 0 kg »', () => {
    expect(text({ theme: 'cycle', kind: 'cycleDeload', sources: [{ fact: 'cycle.week', value: 5 }, { fact: 'cycle.total', value: 5 }, { fact: 'cycle.deload', value: true }] })).toBe('Semaine 5 sur 5 du cycle, décharge');
    expect(text({ theme: 'cycle', kind: 'cycleNone', sources: [] })).toBe('Aucun cycle suivi');
    expect(text({ theme: 'weight', kind: 'weightTrendRate', sources: [{ fact: 'weight.trendKg', value: 79.9 }, { fact: 'weight.rateKg', value: 0 }] })).toBe('Poids tendance 79,9 kg, 0 kg sur la semaine');
  });
});

describe('BILAN-029 qa : semaines de bord', () => {
  it('à cheval sur deux années : années écrites ; 1er du mois en début de semaine', () => {
    expect(reviewWeekLabel(d('2026-12-28'), d('2027-01-03'))).toBe('Semaine du 28 décembre 2026 au 3 janvier 2027');
    expect(reviewWeekLabel(d('2027-02-01'), d('2027-02-07'))).toBe('Semaine du 1er au 7 février');
  });

  it('semaine du changement d’heure (29 mars 2026) : sept jours, séances du dimanche comptées', () => {
    const data: ReviewData = {
      sessionDays: [d('2026-03-29')],
      target: null,
      pauses: [],
      workouts: [],
      musclesOf: () => null,
      records: [],
      weighIns: [],
      nutritionDays: [],
      targetKcal: () => null,
      sleep: [],
      cycleAt: () => null,
    };
    const review = weeklyReview(data, d('2026-03-23'));
    expect(review.weekEnd).toBe('2026-03-29');
    expect(review.sentences[0]?.sources).toEqual([{ fact: 'sessions.done', value: 1 }]);
  });
});

describe('BILAN-029 qa : valeurs non finies ignorées, jamais rendues', () => {
  it('kcal ou minutes non finies : ni comptées ni écrites', () => {
    const data: ReviewData = {
      sessionDays: [],
      target: null,
      pauses: [],
      workouts: [],
      musclesOf: () => null,
      records: [],
      weighIns: [],
      nutritionDays: [{ date: d('2026-11-10'), usableForTdee: true, kcal: Number.NaN }],
      targetKcal: () => 2500,
      sleep: [1, 2, 3].map((i) => ({ day: d(`2026-11-1${String(i)}`), minutes: Number.POSITIVE_INFINITY })),
      cycleAt: () => null,
    };
    const review = weeklyReview(data, d('2026-11-09'));
    const nutrition = review.sentences.find((s) => s.theme === 'nutrition');
    const sleep = review.sentences.find((s) => s.theme === 'sleep');
    expect(nutrition?.kind).toBe('insufficient');
    expect(sleep).toEqual({ theme: 'sleep', kind: 'insufficient', sources: [{ fact: 'sleep.nights', value: 0 }] });
    for (const s of review.sentences) expect(reviewText(s, name)).not.toMatch(/NaN|Infinity/);
    for (const s of review.sentences) for (const n of numbersIn(reviewText(s, name))) expect(numbersIn(reviewSourceValues(s, name).join(' '))).toContain(n);
  });
});
