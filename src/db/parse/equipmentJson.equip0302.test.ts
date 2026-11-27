import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EQUIPMENT_ID_LIST_MAX, EQUIPMENT_LIST_MAX, validateEquipmentProfile } from '../../domain/training';
import { GYM_PROFILE } from '../../../tests/fixtures/training';
import { parseInventory } from './equipmentJson';

/**
 * EQUIP-0302 (D-796) : une liste d'identifiants de matériel d'un profil (disponible, forcé, interdit) peut contenir tout le catalogue embarqué ;
 * l'ancienne borne (64) était plus petite que le catalogue (77) : une copie de « Salle complète » ne pouvait plus recevoir un matériel de plus. La
 * borne est fixe et sûre, gardée par un test qui échoue si le catalogue la rattrape ; le domaine refuse ce que la lecture refuserait (raison nommée).
 */
const catalogue = (JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../content/exercises/equipment.json'), 'utf8')) as { equipment: { id: string }[] }).equipment.map((e) => e.id);

describe('EQUIP-0302 : borne des listes de matériel d’un profil', () => {
  it('garde : la borne dépasse largement le catalogue embarqué (au moins le double)', () => {
    expect(catalogue.length).toBeGreaterThan(64);
    expect(EQUIPMENT_ID_LIST_MAX).toBeGreaterThanOrEqual(2 * catalogue.length);
    expect(EQUIPMENT_LIST_MAX).toBe(64);
  });

  it('tout le catalogue disponible, forcé ou interdit : relu à l’identique ; une liste au-delà de la borne : refusée', () => {
    for (const key of ['available', 'forced', 'forbidden'] as const) {
      const inventory = { ...GYM_PROFILE.inventory, available: [], forced: [], forbidden: [], [key]: catalogue };
      expect(parseInventory(inventory)?.[key], key).toEqual(catalogue);
      const over = Array.from({ length: EQUIPMENT_ID_LIST_MAX + 1 }, (_, i) => `m${String(i)}`);
      expect(parseInventory({ ...inventory, [key]: over }), key).toBeNull();
    }
  });

  it('domaine : refuse ce que la lecture refuserait, avec un code nommé (ids, kettlebells, plates)', () => {
    const base = { name: 'Salle', kind: 'salle' as const, inventory: GYM_PROFILE.inventory, increments: {} };
    expect(validateEquipmentProfile({ ...base, inventory: { ...base.inventory, available: catalogue } })).toEqual([]);
    expect(validateEquipmentProfile({ ...base, inventory: { ...base.inventory, available: Array.from({ length: EQUIPMENT_ID_LIST_MAX + 1 }, (_, i) => `m${String(i)}`) } })).toEqual([{ code: 'ids' }]);
    expect(validateEquipmentProfile({ ...base, inventory: { ...base.inventory, kettlebellsKg: Array.from({ length: EQUIPMENT_LIST_MAX + 1 }, (_, i) => i + 1) } })).toEqual([{ code: 'kettlebells' }]);
    expect(validateEquipmentProfile({ ...base, inventory: { ...base.inventory, platesPerSideKg: Array.from({ length: EQUIPMENT_LIST_MAX + 1 }, (_, i) => ({ weightKg: i + 1, count: 1 })) } })).toEqual([{ code: 'plates' }]);
  });
});
