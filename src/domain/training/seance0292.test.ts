import { describe, expect, it } from 'vitest';

import { BENCH, CURL, input, session, target } from '../../../tests/fixtures/training/progression';
import { prescribe } from './prescribe';

/**
 * SEANCE-0292 (lot 0.29.2, partie A : moteur et génération) : une section par ligne du registre (docs/SEANCE-0292.md). Fixtures
 * synthétiques, valeurs vérifiables à la main.
 */

describe('SEANCE-0292 C-004 : recalibrage « Facile » borné à un cran en confiance provisoire (§ 11.2.5, § 11.3)', () => {
  it('100 × 8 « Facile » en une seule série (confiance < 0,4) : au plus un cran de barre (102,5 kg), pas 105 kg', () => {
    const p = prescribe(input({ exercise: BENCH, history: [session(1, 100, [8], { difficulty: 'easy' })], target: target(8, 10) }));
    expect(p.confidence).toBeLessThan(0.4);
    expect(p.reasons).toContain('provisional');
    expect(p.headline).toBe('recalibration');
    expect(p.loadKg).toBe(102.5);
  });

  it('confiance entre 0,4 et 0,6 : le recalibrage +5 % reste entier (105 kg, deux crans permis)', () => {
    const p = prescribe(input({ exercise: BENCH, history: [session(1, 100, [8, 8], { difficulty: 'easy' })], target: target(8, 10) }));
    expect(p.confidence).toBeGreaterThanOrEqual(0.4);
    expect(p.confidence).toBeLessThan(0.6);
    expect(p.loadKg).toBe(105);
  });
});

describe('SEANCE-0292 C-006 : décharge arrondie vers le bas, sans répétition ajoutée (D-269)', () => {
  it('haltères 26 kg × 10, décharge × 0,9 (cycle de 4 semaines) : 22 kg × 10, aucune répétition ajoutée', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 26, [10, 10, 10])], target: target(8, 10), deload: true, deloadSets: 2, deloadLoad: 0.9 }));
    expect(p.headline).toBe('deload');
    expect(p.loadKg).toBe(22);
    expect(p.sets.map((s) => s.reps)).toEqual([10, 10]);
    expect(p.reasons).not.toContain('snap-extra-rep');
  });

  it('décharge I2 (× 0,8) : 26 kg → 20 kg (20,8 arrondi vers le bas), répétitions de la référence', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 26, [10, 10, 10])], target: target(8, 10), deload: true }));
    expect(p.loadKg).toBe(20);
    expect(p.sets.every((s) => s.reps === 10)).toBe(true);
    expect(p.reasons).not.toContain('snap-extra-rep');
  });
});
