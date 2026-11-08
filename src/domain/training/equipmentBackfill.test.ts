import { describe, expect, it } from 'vitest';
import { backfillDumbbellExtras, emptyInventory } from './equipment';
import { loadGrid } from './loadGrid';
import type { EquipmentInventory, EquipmentProfileInput } from './types';

/**
 * I2-04 (point 1) : une copie du profil embarqué Fitness Park Antony faite avant la 0.3.0 n'a pas la paire d'haltères de 9 kg (`extraKg`).
 * Rattrapage À LA LECTURE (aucune migration, aucune écriture) : seul le champ manquant est ajouté ; tout le reste du profil est rendu tel
 * quel. Copie reconnue par son nom (préfixe du nom embarqué) ou par sa liste de matériel identique ; jamais pour un autre profil.
 */

const AVAILABLE = ['barbell', 'ez-bar', 'dumbbell', 'kettlebell', 'flat-bench'];
const EMBEDDED = [
  { name: 'Fitness Park Antony', inventory: { ...emptyInventory(), available: AVAILABLE, dumbbells: { minKg: 2, maxKg: 50, stepKg: 2, extraKg: [9] } } },
  { name: 'Maison haltères', inventory: { ...emptyInventory(), available: ['dumbbell'], dumbbells: { minKg: 2, maxKg: 20, stepKg: 2 } } },
];
const copy = (over: Partial<EquipmentProfileInput> = {}, inv: Partial<EquipmentInventory> = {}): EquipmentProfileInput => ({
  id: 'b0000000-0000-4000-8000-000000000001',
  name: 'Fitness Park Antony (copie)',
  kind: 'salle',
  inventory: { ...emptyInventory(), available: AVAILABLE, dumbbells: { minKg: 2, maxKg: 50, stepKg: 2 }, toVerify: ['kettlebells'] },
  increments: { barbell: 2.5, dumbbell: 2 },
  ...over,
  ...(Object.keys(inv).length > 0 ? { inventory: { ...emptyInventory(), available: AVAILABLE, dumbbells: { minKg: 2, maxKg: 50, stepKg: 2 }, ...inv } } : {}),
});

describe('backfillDumbbellExtras (I2-04, paire de 9 kg)', () => {
  it('copie d’avant la 0.3.0 : extraKg [9] ajouté, le reste inchangé ; la grille des haltères contient 9 kg', () => {
    const stored = copy();
    const read = backfillDumbbellExtras(stored, EMBEDDED);
    expect(read.inventory.dumbbells).toEqual({ minKg: 2, maxKg: 50, stepKg: 2, extraKg: [9] });
    expect({ ...read, inventory: { ...read.inventory, dumbbells: stored.inventory.dumbbells } }).toEqual(stored);
    expect(loadGrid(['dumbbell'], read)?.loads).toContain(9);
    expect(loadGrid(['dumbbell'], stored)?.loads).not.toContain(9);
  });

  it('copie renommée par Ali, même matériel : reconnue ; autres valeurs modifiées (incréments, kettlebells, plage) conservées', () => {
    const stored = copy({ name: 'Ma salle', increments: { barbell: 1.25, dumbbell: 2 } }, { kettlebellsKg: [8, 12], dumbbells: { minKg: 4, maxKg: 40, stepKg: 2 } });
    const read = backfillDumbbellExtras(stored, EMBEDDED);
    expect(read.inventory.dumbbells).toEqual({ minKg: 4, maxKg: 40, stepKg: 2, extraKg: [9] });
    expect(read.increments).toEqual({ barbell: 1.25, dumbbell: 2 });
    expect(read.inventory.kettlebellsKg).toEqual([8, 12]);
    expect(read.name).toBe('Ma salle');
  });

  it('nom et matériel différents (autre profil) : rien d’ajouté, même objet rendu', () => {
    const stored = copy({ name: 'Garage' }, { available: ['dumbbell', 'flat-bench'] });
    expect(backfillDumbbellExtras(stored, EMBEDDED)).toBe(stored);
  });

  it('extraKg déjà présent (même vide ou différent) : jamais remplacé', () => {
    const stored = copy({}, { dumbbells: { minKg: 2, maxKg: 50, stepKg: 2, extraKg: [11] } });
    expect(backfillDumbbellExtras(stored, EMBEDDED)).toBe(stored);
  });

  it('sans haltères, ou plage qui n’encadre plus 9 kg : rien d’ajouté (charge impossible jamais proposée)', () => {
    const none = copy({}, { dumbbells: null });
    expect(backfillDumbbellExtras(none, EMBEDDED)).toBe(none);
    const heavy = copy({}, { dumbbells: { minKg: 10, maxKg: 50, stepKg: 2 } });
    expect(backfillDumbbellExtras(heavy, EMBEDDED)).toBe(heavy);
  });

  it('copie d’un profil embarqué sans paire en plus (Maison haltères) : rien d’ajouté ; entrée jamais modifiée', () => {
    const stored = copy({ name: 'Maison haltères (copie)' }, { available: ['dumbbell'], dumbbells: { minKg: 2, maxKg: 20, stepKg: 2 } });
    const frozen = JSON.stringify(stored);
    expect(backfillDumbbellExtras(stored, EMBEDDED)).toBe(stored);
    const antony = copy();
    backfillDumbbellExtras(antony, EMBEDDED);
    expect(antony.inventory.dumbbells).toEqual({ minKg: 2, maxKg: 50, stepKg: 2 });
    expect(JSON.stringify(stored)).toBe(frozen);
  });
});
