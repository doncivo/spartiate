import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BENCH, CURL, CURL_EZ, DEADLIFT_TRAP, FITNESS_PARK_ANTONY, KETTLEBELL_GYM, LEG_PRESS, STACK_GYM, SWING } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG as CFG } from './config';
import { loadGrid, nextLoadAbove, snapDown, snapToEquipment } from './loadGrid';
import type { ProgressionEquipment } from './types';

/** I2-01, critère 6 (§ 11.3 « Snap », D-72 point 6) : charges disponibles et arrondi à la charge juste en dessous. */

const DUMBBELLS = loadGrid(CURL.equipment, FITNESS_PARK_ANTONY)?.loads ?? [];
const STACK = loadGrid(LEG_PRESS.equipment, STACK_GYM)?.loads ?? [];

describe('charges disponibles d’un exercice (profil par défaut Fitness Park Antony)', () => {
  it('barre : 20 kg puis pas de 2,5 kg jusqu’à 20 + 2 × 108,75 = 237,5 kg', () => {
    const grid = loadGrid(BENCH.equipment, FITNESS_PARK_ANTONY);
    expect(grid?.source).toBe('barbell');
    expect(grid?.loads[0]).toBe(20);
    expect(grid?.loads.at(-1)).toBe(237.5);
    expect(grid?.loads).toHaveLength(88);
    expect(grid?.loads).toContain(62.5);
  });

  it('haltères : 2 à 50 kg par pas de 2 (25 charges)', () => {
    expect(loadGrid(CURL.equipment, FITNESS_PARK_ANTONY)?.source).toBe('dumbbell');
    expect(DUMBBELLS).toHaveLength(25);
    expect(DUMBBELLS[0]).toBe(2);
    expect(DUMBBELLS.at(-1)).toBe(50);
  });

  it('machine sans palier connu (Fitness Park Antony) : aucune grille ; machine déclarée pas de 5 kg : 5 à 200 kg', () => {
    expect(loadGrid(LEG_PRESS.equipment, FITNESS_PARK_ANTONY)).toBeNull();
    expect(loadGrid(LEG_PRESS.equipment, STACK_GYM)?.source).toBe('machine');
    expect(STACK[0]).toBe(5);
    expect(STACK.at(-1)).toBe(200);
    expect(STACK).toHaveLength(40);
  });

  it('poulie sans plage déclarée, ou aucun profil : aucune grille ; kettlebells : la liste du profil', () => {
    expect(loadGrid(['high-pulley'], FITNESS_PARK_ANTONY)).toBeNull();
    expect(loadGrid(BENCH.equipment, null)).toBeNull();
    expect(loadGrid(['kettlebell'], KETTLEBELL_GYM)).toEqual({ source: 'kettlebell', loads: [4, 34] });
  });

  it('chaque barre est reliée à son matériel : barre EZ 8,5 kg, barre hexagonale 18 kg, barre droite = première barre « barbell »', () => {
    const ez = loadGrid(CURL_EZ.equipment, FITNESS_PARK_ANTONY);
    expect(ez?.source).toBe('barbell');
    expect(ez?.loads.slice(0, 4)).toEqual([8.5, 11, 13.5, 16]);
    expect(ez?.loads).toContain(21);
    expect(ez?.loads).not.toContain(22.5);
    expect(loadGrid(DEADLIFT_TRAP.equipment, FITNESS_PARK_ANTONY)?.loads.slice(0, 3)).toEqual([18, 20.5, 23]);
    expect(loadGrid(BENCH.equipment, FITNESS_PARK_ANTONY)?.loads[0]).toBe(20);
  });

  it('barre absente du profil ou non reliée à un matériel : aucune grille', () => {
    const unlinked: ProgressionEquipment = { inventory: { ...FITNESS_PARK_ANTONY.inventory, barbells: [{ type: 'Barre olympique', weightKg: 20 }] }, increments: FITNESS_PARK_ANTONY.increments };
    expect(loadGrid(BENCH.equipment, unlinked)).toBeNull();
    const noEz: ProgressionEquipment = { inventory: { ...FITNESS_PARK_ANTONY.inventory, barbells: [{ type: 'Barre olympique', weightKg: 20, equipmentId: 'barbell' }] }, increments: FITNESS_PARK_ANTONY.increments };
    expect(loadGrid(CURL_EZ.equipment, noEz)).toBeNull();
  });

  it('kettlebells à pas inconnu (« à vérifier ») : aucune grille, pas de [4, 34] trompeuse', () => {
    expect(loadGrid(SWING.equipment, FITNESS_PARK_ANTONY)).toBeNull();
    expect(loadGrid(SWING.equipment, KETTLEBELL_GYM)?.loads).toEqual([4, 34]);
  });

  it('le premier matériel de l’exercice qui fournit une grille l’emporte', () => {
    expect(loadGrid(['dumbbell', 'barbell'], FITNESS_PARK_ANTONY)?.source).toBe('dumbbell');
    expect(loadGrid(['flat-bench', 'barbell'], FITNESS_PARK_ANTONY)?.source).toBe('barbell');
  });

  it('barre sans incrément déclaré : pas = 2 × plus petit disque ; ni incrément ni disque : aucune grille', () => {
    const plates: ProgressionEquipment = {
      inventory: { ...FITNESS_PARK_ANTONY.inventory, platesPerSideKg: [{ weightKg: 2.5, count: 2 }, { weightKg: 10, count: 2 }] },
      increments: {},
    };
    expect(loadGrid(['barbell'], plates)?.loads).toEqual([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);
    expect(loadGrid(['barbell'], { inventory: { ...plates.inventory, barbells: [] }, increments: {} })).toBeNull();
    expect(loadGrid(['barbell'], { inventory: { ...plates.inventory, platesPerSideKg: [] }, increments: {} })).toBeNull();
  });
});

describe('arrondi à la charge disponible juste en dessous', () => {
  it('snapDown : 20,5 → 20 ; 21 → 20 ; sous le minimum → minimum ; au-dessus du maximum → maximum', () => {
    expect(snapDown(20.5, DUMBBELLS)).toBe(20);
    expect(snapDown(21, DUMBBELLS)).toBe(20);
    expect(snapDown(22, DUMBBELLS)).toBe(22);
    expect(snapDown(1, DUMBBELLS)).toBe(2);
    expect(snapDown(60, DUMBBELLS)).toBe(50);
  });

  it('nextLoadAbove : 20 → 22 ; 9 → 10 ; 50 → aucune', () => {
    expect(nextLoadAbove(20, DUMBBELLS)).toBe(22);
    expect(nextLoadAbove(9, DUMBBELLS)).toBe(10);
    expect(nextLoadAbove(50, DUMBBELLS)).toBeNull();
  });

  it('écart ≤ 3 % du cran inférieur : charge inférieure, mêmes reps (20,5 → 20 : 2,5 % ; stack 51 → 50 : 2 % ; 20,6 → 20 : 3 % pile)', () => {
    expect(snapToEquipment(20.5, [8, 8], DUMBBELLS, CFG)).toEqual({ loadKg: 20, reps: [8, 8], extraRep: false });
    expect(snapToEquipment(51, [10], STACK, CFG)).toEqual({ loadKg: 50, reps: [10], extraRep: false });
    expect(snapToEquipment(20.6, [8], DUMBBELLS, CFG)).toEqual({ loadKg: 20, reps: [8], extraRep: false });
  });

  it('écart > 3 % : charge inférieure et une répétition de plus par série (21 → 20 : 5 %)', () => {
    expect(snapToEquipment(21, [8, 7], DUMBBELLS, CFG)).toEqual({ loadKg: 20, reps: [9, 8], extraRep: true });
  });

  it('sans grille : arrondi au demi-kilo inférieur', () => {
    expect(snapToEquipment(52.66, [8], null, CFG)).toEqual({ loadKg: 52.5, reps: [8], extraRep: false });
    expect(snapToEquipment(102.5, [8], null, CFG)).toEqual({ loadKg: 102.5, reps: [8], extraRep: false });
  });

  it('propriété : snapDown est croissant et ne dépasse jamais la cible au-dessus du minimum', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 300, noNaN: true }), fc.double({ min: 0, max: 300, noNaN: true }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        for (const loads of [DUMBBELLS, STACK]) {
          expect(snapDown(lo, loads)).toBeLessThanOrEqual(snapDown(hi, loads));
          if (hi >= (loads[0] ?? 0)) expect(snapDown(hi, loads)).toBeLessThanOrEqual(hi + 1e-9);
        }
      }),
    );
  });
});
