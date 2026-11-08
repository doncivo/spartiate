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
    const { extraKg: _drop, ...oldRange } = antony.inventory.dumbbells;
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
