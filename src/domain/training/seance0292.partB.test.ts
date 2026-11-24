import { describe, expect, it } from 'vitest';
import { emptyInventory, validateEquipmentProfile } from './index';

/** SEANCE-0292, partie B : vecteurs du domaine de l'entraînement (une section par ligne). */

describe('C-081 : un même poids deux fois dans l’inventaire est refusé', () => {
  const profile = (over: Partial<ReturnType<typeof emptyInventory>>) => ({ name: 'Salle', kind: 'salle' as const, inventory: { ...emptyInventory(), ...over }, increments: {} });
  it('disques en double : « plates » ; kettlebells en double : « kettlebells » ; sans double : aucun motif', () => {
    expect(validateEquipmentProfile(profile({ platesPerSideKg: [{ weightKg: 20, count: 2 }, { weightKg: 20, count: 1 }] })).map((i) => i.code)).toEqual(['plates']);
    expect(validateEquipmentProfile(profile({ kettlebellsKg: [16, 16] })).map((i) => i.code)).toEqual(['kettlebells']);
    expect(validateEquipmentProfile(profile({ platesPerSideKg: [{ weightKg: 20, count: 4 }], kettlebellsKg: [12, 16] }))).toEqual([]);
  });
});
