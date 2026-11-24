import { describe, expect, it } from 'vitest';

import { BENCH, CURL, FITNESS_PARK_ANTONY, input, session, target } from '../../../tests/fixtures/training/progression';
import { loadGrid } from './loadGrid';
import { prescribe } from './prescribe';
import type { ProgressionEquipment } from './types';

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

describe('SEANCE-0292 C-007 : grille de barre limitée aux disques réellement montables (§ 11.2.7, § 14.3)', () => {
  const home = (plates: { weightKg: number; count: number }[], increments: ProgressionEquipment['increments'] = {}): ProgressionEquipment => ({
    inventory: { ...FITNESS_PARK_ANTONY.inventory, platesPerSideKg: plates },
    increments,
  });

  it('disques par côté {20, 2,5} : 20, 25, 60 et 65 kg seulement ; 45 kg (impossible à monter) jamais proposé', () => {
    expect(loadGrid(['barbell'], home([{ weightKg: 20, count: 1 }, { weightKg: 2.5, count: 1 }]))?.loads).toEqual([20, 25, 60, 65]);
    expect(loadGrid(['barbell'], home([{ weightKg: 20, count: 1 }, { weightKg: 2.5, count: 1 }], { barbell: 2.5 }))?.loads).toEqual([20, 25, 60, 65]);
  });

  it('deux disques de 2,5 et deux de 10 par côté : 35 et 55 kg exclus', () => {
    expect(loadGrid(['barbell'], home([{ weightKg: 2.5, count: 2 }, { weightKg: 10, count: 2 }]))?.loads).toEqual([20, 25, 30, 40, 45, 50, 60, 65, 70]);
  });

  it('profil de la salle (un disque de chaque masse de 1,25 à 30 kg) : grille inchangée, 20 à 237,5 kg par 2,5', () => {
    const loads = loadGrid(['barbell'], FITNESS_PARK_ANTONY)?.loads ?? [];
    expect(loads[0]).toBe(20);
    expect(loads[loads.length - 1]).toBe(237.5);
    expect(loads.length).toBe(88);
  });

  it('incrément déclaré plus grand que le plus petit disque : le pas déclaré reste respecté (5 kg)', () => {
    expect(loadGrid(['barbell'], home([{ weightKg: 1.25, count: 2 }, { weightKg: 5, count: 2 }], { barbell: 5 }))?.loads).toEqual([20, 25, 30, 35, 40]);
  });

  it('haut de plage à 25 kg avec {20, 2,5} : cran montable suivant 60 kg au-delà du plafond +10 %, échelle de répétitions (pas 30 kg)', () => {
    const p = prescribe(input({ exercise: BENCH, history: [session(3, 25, [10, 10, 10])], target: target(8, 10), equipment: home([{ weightKg: 20, count: 1 }, { weightKg: 2.5, count: 1 }]) }));
    expect(p.loadKg).toBe(25);
    expect(p.reasons).toContain('gain-capped');
  });
});
