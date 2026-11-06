import { afterEach, describe, expect, it } from 'vitest';
import type { EquipmentProfileInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { GYM_PROFILE, HOME_PROFILE } from '../../../../tests/fixtures/training';
import { openBaseDb, type TestDb } from './testSetup';

const DEVICE = '60000000-0000-4000-8000-0000000000e2' as DeviceId;
const A = '8a3a1c2e-0000-4000-8000-0000000000a1';
const B = '8a3a1c2e-0000-4000-8000-0000000000a2';
let db: TestDb;
afterEach(async () => db.close());

const input = (over: Partial<EquipmentProfileInput> = {}): EquipmentProfileInput => ({ id: A, name: 'Salle', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: { barbell: 2.5, dumbbell: 2 }, ...over });

describe('EquipmentProfileRepository (§ 14.3)', () => {
  it('create / get : inventaire et incréments relus à l’identique, publiés par la file', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.equipmentProfiles();
    const created = await repo.create(input());
    expect(created).toMatchObject({ id: A, name: 'Salle', kind: 'salle', increments: { barbell: 2.5, dumbbell: 2 }, deletedAt: null });
    expect(created.inventory).toEqual(GYM_PROFILE.inventory);
    expect(await repo.get(A)).toEqual(created);
    expect(await db.driver.select("SELECT field FROM sync_outbox WHERE table_name = 'equipment_profile'")).toEqual([{ field: '*' }]);
  });

  it('refuse une collision d’identifiant, un profil invalide (rien n’est écrit) et un identifiant non UUID', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.equipmentProfiles();
    await repo.create(input());
    await expect(repo.create(input({ name: 'Autre' }))).rejects.toMatchObject({ code: 'conflict' });
    await expect(repo.create(input({ id: B, name: ' ' }))).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.create(input({ id: B, kind: 'garage' as never }))).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.create(input({ id: 'salle' }))).rejects.toMatchObject({ code: 'invalid' });
    expect((await repo.list()).map((p) => p.id)).toEqual([A]);
  });

  it('update, suppression logique, liste triée par nom', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.equipmentProfiles();
    await repo.create(input());
    await repo.create(input({ id: B, name: 'Maison', kind: 'maison', inventory: HOME_PROFILE.inventory, increments: {} }));
    expect((await repo.list()).map((p) => p.name)).toEqual(['Maison', 'Salle']);
    db.clock.advance(1_000);
    const updated = await repo.update(A, { name: 'Salle Antony', increments: { barbell: 1.25 } });
    expect(updated).toMatchObject({ name: 'Salle Antony', increments: { barbell: 1.25 } });
    await expect(repo.update(A, { name: '' })).rejects.toMatchObject({ code: 'invalid' });
    await repo.softDelete(B);
    expect((await repo.list()).map((p) => p.id)).toEqual([A]);
    await expect(repo.softDelete(B)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('profil actif : réglage local de l’appareil, jamais publié ni capturé', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.equipmentProfiles();
    expect(await repo.getActive()).toBeNull();
    await repo.create(input());
    await db.driver.execute('DELETE FROM sync_outbox');
    await repo.setActive(A);
    expect((await repo.getActive())?.id).toBe(A);
    expect(await repo.getActiveId()).toBe(A);
    expect(await db.driver.select('SELECT 1 FROM sync_outbox')).toEqual([]);
    expect(await db.driver.select("SELECT key FROM settings WHERE key = 'training.activeEquipmentProfile'")).toHaveLength(1);
    await expect(repo.setActive(B)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('profil actif supprimé ou reçu supprimé : getActive rend null sans erreur', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.equipmentProfiles();
    await repo.create(input());
    await repo.setActive(A);
    await repo.softDelete(A);
    expect(await repo.getActive()).toBeNull();
    await repo.setActive(null);
    expect(await repo.getActiveId()).toBeNull();
  });

  it('inventaire corrompu en base : lecture de repli (inventaire vide), ligne conservée', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.equipmentProfiles();
    await repo.create(input());
    await db.driver.execute("UPDATE equipment_profile SET inventory = '[1,2]', increments = 'x' WHERE id = ?", [A]);
    const row = await repo.get(A);
    expect(row).toMatchObject({ id: A, name: 'Salle', increments: {} });
    expect(row?.inventory.available).toEqual([]);
  });
});
