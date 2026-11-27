import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import type { EquipmentProfileInput } from '../../../../src/domain/training';
import { setEquipmentJsonTestHooks } from '../../../../src/db/parse/equipmentJson';
import { setSnapshotTestHooks } from '../../../../src/sync/snapshot';
import { HOME_PROFILE } from '../../../fixtures/training';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/**
 * EQUIP-0302, relecture sync-icloud (bloquant, D-796) : une app antérieure au schéma 25 lit vide un inventaire de plus de 64 matériels ; son
 * éditeur renverrait un inventaire complet construit depuis ce vide, et l'écrasement partirait sans conflit. Règles : (a) tant qu'un appareil actif
 * publie un `sv` < 25, l'écrivain à jour n'enregistre aucune liste au-delà de 64 ; (b) un inventaire ou des incréments stockés illisibles ne sont
 * jamais remplacés par une modification, même avec un inventaire fourni. L'ancienne borne de lecture (64) est simulée par le crochet du banc
 * `setEquipmentJsonTestHooks`, posé seulement pendant les écritures de l'appareil ancien. Données synthétiques.
 */
const A_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbf302';
const B_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaf302';
const P = '5c1d0e2f-0000-4000-8000-00000000f302';
const catalogue = (JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../../content/exercises/equipment.json'), 'utf8')) as { equipment: { id: string }[] }).equipment.map((e) => e.id);
const LONG = catalogue.slice(0, 65);
const profile = (available: readonly string[]): EquipmentProfileInput => ({ id: P, name: 'Salle', kind: 'salle', inventory: { ...HOME_PROFILE.inventory, available }, increments: {} });

let devices: SimDevice[] = [];
afterEach(async () => {
  setEquipmentJsonTestHooks({});
  setSnapshotTestHooks({});
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});
async function roundTrip(times = 2): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}
const repo = (d: SimDevice) => d.data.repos.equipmentProfiles();
const available = async (d: SimDevice): Promise<string[]> => {
  const rows = await d.driver.select<{ inventory: string }>('SELECT inventory FROM equipment_profile WHERE id = ?', [P]);
  return rows[0] ? (JSON.parse(rows[0].inventory) as { available: string[] }).available : [];
};

describe('EQUIP-0302 (D-796) : appareil resté au schéma 24', () => {
  it('(a) appareil au 24 actif : l’écrivain au 25 refuse d’enregistrer 65 matériels (64 passent) ; après sa mise à jour, 65 passent', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'v24', clock: createManualClock(a.clock.nowMs()) });
    devices = [a, b];
    await setupFirst(a);
    await a.cycle();
    await pair(a, b);
    await b.cycle();
    syncFolders(devices);
    await a.cycle();
    await roundTrip();
    expect(await (await repo(a)).longListsBlocked()).toBe(true);
    await expect((await repo(a)).create(profile(LONG))).rejects.toMatchObject({ code: 'invalid' });
    expect(await a.driver.select('SELECT 1 FROM equipment_profile WHERE id = ?', [P])).toEqual([]);
    await (await repo(a)).create(profile(LONG.slice(0, 64)));
    await expect((await repo(a)).update(P, { inventory: { ...HOME_PROFILE.inventory, available: LONG } })).rejects.toMatchObject({ code: 'invalid' });
    expect(await available(a)).toHaveLength(64);
    await b.upgradeSchema('i0');
    await roundTrip(3);
    expect(await (await repo(a)).longListsBlocked()).toBe(false);
    await (await repo(a)).update(P, { inventory: { ...HOME_PROFILE.inventory, available: LONG } });
    expect(await available(a)).toHaveLength(65);
  });

  it('(b) profil de 65 matériels écrit avant l’arrivée de l’appareil au 24 : lu vide là-bas, son enregistrement est refusé, inventaire intact des deux côtés', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    devices = [a];
    await setupFirst(a);
    await (await repo(a)).create(profile(LONG));
    expect((await a.cycle()).phase).toBe('idle');
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'v24', clock: createManualClock(a.clock.nowMs()) });
    devices = [a, b];
    await pair(a, b);
    await b.cycle();
    syncFolders(devices);
    await roundTrip();
    expect(await available(b)).toEqual(LONG);
    // Ancienne borne de lecture, le temps des écritures de l'appareil ancien.
    setEquipmentJsonTestHooks({ idListMax: 64 });
    const seen = await (await repo(b)).get(P);
    expect(seen?.inventory.available).toEqual([]);
    expect(seen?.unreadable).toBe(true);
    // L'éditeur d'avant renvoie un inventaire complet construit depuis le vide lu, le gilet coché.
    await expect((await repo(b)).update(P, { inventory: { ...HOME_PROFILE.inventory, available: ['weighted-vest'] } })).rejects.toMatchObject({ code: 'invalid' });
    await expect((await repo(b)).update(P, { name: 'Salle 2' })).rejects.toMatchObject({ code: 'invalid' });
    setEquipmentJsonTestHooks({});
    await roundTrip(3);
    expect(await available(b)).toEqual(LONG);
    expect(await available(a)).toEqual(LONG);
    expect(await a.driver.select('SELECT name FROM equipment_profile WHERE id = ?', [P])).toEqual([{ name: 'Salle' }]);
  });
});
