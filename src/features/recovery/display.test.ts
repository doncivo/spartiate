import { describe, expect, it } from 'vitest';
import type { RecoveryDaySummary } from '../../domain/recovery';
import { contributorTone, exertionDial, formatDuration, formatScore, recoveryDial, ringFraction, sleepDial, stalenessOf, stepsSummary } from './display';

/** I5-02 point 2.1 : affichage pur des cadrans. Jamais de faux zéro : une valeur nulle garde sa raison. */
const base: RecoveryDaySummary = {
  day: '2026-11-09',
  level: 'A',
  recovery: 72,
  abstainReason: null,
  quality: 'good',
  exertion: 3.46,
  exertionPrevDay: 0,
  sleepMinutes: 432,
  sleepNeedMinutes: 450,
  sleepScore: 96,
  bedtimeSigmaMinutes: 20,
  targetZone: { from: 6, to: 8 },
  hrvMs: 60,
  restingHr: 50,
  learningNights: 14,
  contributors: [],
  explanationKeys: [],
  computedAt: '2026-11-09T07:00:00.000Z',
};

describe('cadran Recovery', () => {
  it('valeur : le score tel quel', () => {
    expect(recoveryDial(base)).toEqual({ kind: 'value', value: 72 });
  });
  it('baseline non prête : apprentissage J+x/14 avec x = nuits valides connues, jamais 0', () => {
    expect(recoveryDial({ ...base, recovery: null, abstainReason: 'baseline_incomplete', learningNights: 5, quality: 'insufficient' })).toEqual({ kind: 'learning', nights: 5, of: 14 });
  });
  it('autre raison d’abstention : la raison, jamais une valeur', () => {
    expect(recoveryDial({ ...base, recovery: null, abstainReason: 'measure_missing_hrv', quality: 'insufficient' })).toEqual({ kind: 'abstained', reason: 'measure_missing_hrv' });
  });
});

describe('cadran Exertion', () => {
  it('valeur arrondie au dixième', () => {
    expect(exertionDial(base)).toEqual({ kind: 'value', value: 3.5 });
  });
  it('zéro : aucune séance comptée, pas de « 0 »', () => {
    expect(exertionDial({ ...base, exertion: 0 })).toEqual({ kind: 'none' });
  });
});

describe('cadran Sommeil', () => {
  it('durée, besoin et score', () => {
    expect(sleepDial(base)).toEqual({ kind: 'value', minutes: 432, needMinutes: 450, scorePct: 96 });
  });
  it('sommeil inconnu : non mesuré, besoin conservé', () => {
    expect(sleepDial({ ...base, sleepMinutes: null, sleepScore: null })).toEqual({ kind: 'unmeasured', needMinutes: 450 });
  });
});

describe('formats', () => {
  it('durées', () => {
    expect(formatDuration(432)).toBe('7 h 12');
    expect(formatDuration(480)).toBe('8 h 00');
    expect(formatDuration(45)).toBe('45 min');
  });
  it('score à virgule française', () => {
    expect(formatScore(3.5)).toBe('3,5');
    expect(formatScore(10)).toBe('10');
  });
  it('fraction de l’anneau bornée', () => {
    expect(ringFraction(72, 100)).toBeCloseTo(0.72);
    expect(ringFraction(12, 10)).toBe(1);
    expect(ringFraction(-3, 10)).toBe(0);
  });
});

describe('contributeurs', () => {
  it('ton selon l’effet sur le score', () => {
    expect(contributorTone({ key: 'hrv', value: 1.2, weight: 0.7 })).toBe('up');
    expect(contributorTone({ key: 'resting_hr', value: 0.2, weight: 0.3 })).toBe('flat');
    expect(contributorTone({ key: 'hrv', value: -1.2, weight: 0.7 })).toBe('down');
    expect(contributorTone({ key: 'sleep', value: 1, weight: null })).toBe('up');
    expect(contributorTone({ key: 'sleep', value: 0.85, weight: null })).toBe('down');
  });
});

describe('pas', () => {
  const at = (day: string, value: number) => ({ startAt: `${day}T12:00:00.000Z`, value });
  it('pas du jour et moyenne des jours connus, sans remplir les jours absents par 0', () => {
    const r = stepsSummary([at('2026-11-05', 8000), at('2026-11-08', 6000), at('2026-11-09', 4000)], '2026-11-09');
    expect(r).toEqual({ today: 4000, average: 6000, knownDays: 3 });
  });
  it('rien dans les 7 jours : tout inconnu', () => {
    expect(stepsSummary([at('2026-10-01', 9000)], '2026-11-09')).toEqual({ today: null, average: null, knownDays: 0 });
  });
  it('0 pas un jour connu est une vraie valeur', () => {
    expect(stepsSummary([at('2026-11-09', 0)], '2026-11-09')).toEqual({ today: 0, average: 0, knownDays: 1 });
  });
});

describe('fraîcheur', () => {
  const now = Date.parse('2026-11-10T09:00:00.000Z');
  it('jamais : aucune date', () => {
    expect(stalenessOf(null, now)).toEqual({ known: false, stale: false, days: 0 });
  });
  it('récent', () => {
    expect(stalenessOf('2026-11-10T06:00:00.000Z', now)).toEqual({ known: true, stale: false, days: 0 });
  });
  it('ancien : au-delà de 48 h', () => {
    expect(stalenessOf('2026-11-06T06:00:00.000Z', now)).toEqual({ known: true, stale: true, days: 4 });
  });
});
