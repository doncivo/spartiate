import { describe, expect, it } from 'vitest';
import { RECOVERY_CONFIG } from './config';
import { UNUSUAL_SIGMA, unusualValues, type UnusualDayInput } from './unusualValues';

/**
 * I6-01 point A (§ 16.7, D-95) : « valeurs inhabituelles ». FC de repos > μ + 2 σ ou HRV < μ − 2 σ, deux nuits de suite, nuits valides seulement.
 * Les contributeurs du résumé portent les z-scores ORIENTÉS (positif = favorable) : HRV basse = z <= -2, FC haute = z <= -2 (borne incluse).
 */
const day = (date: string, hrv: number, rhr: number, over: Partial<UnusualDayInput> = {}): UnusualDayInput => ({
  day: date,
  level: 'C',
  recovery: 40,
  sleepMinutes: 420,
  contributors: [
    { key: 'hrv', value: hrv, weight: 0.7 },
    { key: 'resting_hr', value: rhr, weight: 0.3 },
    { key: 'sleep', value: 1, weight: null },
  ],
  ...over,
});
const normal = (date: string): UnusualDayInput => day(date, 0.3, 0.1);

describe('unusualValues (I6-01, § 16.7)', () => {
  it('constante nommée : 2 σ', () => {
    expect(UNUSUAL_SIGMA).toBe(2);
  });

  it('un seul jour inhabituel (veille normale) : pas de carte', () => {
    expect(unusualValues([normal('2026-11-08'), day('2026-11-09', -2, -1.8)])).toBeNull();
  });

  it('un seul jour de données : pas de carte', () => {
    expect(unusualValues([day('2026-11-09', -2, 0)])).toBeNull();
    expect(unusualValues([])).toBeNull();
  });

  it('deux jours de suite inhabituels : carte, avec les deux raisons du jour le plus récent', () => {
    const result = unusualValues([day('2026-11-08', -2, -2), day('2026-11-09', -2.4, -2)]);
    expect(result).toEqual({ day: '2026-11-09', reasons: ['hrv_low', 'resting_hr_high'] });
  });

  it('HRV basse seule deux nuits de suite : carte, raison HRV seule', () => {
    expect(unusualValues([day('2026-11-08', -2, 0.5), day('2026-11-09', -2.1, 0.2)])).toEqual({ day: '2026-11-09', reasons: ['hrv_low'] });
  });

  it('FC haute seule deux nuits de suite : carte, raison FC seule', () => {
    expect(unusualValues([day('2026-11-08', 0, -2), day('2026-11-09', 0.4, -2.3)])).toEqual({ day: '2026-11-09', reasons: ['resting_hr_high'] });
  });

  it('la borne de 2 σ est incluse (« au moins 2 σ ») ; 1,99 ne l’est pas', () => {
    expect(unusualValues([day('2026-11-08', -2, 0), day('2026-11-09', -2, 0)])).not.toBeNull();
    expect(unusualValues([day('2026-11-08', -1.99, 0), day('2026-11-09', -2, 0)])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2, 0), day('2026-11-09', 0, -1.99)])).toBeNull();
  });

  it('une valeur HAUTE de HRV ou BASSE de FC n’est jamais inhabituelle (z positif)', () => {
    expect(unusualValues([day('2026-11-08', 2, 2), day('2026-11-09', 2, 2)])).toBeNull();
  });

  it('jours non consécutifs : pas de carte', () => {
    expect(unusualValues([day('2026-11-07', -2, 0), day('2026-11-09', -2, 0)])).toBeNull();
  });

  it('retour à la normale : le jour le plus récent n’est plus inhabituel, la carte disparaît', () => {
    expect(unusualValues([day('2026-11-08', -2, 0), day('2026-11-09', -2, 0)])).not.toBeNull();
    expect(unusualValues([day('2026-11-08', -2, 0), day('2026-11-09', -2, 0), normal('2026-11-10')])).toBeNull();
  });

  it('l’ordre des lignes ne compte pas ; seuls les deux derniers jours comptent', () => {
    const rows = [day('2026-11-09', -2, 0), normal('2026-11-05'), day('2026-11-08', -2, 0)];
    expect(unusualValues(rows)).toEqual({ day: '2026-11-09', reasons: ['hrv_low'] });
  });

  it('baseline incomplète (niveau sans score, contributeurs absents) : pas de carte', () => {
    const incomplete = (date: string): UnusualDayInput => day(date, -2, -2, { level: 'A', recovery: null, contributors: [] });
    expect(unusualValues([incomplete('2026-11-08'), incomplete('2026-11-09')])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2, 0), day('2026-11-09', -2, 0, { contributors: [] })])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2, 0), day('2026-11-09', -2, 0, { recovery: null })])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2, 0), day('2026-11-09', -2, 0, { level: 'B' })])).toBeNull();
  });

  it('nuit non valide (sommeil inconnu ou sous le seuil de nuit valide) : pas de carte', () => {
    const short = RECOVERY_CONFIG.validNightMinAsleepMinutes - 1;
    expect(unusualValues([day('2026-11-08', -2, 0, { sleepMinutes: short }), day('2026-11-09', -2, 0)])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2, 0), day('2026-11-09', -2, 0, { sleepMinutes: null })])).toBeNull();
    expect(unusualValues([day('2026-11-08', -2, 0, { sleepMinutes: RECOVERY_CONFIG.validNightMinAsleepMinutes }), day('2026-11-09', -2, 0)])).not.toBeNull();
  });

  it('avec `today` : un résumé plus ancien que la veille ne produit pas de carte', () => {
    const rows = [day('2026-11-07', -2, 0), day('2026-11-08', -2, 0)];
    expect(unusualValues(rows, { today: '2026-11-09' })).not.toBeNull();
    expect(unusualValues(rows, { today: '2026-11-10' })).toBeNull();
  });

  it('un contributeur sans aucune valeur finie est refusé : jamais de carte devinée', () => {
    const bad = day('2026-11-09', -2, 0, { contributors: [{ key: 'hrv', value: Number.NaN, weight: 0.7 }, { key: 'resting_hr', value: 0, weight: 0.3 }] });
    expect(unusualValues([day('2026-11-08', -2, 0), bad])).toBeNull();
  });
});
