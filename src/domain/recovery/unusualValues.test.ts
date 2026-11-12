import { describe, expect, it } from 'vitest';
import { buildBaseline } from './baseline';
import { RECOVERY_CONFIG } from './config';
import { summarizeRecoveryDay } from './daySummary';
import type { Contributor, NightRecord } from './types';
import { UNUSUAL_SIGMA, beyondUnusualSigma, unusualValues, type UnusualDayInput } from './unusualValues';

/**
 * I6-01 point A (§ 16.7) : « valeurs inhabituelles ». FC de repos > μ + 2 σ ou HRV < μ − 2 σ, deux nuits de suite, nuits valides seulement.
 * FIX-0172 (constat 8, décision d'Ali du 12/11/2026, D-134, révise D-95) : seuil STRICT, au-delà de 2 σ, jugé sur le z NON arrondi au moment
 * du calcul ; la décision est publiée dans le résumé (`unusual` du contributeur) pour que le PC affiche la même chose sans recalcul.
 * Les z-scores sont ORIENTÉS (positif = favorable) : HRV basse et FC haute valent toutes deux z < −2.
 */
const contributors = (hrv: number, rhr: number, flags: { readonly hrv?: boolean; readonly rhr?: boolean } = {}): Contributor[] => [
  { key: 'hrv', value: hrv, weight: 0.7, ...(flags.hrv === undefined ? {} : { unusual: flags.hrv }) },
  { key: 'resting_hr', value: rhr, weight: 0.3, ...(flags.rhr === undefined ? {} : { unusual: flags.rhr }) },
  { key: 'sleep', value: 1, weight: null },
];
const day = (date: string, hrv: number, rhr: number, over: Partial<UnusualDayInput> = {}): UnusualDayInput => ({
  day: date,
  level: 'C',
  recovery: 40,
  sleepMinutes: 420,
  contributors: contributors(hrv, rhr),
  ...over,
});
const flagged = (date: string, hrv: number, rhr: number, flags: { readonly hrv?: boolean; readonly rhr?: boolean }): UnusualDayInput =>
  day(date, hrv, rhr, { contributors: contributors(hrv, rhr, flags) });
const normal = (date: string): UnusualDayInput => day(date, 0.3, 0.1);

describe('unusualValues (I6-01, § 16.7)', () => {
  it('constante nommée : 2 σ, dans RECOVERY_CONFIG', () => {
    expect(UNUSUAL_SIGMA).toBe(2);
    expect(RECOVERY_CONFIG.unusualSigma).toBe(2);
  });

  it('seuil strict sur la valeur non arrondie : −1,996 non, −2 non, −2,004 oui', () => {
    expect(beyondUnusualSigma(-1.996)).toBe(false);
    expect(beyondUnusualSigma(-2)).toBe(false);
    expect(beyondUnusualSigma(-2.004)).toBe(true);
    expect(beyondUnusualSigma(2.5)).toBe(false);
    expect(beyondUnusualSigma(Number.NaN)).toBe(false);
  });

  it('un seul jour inhabituel (veille normale) : pas de carte', () => {
    expect(unusualValues([normal('2026-11-08'), day('2026-11-09', -2.3, -1.8)])).toBeNull();
  });

  it('un seul jour de données : pas de carte', () => {
    expect(unusualValues([day('2026-11-09', -2.3, 0)])).toBeNull();
    expect(unusualValues([])).toBeNull();
  });

  it('deux jours de suite inhabituels : carte, avec les deux raisons du jour le plus récent', () => {
    const result = unusualValues([day('2026-11-08', -2.1, -2.2), day('2026-11-09', -2.4, -2.05)]);
    expect(result).toEqual({ day: '2026-11-09', reasons: ['hrv_low', 'resting_hr_high'] });
  });

  it('HRV basse seule deux nuits de suite : carte, raison HRV seule', () => {
    expect(unusualValues([day('2026-11-08', -2.2, 0.5), day('2026-11-09', -2.1, 0.2)])).toEqual({ day: '2026-11-09', reasons: ['hrv_low'] });
  });

  it('FC haute seule deux nuits de suite : carte, raison FC seule', () => {
    expect(unusualValues([day('2026-11-08', 0, -2.2), day('2026-11-09', 0.4, -2.3)])).toEqual({ day: '2026-11-09', reasons: ['resting_hr_high'] });
  });

  it('décision publiée : −2,004 et −2,004 arrondis à −2 mais marqués inhabituels → carte ; −1,996 arrondis à −2 non marqués → pas de carte', () => {
    expect(unusualValues([flagged('2026-11-08', -2, 0, { hrv: true, rhr: false }), flagged('2026-11-09', -2, 0, { hrv: true, rhr: false })])).toEqual({ day: '2026-11-09', reasons: ['hrv_low'] });
    expect(unusualValues([flagged('2026-11-08', -2, 0, { hrv: false, rhr: false }), flagged('2026-11-09', -2, 0, { hrv: false, rhr: false })])).toBeNull();
    expect(unusualValues([flagged('2026-11-08', 0, -2, { hrv: false, rhr: true }), flagged('2026-11-09', 0, -2, { hrv: false, rhr: true })])).toEqual({ day: '2026-11-09', reasons: ['resting_hr_high'] });
  });

  it('la décision publiée prime sur la valeur arrondie (jamais une autre règle à la lecture)', () => {
    expect(unusualValues([flagged('2026-11-08', -2.01, 0, { hrv: false }), flagged('2026-11-09', -2.01, 0, { hrv: false })])).toBeNull();
  });

  it('résumé ancien sans décision publiée : seuil strict sur la valeur gardée ; −2 n’est pas au-delà de 2 σ', () => {
    expect(unusualValues([day('2026-11-08', -2, 0), day('2026-11-09', -2, 0)])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2.01, 0), day('2026-11-09', -2.01, 0)])).not.toBeNull();
  });

  it('une valeur HAUTE de HRV ou BASSE de FC n’est jamais inhabituelle (z positif)', () => {
    expect(unusualValues([day('2026-11-08', 2.5, 2.5), day('2026-11-09', 2.5, 2.5)])).toBeNull();
  });

  it('jours non consécutifs ou jour manquant : pas de carte', () => {
    expect(unusualValues([day('2026-11-07', -2.3, 0), day('2026-11-09', -2.3, 0)])).toBeNull();
  });

  it('retour à la normale : le jour le plus récent n’est plus inhabituel, la carte disparaît', () => {
    expect(unusualValues([day('2026-11-08', -2.3, 0), day('2026-11-09', -2.3, 0)])).not.toBeNull();
    expect(unusualValues([day('2026-11-08', -2.3, 0), day('2026-11-09', -2.3, 0), normal('2026-11-10')])).toBeNull();
  });

  it('l’ordre des lignes ne compte pas ; seuls les deux derniers jours comptent', () => {
    const rows = [day('2026-11-09', -2.3, 0), normal('2026-11-05'), day('2026-11-08', -2.3, 0)];
    expect(unusualValues(rows)).toEqual({ day: '2026-11-09', reasons: ['hrv_low'] });
  });

  it('baseline incomplète (niveau sans score, contributeurs absents) : pas de carte', () => {
    const incomplete = (date: string): UnusualDayInput => day(date, -2.3, -2.3, { level: 'A', recovery: null, contributors: [] });
    expect(unusualValues([incomplete('2026-11-08'), incomplete('2026-11-09')])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2.3, 0), day('2026-11-09', -2.3, 0, { contributors: [] })])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2.3, 0), day('2026-11-09', -2.3, 0, { recovery: null })])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2.3, 0), day('2026-11-09', -2.3, 0, { level: 'B' })])).toBeNull();
  });

  it('nuit non valide (sommeil inconnu ou sous le seuil de nuit valide) : pas de carte', () => {
    const short = RECOVERY_CONFIG.validNightMinAsleepMinutes - 1;
    expect(unusualValues([day('2026-11-08', -2.3, 0, { sleepMinutes: short }), day('2026-11-09', -2.3, 0)])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2.3, 0), day('2026-11-09', -2.3, 0, { sleepMinutes: null })])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2.3, 0, { sleepMinutes: RECOVERY_CONFIG.validNightMinAsleepMinutes }), day('2026-11-09', -2.3, 0)])).not.toBeNull();
  });

  it('avec `today` : un résumé plus ancien que la veille ne produit pas de carte', () => {
    const rows = [day('2026-11-07', -2.3, 0), day('2026-11-08', -2.3, 0)];
    expect(unusualValues(rows, { today: '2026-11-09' })).not.toBeNull();
    expect(unusualValues(rows, { today: '2026-11-10' })).toBeNull();
  });

  it('un contributeur sans aucune valeur finie est refusé : jamais de carte devinée', () => {
    const bad = day('2026-11-09', -2.3, 0, { contributors: [{ key: 'hrv', value: Number.NaN, weight: 0.7 }, { key: 'resting_hr', value: 0, weight: 0.3 }] });
    expect(unusualValues([day('2026-11-08', -2.3, 0), bad])).toBeNull();
  });
});

describe('FIX-0172 : la décision est prise au calcul du résumé, sur le z non arrondi', () => {
  const TODAY = '2026-11-08';
  const dayOf = (i: number): string => new Date(Date.UTC(2026, 9, 25 + i)).toISOString().slice(0, 10);
  // 14 nuits de base (25 oct. → 7 nov.), HRV alternée 48 / 52, FC 54 / 56 ; la nuit du jour reçoit une HRV à z voulu.
  const base: NightRecord[] = Array.from({ length: 14 }, (_, i) => ({
    day: dayOf(i), hrvMs: i % 2 === 0 ? 48 : 52, restingHr: i % 2 === 0 ? 54 : 56, asleepMinutes: 450, bedtimeMinutes: 1380, wakeMinutes: 390,
  }));
  const stats = buildBaseline(base, TODAY, 'hrvMs').stats;
  const summaryAt = (z: number) => {
    const tonight: NightRecord = { day: TODAY, hrvMs: (stats.mean ?? 0) + z * (stats.sd ?? 0), restingHr: 55, asleepMinutes: 450, bedtimeMinutes: 1380, wakeMinutes: 390 };
    return summarizeRecoveryDay({ today: TODAY, now: '2026-11-08T08:00:00.000Z', timeZone: 'Europe/Paris', nights: [...base, tonight], workouts: [] }).summary;
  };
  const hrvOf = (z: number): Contributor | undefined => summaryAt(z).contributors.find((c) => c.key === 'hrv');

  it('−2,004 σ : affiché −2 (arrondi à 0,01), mais publié inhabituel', () => {
    expect(hrvOf(-2.004)).toMatchObject({ value: -2, unusual: true });
  });

  it('−1,996 σ : affiché −2 aussi, publié NON inhabituel', () => {
    expect(hrvOf(-1.996)).toMatchObject({ value: -2, unusual: false });
  });

  it('FC de repos : la décision est publiée de même ; le facteur de sommeil ne porte aucune décision', () => {
    const summary = summaryAt(0);
    expect(summary.contributors.find((c) => c.key === 'resting_hr')).toMatchObject({ unusual: false });
    expect(summary.contributors.find((c) => c.key === 'sleep')).not.toHaveProperty('unusual');
  });
});
