import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EquipmentInventory } from '../../domain/training';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { loadTrainingContent } from './content';
import { readTrainingData } from './trainingState';

/**
 * I2-04 (point 1) : la copie du profil Fitness Park Antony déjà en base (faite avant la 0.3.0, sans la paire de 9 kg) est complétée À LA
 * LECTURE depuis le profil embarqué ; la ligne `equipment_profile` n'est jamais réécrite (ni `updated_at`, ni `hlc`, ni `inventory`).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f4' as DeviceId;
const ID = '3c5d7e9f-0000-4000-8000-000000000a01';
let db: TestDb;

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-01T17:00:00.000Z');
});
afterEach(async () => {
  await db.close();
});

describe('readTrainingData : rattrapage de la paire de 9 kg', () => {
  it('copie d’avant la 0.3.0 : extraKg [9] lu, ligne en base inchangée, profil actif complété', async () => {
    const content = await loadTrainingContent();
    const antony = content.profiles.find((p) => p.id === 'fitness-park-antony');
    if (antony === undefined || antony.inventory.dumbbells === null) throw new Error('profil embarqué absent');
    // Copie faite avant la 0.3.0 : haltères 2 à 50 kg sans la paire de 9 kg (valeurs figées de l'ancien profil, indépendantes du contenu actuel, FIX-0173).
    const oldRange = { minKg: 2, maxKg: 50, stepKg: 2 };
    const oldInventory: EquipmentInventory = { ...antony.inventory, dumbbells: oldRange };
    await (await db.data.repos.equipmentProfiles()).create({ id: ID, name: 'Fitness Park Antony (copie)', kind: antony.kind, inventory: oldInventory, increments: antony.increments });
    await db.data.repos.settings.set('training.activeEquipmentProfile', ID);
    const row = () => db.driver.select<{ inventory: string; updated_at: string; hlc: string; name: string }>('SELECT inventory, updated_at, hlc, name FROM equipment_profile WHERE id = ?', [ID]);
    const before = await row();
    expect((JSON.parse(before[0]?.inventory ?? '{}') as EquipmentInventory).dumbbells?.extraKg).toBeUndefined();

    const data = await readTrainingData(db.data);
    expect(data.personal[0]?.inventory.dumbbells).toEqual({ minKg: 2, maxKg: 50, stepKg: 2, extraKg: [9] });
    expect(data.active.id).toBe(ID);
    expect(data.active.inventory.dumbbells?.extraKg).toEqual([9]);
    expect(await row()).toEqual(before);
  });
});

describe('FIX-0173 (D-142) : « Salle complète » remplace le profil par salle, sans perte', () => {
  it('réglage local resté sur l’ancien identifiant : même profil, renommé « Salle complète », aucune écriture', async () => {
    await db.data.repos.settings.set('training.activeEquipmentProfile', 'fitness-park-antony');
    const data = await readTrainingData(db.data);
    expect(data.active).toMatchObject({ id: 'fitness-park-antony', name: 'Salle complète' });
    expect(await db.data.repos.settings.get('training.activeEquipmentProfile')).toBe('fitness-park-antony');
  });

  it('réglage resté sur l’ancien préréglage « Salle commerciale » : la salle complète, jamais un profil absent ; copies personnelles intactes', async () => {
    const content = await loadTrainingContent();
    const salle = content.profiles[0];
    if (salle === undefined) throw new Error('profil embarqué absent');
    await (await db.data.repos.equipmentProfiles()).create({ id: ID, name: 'Ma copie', kind: 'salle', inventory: salle.inventory, increments: salle.increments });
    await db.data.repos.settings.set('training.activeEquipmentProfile', 'salle-commerciale');
    const data = await readTrainingData(db.data);
    expect(data.active).toMatchObject({ id: 'fitness-park-antony', name: 'Salle complète' });
    expect(data.content.profiles.filter((p) => p.kind === 'salle').map((p) => p.name)).toEqual(['Salle complète']);
    expect(data.personal.map((p) => p.name)).toEqual(['Ma copie']);
  });
});
