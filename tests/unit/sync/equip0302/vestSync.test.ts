import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import type { EquipmentProfileInput } from '../../../../src/domain/training';
import { setSnapshotTestHooks } from '../../../../src/sync/snapshot';
import { HOME_PROFILE } from '../../../fixtures/training';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * EQUIP-0302 (BL-175, D-674, D-26) : `equipment_profile.vest_kg` (migration 0025) à deux bases. Un profil avec un poids de gilet est publié et reçu ;
 * une modification du poids part champ par champ. Un appareil resté au schéma 24 garde le champ dans `sync_unknown` (une modification qu'il fait sur
 * un autre champ ne l'efface jamais) et le réintègre à sa mise à jour ; un profil qu'il crée (sans le champ) est mis de côté chez l'appareil à jour,
 * puis reçu entier, poids nul, après sa mise à jour (`SCHEMA_REPUBLISH[25]`). Données synthétiques.
 */
const A_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbe302';
const B_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaae302';
const P = '5c1d0e2f-0000-4000-8000-00000000e302';
const P_OLD = '5c1d0e2f-0000-4000-8000-00000000e301';
const INVENTORY = { ...HOME_PROFILE.inventory, available: [...HOME_PROFILE.inventory.available, 'weighted-vest'] };
const profile = (id: string, over: Partial<EquipmentProfileInput> = {}): EquipmentProfileInput => ({ id, name: 'Maison', kind: 'maison', inventory: INVENTORY, increments: {}, ...over });

let devices: SimDevice[] = [];
afterEach(async () => {
  setSnapshotTestHooks({});
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});
async function two(bSchema: SimSchema = 'i0'): Promise<{ a: SimDevice; b: SimDevice }> {
  const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', schema: bSchema, clock: createManualClock(a.clock.nowMs()) });
  devices = [a, b];
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders(devices);
  await a.cycle();
  return { a, b };
}
async function roundTrip(times = 2): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}
const create = async (d: SimDevice, input: EquipmentProfileInput) => (await d.data.repos.equipmentProfiles()).create(input);
const update = async (d: SimDevice, id: string, patch: Parameters<Awaited<ReturnType<SimDevice['data']['repos']['equipmentProfiles']>>['update']>[1]) => (await d.data.repos.equipmentProfiles()).update(id, patch);
const row = (d: SimDevice, id: string) => d.driver.select('SELECT name, vest_kg FROM equipment_profile WHERE id = ?', [id]);
const conflicts = async (d: SimDevice) => (await d.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n;
const unknownFields = async (d: SimDevice) => (await d.driver.select<{ field: string }>("SELECT field FROM sync_unknown WHERE table_name = 'equipment_profile' ORDER BY field")).map((r) => r.field);

describe('EQUIP-0302 : poids du gilet à deux bases', () => {
  it('profil créé avec un poids : reçu ; poids modifié de l’autre côté : reçu en retour ; aucun conflit, rien de côté', async () => {
    const { a, b } = await two();
    await create(a, profile(P, { vestKg: 10 }));
    await roundTrip();
    expect(await row(b, P)).toEqual([{ name: 'Maison', vest_kg: 10 }]);
    expect((await (await b.data.repos.equipmentProfiles()).get(P))?.vestKg).toBe(10);
    await update(b, P, { vestKg: 12.5 });
    await roundTrip();
    expect(await row(a, P)).toEqual([{ name: 'Maison', vest_kg: 12.5 }]);
    expect(await conflicts(a)).toBe(0);
    expect(await conflicts(b)).toBe(0);
    expect(await b.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
  });

  it('appareil resté au schéma 24 : profil reçu, poids gardé dans sync_unknown ; son renommage ne l’efface pas ; réintégré à sa mise à jour', async () => {
    const { a, b } = await two('v24');
    await create(a, profile(P, { vestKg: 10 }));
    await roundTrip(3);
    expect(await b.driver.select('SELECT name FROM equipment_profile WHERE id = ?', [P])).toEqual([{ name: 'Maison' }]);
    expect(await unknownFields(b)).toEqual(['vest_kg']);
    await update(b, P, { name: 'Maison et gilet' });
    await roundTrip(3);
    expect(await row(a, P)).toEqual([{ name: 'Maison et gilet', vest_kg: 10 }]);
    await b.upgradeSchema('i0');
    await roundTrip(3);
    expect(await row(b, P)).toEqual([{ name: 'Maison et gilet', vest_kg: 10 }]);
    expect(await unknownFields(b)).toEqual([]);
    expect(await conflicts(a)).toBe(0);
  });

  it('profil créé au schéma 24 (sans le champ) : mis de côté chez l’appareil à jour, puis reçu entier, poids nul, après la mise à jour', async () => {
    const { a, b } = await two('v24');
    await create(b, profile(P_OLD, { name: 'Voyage', kind: 'voyage' }));
    await roundTrip(3);
    expect(await row(a, P_OLD)).toEqual([]);
    expect((await a.driver.select<{ n: number }>("SELECT COUNT(*) AS n FROM sync_parked WHERE table_name = 'equipment_profile'"))[0]?.n).toBeGreaterThan(0);
    await b.upgradeSchema('i0');
    await roundTrip(4);
    expect(await row(a, P_OLD)).toEqual([{ name: 'Voyage', vest_kg: null }]);
    expect(await row(b, P_OLD)).toEqual([{ name: 'Voyage', vest_kg: null }]);
  });

  it('instantané : appareil arrivé après la création reçoit le poids ; au schéma 24, gardé dans sync_unknown puis réintégré', async () => {
    for (const schema of ['i0', 'v24'] as const) {
      const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
      devices = [a];
      await setupFirst(a);
      await create(a, profile(P, { vestKg: 7.5 }));
      expect((await a.cycle()).phase).toBe('idle');
      const b = await createSimDevice(B_ID, { name: 'iPhone', schema, clock: createManualClock(a.clock.nowMs()) });
      devices = [a, b];
      let batches = 0;
      setSnapshotTestHooks({ beforeBatch: () => void (batches += 1) });
      await pair(a, b);
      await b.cycle();
      setSnapshotTestHooks({});
      expect(batches, schema).toBeGreaterThan(0);
      if (schema === 'i0') {
        expect(await row(b, P)).toEqual([{ name: 'Maison', vest_kg: 7.5 }]);
      } else {
        expect(await unknownFields(b)).toEqual(['vest_kg']);
        await b.upgradeSchema('i0');
        devices.forEach((d) => d.clock.advance(1_000));
        await b.cycle();
        expect(await row(b, P)).toEqual([{ name: 'Maison', vest_kg: 7.5 }]);
      }
      await Promise.all(devices.map((d) => d.close()));
      devices = [];
    }
  });
});
