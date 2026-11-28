import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import type { EquipmentProfileInput } from '../../../../src/domain/training';
import { setSnapshotTestHooks } from '../../../../src/sync/snapshot';
import { HOME_PROFILE } from '../../../fixtures/training';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/**
 * SYNC-0304 (BL-187, D-805, ADR 0011 avenant 40) : risque restant de D-796 à deux bases. Un profil de 70 matériels est enregistré alors qu'aucun
 * appareil ancien n'est connu ; un appareil au schéma 24 arrive, reçoit le profil, et son éditeur réécrit l'inventaire depuis le vide lu (écriture
 * plus récente). L'appareil à jour garde sa liste, inscrit l'écart (réversible) et republie sa valeur : l'appareil ancien converge. Après sa mise à
 * jour, sa republication (`SCHEMA_REPUBLISH[25]`) n'écrase rien. Données synthétiques.
 */
const A_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbc304';
const B_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaac304';
const P = '5c1d0e2f-0000-4000-8000-00000000c304';
const catalogue = (JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../../content/exercises/equipment.json'), 'utf8')) as { equipment: { id: string }[] }).equipment.map((e) => e.id);
const LONG = catalogue.slice(0, 70);
const profile = (available: readonly string[]): EquipmentProfileInput => ({ id: P, name: 'Salle', kind: 'salle', inventory: { ...HOME_PROFILE.inventory, available }, increments: {} });

let devices: SimDevice[] = [];
afterEach(async () => {
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
const logged = (d: SimDevice) => d.driver.select<{ field: string; discarded_value: string }>("SELECT field, discarded_value FROM conflict_log WHERE table_name = 'equipment_profile'");

describe('SYNC-0304 : liste longue gardée contre un appareil resté au schéma 24', () => {
  it('écriture du 24 refusée chez l’appareil à jour, écart inscrit, appareil ancien ramené à la liste longue ; sa mise à jour n’écrase rien', async () => {
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

    // L'éditeur d'une app antérieure renvoie un inventaire complet construit depuis le vide lu, le gilet coché (écriture au sv 24, plus récente).
    await (await repo(b)).update(P, { inventory: { ...HOME_PROFILE.inventory, available: ['weighted-vest'] } });
    expect(await available(b)).toEqual(['weighted-vest']);
    await roundTrip(3);
    expect(await available(a)).toEqual(LONG);
    const onA = await logged(a);
    expect(onA.map((r) => r.field)).toEqual(['inventory']);
    expect((JSON.parse(JSON.parse(onA[0]?.discarded_value ?? '"{}"') as string) as { available: string[] }).available).toEqual(['weighted-vest']);
    // Valeur gardée republiée : l'appareil ancien converge (aucun écrasement durable de part ni d'autre).
    expect(await available(b)).toEqual(LONG);

    await b.upgradeSchema('i0');
    await roundTrip(4);
    expect(await available(a)).toEqual(LONG);
    expect(await available(b)).toEqual(LONG);
    expect((await logged(a)).length).toBe(1);
  });

  it('appareil au 24 qui modifie un autre champ sans toucher l’inventaire : appliqué normalement', async () => {
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
    await (await repo(b)).update(P, { name: 'Salle du bas' });
    await roundTrip(3);
    expect(await a.driver.select('SELECT name FROM equipment_profile WHERE id = ?', [P])).toEqual([{ name: 'Salle du bas' }]);
    expect(await available(a)).toEqual(LONG);
    expect(await logged(a)).toEqual([]);
  });
});
