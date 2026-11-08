import { describe, expect, it } from 'vitest';

import { completeDay, partialDay, point, unknownDay } from '../../../tests/fixtures/nutrition/dayKit';
import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import {
  ACTIVITY_FACTOR_ACTIVE,
  ACTIVITY_FACTOR_LIGHT,
  ACTIVITY_FACTOR_MODERATE,
  ACTIVITY_FACTOR_SEDENTARY,
  ACTIVITY_FACTORS,
} from './config';
import {
  blendTdee,
  estimateTdee,
  formulaTdee,
  measuredTdee,
  measuredWeight,
  mifflinStJeor,
  smoothTdee,
} from './tdee';
import type { DayTotals, WeighIn } from './types';

const d0 = '2026-09-07' as LocalDate;
const at = (i: number) => addDays(d0, i);

describe('I4-01 : facteurs d\'activité déclarés (D-74 a)', () => {
  it('constantes nommées et table', () => {
    expect(ACTIVITY_FACTOR_SEDENTARY).toBe(1.2);
    expect(ACTIVITY_FACTOR_LIGHT).toBe(1.375);
    expect(ACTIVITY_FACTOR_MODERATE).toBe(1.55);
    expect(ACTIVITY_FACTOR_ACTIVE).toBe(1.725);
    expect(ACTIVITY_FACTORS).toEqual({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 });
  });
});

describe('I4-01 : Mifflin-St Jeor', () => {
  it('taille invalide (0, négative, NaN) : null, jamais NaN', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(mifflinStJeor({ sex: 'male', weightKg: bad, heightCm: 180, age: 30 })).toBeNull();
      expect(mifflinStJeor({ sex: 'male', weightKg: 80, heightCm: bad, age: 30 })).toBeNull();
    }
    expect(mifflinStJeor({ sex: 'male', weightKg: 80, heightCm: 180, age: Number.NaN })).toBeNull();
    expect(mifflinStJeor({ sex: 'male', weightKg: 80, heightCm: 180, age: -1 })).toBeNull();
  });
  it('année de naissance absurde : formule null', () => {
    const r = formulaTdee({ profile: { sex: 'male', birthYear: Number.NaN, heightCm: 180 }, activity: 'light', weightKg: 80, onDate: d0 });
    expect(r.value).toBeNull();
  });
  it('homme 80 kg, 180 cm, 30 ans : 1 780', () => {
    expect(mifflinStJeor({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
  });
  it('femme, mêmes mesures : 1 614', () => {
    expect(mifflinStJeor({ sex: 'female', weightKg: 80, heightCm: 180, age: 30 })).toBe(1614);
  });
});

describe('I4-01 : formulaTdee', () => {
  const profile = { sex: 'male', birthYear: 1996, heightCm: 180 } as const;
  it('métabolisme × facteur déclaré : 1 780 × 1,55 = 2 759', () => {
    const r = formulaTdee({ profile, activity: 'moderate', weightKg: 80, onDate: d0 });
    expect(r.value).toBeCloseTo(2759, 6);
    expect(r.reasons).toEqual([]);
  });
  it('sans niveau d\'activité déclaré : null avec raison, jamais de valeur par défaut', () => {
    const r = formulaTdee({ profile, activity: null, weightKg: 80, onDate: d0 });
    expect(r.value).toBeNull();
    expect(r.reasons).toContain('activity-not-declared');
  });
  it('profil incomplet (sexe, taille, année) : null avec raison', () => {
    for (const p of [
      { ...profile, sex: null },
      { ...profile, heightCm: null },
      { ...profile, birthYear: null },
    ]) {
      const r = formulaTdee({ profile: p, activity: 'light', weightKg: 80, onDate: d0 });
      expect(r.value).toBeNull();
      expect(r.reasons).toContain('profile-incomplete');
    }
    expect(formulaTdee({ profile: null, activity: 'light', weightKg: 80, onDate: d0 }).value).toBeNull();
  });
  it('sans poids : null avec raison', () => {
    const r = formulaTdee({ profile, activity: 'light', weightKg: null, onDate: d0 });
    expect(r.value).toBeNull();
    expect(r.reasons).toContain('no-weight');
  });
});

describe('I4-01 : measuredTdee : TDEE = moyenne(kcal) - (ΔT / N) × 7 700 (§ 15.1)', () => {
  const end = at(30);
  const start = addDays(end, -21);
  /** 12 jours complets à 2 400 kcal dans la fenêtre (4 par semaine) ; le reste partiel ou inconnu. */
  const windowDays = (): DayTotals[] => {
    const out: DayTotals[] = [];
    for (let i = 0; i < 21; i += 1) {
      const date = addDays(end, -20 + i);
      if (i % 7 < 4) out.push(completeDay(date, 2400));
      else if (i % 2 === 0) out.push(partialDay(date, 300));
      else out.push(unknownDay(date));
    }
    return out;
  };

  it('vecteur : 12 jours complets à 2 400, ΔT = -0,6 kg : 2 620', () => {
    const r = measuredTdee({ days: windowDays(), trend: [point(start, 80), point(end, 79.4)], endDate: end });
    expect(r.completeDays).toBe(12);
    expect(r.deltaKg).toBeCloseTo(-0.6, 10);
    expect(r.value).toBeCloseTo(2620, 6);
  });

  it('signe : perte de poids = dépense au-dessus des apports ; prise = en dessous', () => {
    const loss = measuredTdee({ days: windowDays(), trend: [point(start, 80), point(end, 79.4)], endDate: end });
    const gain = measuredTdee({ days: windowDays(), trend: [point(start, 80), point(end, 80.6)], endDate: end });
    const flat = measuredTdee({ days: windowDays(), trend: [point(start, 80), point(end, 80)], endDate: end });
    expect(loss.value).toBeGreaterThan(2400);
    expect(gain.value).toBeLessThan(2400);
    expect(flat.value).toBeCloseTo(2400, 10);
  });

  it('les jours partiels ou inconnus ne comptent ni comme zéro ni dans la moyenne', () => {
    const r = measuredTdee({ days: windowDays(), trend: [point(start, 80), point(end, 80)], endDate: end });
    expect(r.meanKcal).toBeCloseTo(2400, 10);
  });

  it('11 jours complets : exclu faute de couverture', () => {
    const days = windowDays();
    days[0] = unknownDay(days[0]?.date ?? start);
    const r = measuredTdee({ days, trend: [point(start, 80), point(end, 79.4)], endDate: end });
    expect(r.value).toBeNull();
    expect(r.reasons).toContain('insufficient-complete-days');
  });

  it('pas de tendance au début de la fenêtre : null avec raison', () => {
    const r = measuredTdee({ days: windowDays(), trend: [point(addDays(start, 3), 80), point(end, 79.4)], endDate: end });
    expect(r.value).toBeNull();
    expect(r.reasons).toContain('no-trend-at-start');
  });

  it('un jour complet sans énergie connue n\'est pas utilisable', () => {
    const days = windowDays().map((d, i) => (i === 0 ? { ...d, kcal: null, usableForTdee: false } : d));
    const r = measuredTdee({ days, trend: [point(start, 80), point(end, 79.4)], endDate: end });
    expect(r.completeDays).toBe(11);
    expect(r.value).toBeNull();
  });
});

describe('I4-01 : smoothTdee : EMA demi-vie 7 j', () => {
  it('lissé précédent 2 500, brut 2 620, pas de 7 jours : 2 560', () => {
    expect(smoothTdee({ previous: 2500, raw: 2620, stepDays: 7 })).toBeCloseTo(2560, 10);
  });
  it('sans valeur précédente : le brut', () => {
    expect(smoothTdee({ previous: null, raw: 2620, stepDays: 7 })).toBe(2620);
  });
  it('pas nul : la valeur précédente', () => {
    expect(smoothTdee({ previous: 2500, raw: 2620, stepDays: 0 })).toBe(2500);
  });
});

describe('I4-01 : measuredWeight et blendTdee : transition sur 28 jours (D-74 point 4)', () => {
  it('pondération linéaire bornée', () => {
    expect(measuredWeight(0)).toBe(0);
    expect(measuredWeight(14)).toBe(0.5);
    expect(measuredWeight(28)).toBe(1);
    expect(measuredWeight(60)).toBe(1);
    expect(measuredWeight(-3)).toBe(0);
  });
  it('mélange à 14 jours : moyenne des deux', () => {
    const r = blendTdee({ formula: 2759, measured: 2620, sufficientDays: 14 });
    expect(r.value).toBeCloseTo(2689.5, 10);
    expect(r.basis).toBe('blend');
    expect(r.weightMeasured).toBe(0.5);
  });
  it('sans saut : la valeur évolue de façon continue d\'un jour à l\'autre', () => {
    let prev = blendTdee({ formula: 2759, measured: 2620, sufficientDays: 0 }).value ?? 0;
    for (let n = 1; n <= 30; n += 1) {
      const v = blendTdee({ formula: 2759, measured: 2620, sufficientDays: n }).value ?? 0;
      expect(Math.abs(v - prev)).toBeLessThanOrEqual(Math.abs(2759 - 2620) / 28 + 1e-9);
      prev = v;
    }
  });
  it('28 jours : la mesure prend le relais seule', () => {
    const r = blendTdee({ formula: 2759, measured: 2620, sufficientDays: 28 });
    expect(r.value).toBe(2620);
    expect(r.basis).toBe('measured');
  });
  it('0 jour : la formule seule', () => {
    const r = blendTdee({ formula: 2759, measured: 2620, sufficientDays: 0 });
    expect(r.value).toBe(2759);
    expect(r.basis).toBe('formula');
  });
  it('mesure absente : la formule, même après 28 jours', () => {
    const r = blendTdee({ formula: 2759, measured: null, sufficientDays: 40 });
    expect(r.value).toBe(2759);
    expect(r.basis).toBe('formula');
    expect(r.weightMeasured).toBe(0);
  });
  it('formule absente avant 28 jours : null, la mesure n\'est pas retenue seule (D-74 b)', () => {
    const r = blendTdee({ formula: null, measured: 2620, sufficientDays: 27 });
    expect(r.value).toBeNull();
    expect(r.basis).toBe('none');
  });
  it('formule absente à 28 jours : la mesure seule', () => {
    const r = blendTdee({ formula: null, measured: 2620, sufficientDays: 28 });
    expect(r.value).toBe(2620);
    expect(r.basis).toBe('measured');
  });
  it('rien : null, jamais zéro', () => {
    const r = blendTdee({ formula: null, measured: null, sufficientDays: 5 });
    expect(r.value).toBeNull();
    expect(r.basis).toBe('none');
  });
});

describe('I4-01 : estimateTdee : assemblage traçable', () => {
  const profile = { sex: 'male', birthYear: 1996, heightCm: 180 } as const;
  const end = at(40);
  const days: DayTotals[] = [];
  const weighIns: WeighIn[] = [];
  for (let i = 0; i <= 40; i += 1) {
    days.push(completeDay(at(i), 2400));
    if (i % 2 === 0) weighIns.push({ date: at(i), kg: 80 });
  }

  it('28 jours suffisants : la mesure prend le relais et la trace expose chaque terme', () => {
    const r = estimateTdee({ endDate: end, days, weighIns, profile, activity: 'moderate', previousSmoothed: null });
    expect(r.basis).toBe('measured');
    expect(r.weightMeasured).toBe(1);
    expect(r.value).toBeCloseTo(2400, 6);
    expect(r.formula).toBeCloseTo(2759, 6);
    expect(r.sufficientDays).toBeGreaterThanOrEqual(28);
    expect(r.coverage.sufficient).toBe(true);
    expect(r.engineVersion).toBe(1);
  });

  it('lisse avec la valeur précédente selon le pas écoulé', () => {
    const r = estimateTdee({
      endDate: end,
      days,
      weighIns,
      profile,
      activity: 'moderate',
      previousSmoothed: { date: addDays(end, -7), value: 2800 },
    });
    expect(r.measuredRaw).toBeCloseTo(2400, 6);
    expect(r.measuredSmoothed).toBeCloseTo(2600, 6);
  });

  it('sans aucune donnée ni profil : value null, jamais 0', () => {
    const r = estimateTdee({ endDate: end, days: [], weighIns: [], profile: null, activity: null, previousSmoothed: null });
    expect(r.value).toBeNull();
    expect(r.basis).toBe('none');
  });

  it('données insuffisantes mais profil déclaré : formule seule', () => {
    const r = estimateTdee({ endDate: end, days: [], weighIns: [{ date: end, kg: 80 }], profile, activity: 'light', previousSmoothed: null });
    expect(r.basis).toBe('formula');
    expect(r.value).toBeCloseTo(1780 * 1.375, 6);
  });
});
