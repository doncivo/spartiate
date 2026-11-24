import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { GYM_PROFILE } from '../../../../tests/fixtures/training';
import { openBaseDb, type TestDb } from './testSetup';

/** SEANCE-0292 (C-081) : suppression du profil actif d'un seul tenant (profil supprimé et réglage local effacé ensemble). */
const DEVICE = '60000000-0000-4000-8000-0000000000e3' as DeviceId;
const A = '8a3a1c2e-0000-4000-8000-0000000000b1';
const B = '8a3a1c2e-0000-4000-8000-0000000000b2';
let db: TestDb;
afterEach(async () => db.close());

describe('C-081 : suppression d’un profil actif', () => {
  it('le profil actif supprimé efface le réglage local dans la même opération ; un autre profil actif reste actif', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.equipmentProfiles();
    await repo.create({ id: A, name: 'Salle', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: {} });
    await repo.create({ id: B, name: 'Autre', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: {} });
    await repo.setActive(A);
    await repo.softDelete(A);
    expect(await repo.getActiveId()).toBeNull();
    await repo.setActive(B);
    await repo.create({ id: A.replace('b1', 'b3'), name: 'Troisième', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: {} });
    await repo.softDelete(A.replace('b1', 'b3'));
    expect(await repo.getActiveId()).toBe(B);
  });

  it('échec du réglage : la suppression est annulée (une transaction)', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.equipmentProfiles();
    await repo.create({ id: A, name: 'Salle', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: {} });
    await repo.setActive(A);
    await db.driver.execute("CREATE TRIGGER t_fail BEFORE UPDATE ON settings WHEN NEW.key = 'training.activeEquipmentProfile' BEGIN SELECT RAISE(ABORT, 'échec simulé'); END");
    await db.driver.execute("CREATE TRIGGER t_fail_i BEFORE INSERT ON settings WHEN NEW.key = 'training.activeEquipmentProfile' BEGIN SELECT RAISE(ABORT, 'échec simulé'); END");
    await expect(repo.softDelete(A)).rejects.toBeDefined();
    expect(await repo.get(A)).not.toBeNull();
    expect(await repo.getActiveId()).toBe(A);
  });
});
