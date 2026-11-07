import { describe, expect, it } from 'vitest';
import { NOW, session } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG as CFG } from './config';
import { confidenceOf, confidenceScore, dispersion, recencyFactor } from './confidence';
import { analyzeHistory } from './estimate1rm';

/** I2-01, critère 3 (§ 11.3 ; D-72 points 3 et 4) : vecteurs calculés à la main. */

describe('récence : 1 jusqu’à 14 jours, linéaire, 0 à partir de 60 jours (D-72 point 3)', () => {
  it('bornes et milieu', () => {
    expect(recencyFactor(0, CFG)).toBe(1);
    expect(recencyFactor(7, CFG)).toBe(1);
    expect(recencyFactor(14, CFG)).toBe(1);
    expect(recencyFactor(37, CFG)).toBeCloseTo(0.5, 10);
    expect(recencyFactor(30, CFG)).toBeCloseTo(1 - 16 / 46, 10);
    expect(recencyFactor(60, CFG)).toBe(0);
    expect(recencyFactor(90, CFG)).toBe(0);
  });
});

describe('dispersion : coefficient de variation entre séances, borné à [0, 1] (D-72 point 4)', () => {
  it('valeurs égales : 0 ; 90 et 110 : 10 / 100 = 0,1 (écart type de population)', () => {
    expect(dispersion([100, 100, 100])).toBe(0);
    expect(dispersion([90, 110])).toBeCloseTo(0.1, 10);
  });

  it('moins de deux séances : 1 (inconnue, prudente) ; dispersion énorme bornée à 1', () => {
    expect(dispersion([100])).toBe(1);
    expect(dispersion([])).toBe(1);
    expect(dispersion([1, 1000, 1])).toBe(1);
  });
});

describe('score de confiance 0,4 × séries + 0,3 × (1 − dispersion) + 0,3 × récence', () => {
  it('6 séries, dispersion 0, donnée à 7 jours : 1,00', () => {
    expect(confidenceScore({ validSets: 6, dispersion: 0, recency: recencyFactor(7, CFG) }, CFG)).toBeCloseTo(1, 10);
  });

  it('3 séries, dispersion 0, donnée à 30 jours : 0,69565…', () => {
    expect(confidenceScore({ validSets: 3, dispersion: 0, recency: recencyFactor(30, CFG) }, CFG)).toBeCloseTo(0.695652, 6);
  });

  it('séries plafonnées à 6 ; tout à zéro : 0', () => {
    expect(confidenceScore({ validSets: 12, dispersion: 0, recency: 1 }, CFG)).toBeCloseTo(1, 10);
    expect(confidenceScore({ validSets: 0, dispersion: 1, recency: 0 }, CFG)).toBe(0);
  });
});

describe('confiance d’un historique', () => {
  it('aucune séance : 0', () => {
    expect(confidenceOf([], NOW, CFG)).toBe(0);
  });

  it('une séance de 3 séries aujourd’hui : 0,2 + 0 + 0,3 = 0,5 (la calibration demande une deuxième séance)', () => {
    const { estimates } = analyzeHistory([session(0, 60, [10, 10, 10])], CFG);
    expect(confidenceOf(estimates, NOW, CFG)).toBeCloseTo(0.5, 10);
  });

  it('deux séances identiques à 7 et 3 jours : 6 séries, CV 0, récence 1 → 1', () => {
    const { estimates } = analyzeHistory([session(7, 60, [10, 10, 10]), session(3, 60, [10, 10, 10])], CFG);
    expect(confidenceOf(estimates, NOW, CFG)).toBeCloseTo(1, 10);
  });

  it('seules les trois dernières séances comptent (séries et dispersion)', () => {
    const recent = [session(3, 60, [10]), session(5, 60, [10]), session(7, 60, [10])];
    const { estimates } = analyzeHistory([...recent, session(9, 55, [10, 10, 10])], CFG);
    // 3 séries → 0,2 ; CV 0 → 0,3 ; récence 1 → 0,3.
    expect(confidenceOf(estimates, NOW, CFG)).toBeCloseTo(0.8, 10);
  });

  it('une séance de 2 séries à 40 jours : 0,4 × 2/6 + 0 + 0,3 × (1 − 26/46) = 0,2638…', () => {
    const { estimates } = analyzeHistory([session(40, 60, [10, 10])], CFG);
    expect(confidenceOf(estimates, NOW, CFG)).toBeCloseTo(0.4 * (2 / 6) + 0.3 * (1 - 26 / 46), 10);
  });
});
