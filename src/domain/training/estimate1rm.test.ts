import { describe, expect, it } from 'vitest';
import { session, set } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG as CFG } from './config';
import { analyzeHistory, current1rmFromSessions, epley, isEligibleSet, setWeight } from './estimate1rm';

/** I2-01, critères 1 et 2 (§ 11.3, D-72 point 2) : vecteurs calculés à la main. */

describe('Epley', () => {
  it('60 kg × 10 = 80 kg ; 100 kg × 5 = 116,666… kg', () => {
    expect(epley(60, 10)).toBe(80);
    expect(epley(100, 5)).toBeCloseTo(116.6667, 4);
  });
});

describe('poids d’une série (0,25 au-delà de 15 reps ou sous 60 % du 1RM courant)', () => {
  it('80 kg × 16 avec 1RM 150 : 0,25 (reps) ; 80 kg × 8 : 0,25 (53,3 %) ; 90 kg × 8 : 1 (60 % pile) ; 90 kg × 15 : 1', () => {
    expect(setWeight({ loadKg: 80, reps: 16 }, 150, CFG)).toBe(0.25);
    expect(setWeight({ loadKg: 80, reps: 8 }, 150, CFG)).toBe(0.25);
    expect(setWeight({ loadKg: 90, reps: 8 }, 150, CFG)).toBe(1);
    expect(setWeight({ loadKg: 90, reps: 15 }, 150, CFG)).toBe(1);
  });

  it('sans 1RM courant, seule la règle des reps s’applique', () => {
    expect(setWeight({ loadKg: 90, reps: 16 }, null, CFG)).toBe(0.25);
    expect(setWeight({ loadKg: 5, reps: 10 }, null, CFG)).toBe(1);
  });
});

describe('1RM courant : moyenne pondérée des trois dernières séances (1 / 0,6 / 0,3)', () => {
  it('100, 110, 120 du plus récent au plus ancien : (100 + 66 + 36) / 1,9 = 106,315… (la préparation P-10 écrivait 105,263 : erreur d’arithmétique)', () => {
    const v = current1rmFromSessions([{ e1rmKg: 100, quality: 1 }, { e1rmKg: 110, quality: 1 }, { e1rmKg: 120, quality: 1 }], CFG);
    expect(v).toBeCloseTo(106.3158, 4);
  });

  it('une séance pondérée 0,25 garde son poids réduit : (100 + 110×0,6×0,25 + 120×0,3) / 1,45 = 105,172…', () => {
    const v = current1rmFromSessions([{ e1rmKg: 100, quality: 1 }, { e1rmKg: 110, quality: 0.25 }, { e1rmKg: 120, quality: 1 }], CFG);
    expect(v).toBeCloseTo(105.1724, 4);
  });

  it('la quatrième séance est ignorée ; une seule séance vaut sa valeur ; aucune séance : null', () => {
    const three = [{ e1rmKg: 100, quality: 1 }, { e1rmKg: 110, quality: 1 }, { e1rmKg: 120, quality: 1 }];
    expect(current1rmFromSessions([...three, { e1rmKg: 300, quality: 1 }], CFG)).toBeCloseTo(106.3158, 4);
    expect(current1rmFromSessions([{ e1rmKg: 90, quality: 0.25 }], CFG)).toBe(90);
    expect(current1rmFromSessions([], CFG)).toBeNull();
  });
});

describe('séries éligibles (§ 11.2 point 1)', () => {
  it('seule une série de travail validée, avec reps ≥ 1 et charge > 0, compte', () => {
    expect(isEligibleSet(set(60, 8))).toBe(true);
    expect(isEligibleSet(set(60, 8, { setKind: 'warmup' }))).toBe(false);
    expect(isEligibleSet(set(60, 8, { setKind: 'drop' }))).toBe(false);
    expect(isEligibleSet(set(60, 8, { setKind: 'partial' }))).toBe(false);
    expect(isEligibleSet(set(60, 8, { setKind: 'timed' }))).toBe(false);
    expect(isEligibleSet(set(60, 8, { done: false }))).toBe(false);
    expect(isEligibleSet(set(60, null))).toBe(false);
    expect(isEligibleSet(set(60, 0))).toBe(false);
    expect(isEligibleSet(set(0, 8))).toBe(false);
    expect(isEligibleSet(set(null, 8))).toBe(false);
    expect(isEligibleSet(set(Number.NaN, 8))).toBe(false);
    expect(isEligibleSet(set(60, 7.5))).toBe(false);
  });
});

describe('analyse de l’historique', () => {
  it('meilleure série Epley de la séance, sans compter chaque série comme une séance (D-72 point 2)', () => {
    const s = { ...session(3, 0, []), sets: [set(100, 5, { position: 0 }), set(105, 3, { position: 1 }), set(90, 8, { position: 2 })] };
    const { estimates } = analyzeHistory([s], CFG);
    expect(estimates).toHaveLength(1);
    expect(estimates[0]?.e1rmKg).toBeCloseTo(116.6667, 4);
    expect(estimates[0]?.validSets).toBe(3);
  });

  it('séances reçues dans le désordre : estimations du plus récent au plus ancien, ordre stable', () => {
    const a = session(10, 60, [10]);
    const b = session(3, 62.5, [8]);
    const c = session(6, 60, [9]);
    expect(analyzeHistory([a, b, c], CFG).estimates.map((e) => e.workoutId)).toEqual([b.workoutId, c.workoutId, a.workoutId]);
    expect(analyzeHistory([c, a, b], CFG).estimates.map((e) => e.workoutId)).toEqual([b.workoutId, c.workoutId, a.workoutId]);
  });

  it('séance à moins de 50 % de séries faites : ignorée ; 2 sur 4 (50 % pile) : retenue', () => {
    const partial = { ...session(2, 60, [10, 10, 10]), sets: [set(60, 10, { position: 0 }), set(60, null, { position: 1, done: false }), set(60, null, { position: 2, done: false })] };
    const half = { ...session(4, 60, [10, 10, 10, 10]), sets: [set(60, 10, { position: 0 }), set(60, 10, { position: 1 }), set(60, null, { position: 2, done: false }), set(60, null, { position: 3, done: false })] };
    const result = analyzeHistory([partial, half], CFG);
    expect(result.estimates.map((e) => e.workoutId)).toEqual([half.workoutId]);
    expect(result.latest).toEqual({ workoutId: partial.workoutId, partial: true, outliers: 0 });
  });

  it('série aberrante non confirmée (> 150 % du 1RM courant) exclue ; confirmée, elle compte', () => {
    const old = session(10, 100, [5]);
    const mixed = { ...session(3, 0, []), sets: [set(200, 5, { position: 0 }), set(100, 6, { position: 1 })] };
    const excluded = analyzeHistory([old, mixed], CFG);
    expect(excluded.estimates[0]?.e1rmKg).toBe(120);
    expect(excluded.latest?.outliers).toBe(1);
    const confirmed = { ...mixed, sets: [set(200, 5, { position: 0, confirmed: true }), set(100, 6, { position: 1 })] };
    expect(analyzeHistory([old, confirmed], CFG).estimates[0]?.e1rmKg).toBeCloseTo(233.3333, 4);
  });

  it('meilleure série sous 60 % du 1RM courant : qualité 0,25 ; meilleure série de 16 reps : qualité 0,25', () => {
    const heavy = session(10, 100, [5]);
    const light = session(3, 60, [10]);
    expect(analyzeHistory([heavy, light], CFG).estimates[0]?.quality).toBe(0.25);
    expect(analyzeHistory([session(3, 50, [16])], CFG).estimates[0]).toMatchObject({ quality: 0.25 });
    expect(analyzeHistory([session(3, 50, [16])], CFG).estimates[0]?.e1rmKg).toBeCloseTo(76.6667, 4);
  });

  it('aucun historique, ou séance sans série de travail : aucune estimation', () => {
    expect(analyzeHistory([], CFG)).toEqual({ estimates: [], latest: null, latestRaw: null });
    const warmupOnly = { ...session(3, 0, []), sets: [set(40, 8, { setKind: 'warmup' })] };
    expect(analyzeHistory([warmupOnly], CFG).estimates).toEqual([]);
  });
});
