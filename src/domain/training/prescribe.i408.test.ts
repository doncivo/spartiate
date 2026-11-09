import { describe, expect, it } from 'vitest';
import { prescribe } from './prescribe';
import { explainPrescription } from './explain';
import { progressionFr } from '../../i18n/fr.progression';
import { recalibrationKept } from './decision';
import type { Prescription, ProgressionEquipment } from './types';
import { CURL, FITNESS_PARK_ANTONY, input, session, target } from '../../../tests/fixtures/training/progression';

/** I4-08 (0.9.1) : défauts du moteur relevés par relecture à froid avant la première séance réelle (docs/I4-06.md § 1.5). */

describe('I4-08 point 1 : un choix de fatigue retenu ne re-déclenche pas la fatigue', () => {
  const t = target(8, 12);
  const base = [session(6, 60, [10, 10, 10]), session(4, 60, [7, 7, 7])];

  it('7-7-7 après 10-10-10 : fatigue et choix « −2 reps » (5-5-5) proposés', () => {
    const p = prescribe(input({ history: base, target: t }));
    expect(p.reasons).toContain('fatigue-drop');
    expect(p.options?.find((o) => o.kind === 'fatigue-reps')).toEqual({ kind: 'fatigue-reps', loadKg: 60, reps: [5, 5, 5] });
  });

  it('« −2 reps » retenu puis 5-5-5 réalisé : la séance suivante reprend la double progression (pas de fatigue)', () => {
    const history = [...base, session(2, 60, [5, 5, 5], { fatigueChoice: true })];
    const p = prescribe(input({ history, target: t }));
    expect(p.reasons).not.toContain('fatigue-drop');
    expect(p.headline).toBe('rep-ladder');
    expect(p.loadKg).toBe(60);
    expect(p.sets.map((s) => s.reps)).toEqual([6, 5, 5]);
  });

  it('la séance du choix n’est jamais la base de comparaison d’une séance ultérieure : 4-4-4 comparée à 7-7-7 (−43 %), pas à 5-5-5 (−20 %)', () => {
    const history = [...base, session(3, 60, [5, 5, 5], { fatigueChoice: true }), session(1, 60, [4, 4, 4])];
    expect(prescribe(input({ history, target: t })).reasons).toContain('fatigue-drop');
  });

  it('sans marqueur (5-5-5 sans choix retenu) : la fatigue reste détectée', () => {
    const history = [...base, session(2, 60, [5, 5, 5])];
    expect(prescribe(input({ history, target: t })).reasons).toContain('fatigue-drop');
  });
});

describe('I4-08 point 2 : décote d’inactivité arrondie au cran du matériel, écart réel annoncé', () => {
  // Haltères 2 à 50 kg par pas de 2 (cran 2 kg, demi-cran 1 kg) ; barre olympique et disques de 1,25 kg par côté (cran 2,5 kg, demi-cran 1,25 kg).
  const curl = (daysOff: number) => prescribe(input({ exercise: CURL, history: [session(daysOff, 20, [11, 10, 10])], target: target(8, 12) }));
  const bench = (daysOff: number) => prescribe(input({ history: [session(daysOff, 60, [8, 8, 8])], target: target(8, 10) }));

  it('haltères, 20 kg, J21 (−1 % = 0,2 kg < demi-cran) : charge maintenue à 20 kg, jamais 18 kg annoncés « −1 % »', () => {
    const p = curl(21);
    expect(p.headline).toBe('inactivity');
    expect(p.reasons).toContain('inactivity-discount');
    expect(p.loadKg).toBe(20);
    expect(p.deltaKg).toBe(0);
    expect(p.sets.map((s) => s.reps)).toEqual([11, 10, 10]);
    expect(explainPrescription(p)).toEqual({ key: 'inactivityHeld', params: { cut: 1 } });
  });

  it('haltères, 20 kg, J49 (−5 % = 1 kg ≥ demi-cran) : un cran (18 kg), phrase « −2 kg (−10 %) » calculée sur la charge appliquée', () => {
    const p = curl(49);
    expect(p.inactivityCut).toBeCloseTo(0.05, 12);
    expect(p.loadKg).toBe(18);
    expect(p.deltaKg).toBe(-2);
    expect(explainPrescription(p)).toEqual({ key: 'inactivity', params: { delta: 2, cut: 10 } });
  });

  it('barre, 60 kg, J21 (−1 % = 0,6 kg < 1,25 kg) : charge maintenue', () => {
    const p = bench(21);
    expect(p.loadKg).toBe(60);
    expect(explainPrescription(p)).toEqual({ key: 'inactivityHeld', params: { cut: 1 } });
  });

  it('barre, 60 kg, J35 (−3 % = 1,8 kg ≥ 1,25 kg) : un cran (57,5 kg), écart réel −2,5 kg (−4,2 %)', () => {
    const p = bench(35);
    expect(p.loadKg).toBe(57.5);
    expect(explainPrescription(p)).toEqual({ key: 'inactivity', params: { delta: 2.5, cut: 4.2 } });
  });

  it('texte : « charge maintenue » dit en clair ; l’écart réel en kg et en %', () => {
    const texts: Readonly<Record<string, string>> = progressionFr;
    expect(texts.explainInactivityHeld).toMatch(/^Charge maintenue/);
    expect(texts.explainInactivity).toContain('{delta} kg');
    expect(texts.explainInactivity).toContain('{cut} %');
  });
});

describe('I4-08 point 3 : recalibrage « Facile » sans effet sur la charge = pas de recalibrage', () => {
  const capped = (maxKg: number): ProgressionEquipment => ({
    inventory: { ...FITNESS_PARK_ANTONY.inventory, dumbbells: { minKg: 2, maxKg, stepKg: 2 }, toVerify: [] },
    increments: FITNESS_PARK_ANTONY.increments,
  });
  const easyCurl = (maxKg: number) =>
    prescribe(input({ exercise: CURL, equipment: capped(maxKg), history: [session(2, 20, [8, 8, 8], { difficulty: 'easy' })], target: target(8, 12) }));

  for (const maxKg of [20, 40]) {
    it(`haltères 2 à ${String(maxKg)} kg, 20 kg Facile : +5 % (21 kg) retombe sur 20 kg → échelle de répétitions, ni « +0 kg » ni 1RM relevé`, () => {
      const p = easyCurl(maxKg);
      expect(p.loadKg).toBe(20);
      expect(p.reasons).not.toContain('easy-recalibration');
      expect(p.recalibration).toBeNull();
      expect(p.headline).toBe('rep-ladder');
      expect(p.sets.map((s) => s.reps)).toEqual([9, 8, 8]);
      expect(explainPrescription(p).key).not.toBe('recalibration');
    });
  }

  it('barre, 60 kg Facile : +5 % (63 kg) → 62,5 kg, le recalibrage reste (témoin)', () => {
    const p = prescribe(input({ history: [session(2, 60, [8, 8, 8], { difficulty: 'easy' })] }));
    expect(p.headline).toBe('recalibration');
    expect(p.loadKg).toBe(62.5);
    expect(p.recalibration).not.toBeNull();
  });

  it('clôture : une prescription tracée « recalibrage » sans hausse de charge (moteur 0.9.0) ne relève pas le 1RM ni ne démarre le délai de 30 jours', () => {
    const p = prescribe(input({ history: [session(2, 60, [8, 8, 8], { difficulty: 'easy' })] }));
    const flat: Prescription = { ...p, loadKg: 60, deltaKg: 0, sets: p.sets.map((s) => ({ ...s, loadKg: 60 })) };
    expect(recalibrationKept(flat, 60)).toBeNull();
    expect(recalibrationKept(p, 62.5)).toEqual(p.recalibration);
  });
});
