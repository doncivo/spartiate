import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/**
 * DATA-0293 (BL-122, D-405) : l'écrivain d'une partie gardée (`w`) est noté aussi par les chemins INSTANTANÉ (join) et reprise du moteur. A, resté au
 * schéma 18, crée un cycle (colonnes de la 0019 absentes) et publie un instantané ; la partie gardée par B (à jour) porte `sv` 18 et `w` = A, donc B dit
 * « appareil plus ancien » (jamais « ligne manquante »). Le chemin du journal est couvert par `olderWriterLimits.test.ts` (M2). Données synthétiques.
 */
const NEW_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OLD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const M1 = '5c1d0e2f-0000-4000-8000-000000000301';
const ROUTINE = '5c1d0e2f-0000-4000-8000-000000000303';
const DAY_MS = 86_400_000;

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});
const snapshotCount = (d: SimDevice): number => [...(d.folder.devices.get(d.id)?.epochs.values() ?? [])].reduce((n, e) => n + e.snapshots.size, 0);
const INSERT = `INSERT INTO mesocycle (id, routine_id, start_date, weeks, unlimited, deload_week, block_origin_week, block_origin_index, rotation_index, pauses, status, outcome, ended_on, created_at, updated_at, device_id, hlc)
  VALUES (?, ?, '2026-11-16', 5, 0, NULL, 1, 0, 0, '[]', 'active', NULL, NULL, ?, ?, ?, ?)`;
const createCycle = (a: SimDevice) => {
  const at = new Date(a.clock.nowMs()).toISOString();
  return a.driver.execute(INSERT, [M1, ROUTINE, at, at, a.id, a.hlc.now()]);
};
const parkedOf = (d: SimDevice) => d.driver.select<{ op: string }>("SELECT op FROM sync_parked WHERE reason = 'missing-row'");

describe('BL-122 : `w` noté par les chemins instantané et reprise', () => {
  it('B rejoint par l’instantané d’un appareil resté en 18 : partie gardée { sv: 18, w: A }, « appareil plus ancien »', async () => {
    const a = await createSimDevice(OLD_ID, { name: 'iPhone', schema: 'v18' });
    devices = [a];
    await setupFirst(a);
    await a.cycle();
    await createCycle(a);
    await a.cycle();
    const before = snapshotCount(a);
    a.clock.advance(8 * DAY_MS);
    await a.cycle();
    expect(snapshotCount(a)).toBeGreaterThan(before);
    const b = await createSimDevice(NEW_ID, { name: 'PC', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
    devices.push(b);
    a.clock.advance(11 * 60_000);
    b.clock.advance(11 * 60_000);
    await pair(a, b);
    await b.cycle();
    syncFolders(devices);
    await b.cycle();
    const parked = await parkedOf(b);
    expect(parked.length).toBeGreaterThan(0);
    expect(JSON.parse(parked[0]?.op ?? '{}')).toMatchObject({ sv: 18, w: a.id });
    await b.cycle();
    expect(b.service.status().warnings ?? []).toContain('older-device');
  });

  it('reprise du moteur (« resume ») depuis l’instantané : la partie gardée est de nouveau notée { sv: 18, w: A }', async () => {
    const a = await createSimDevice(OLD_ID, { name: 'iPhone', schema: 'v18' });
    const b = await createSimDevice(NEW_ID, { name: 'PC', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
    devices = [a, b];
    await setupFirst(b);
    await b.cycle();
    await pair(b, a);
    await a.cycle();
    syncFolders(devices);
    await b.cycle();
    await createCycle(a);
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    a.clock.advance(8 * DAY_MS);
    b.clock.advance(8 * DAY_MS);
    await a.cycle();
    syncFolders(devices);
    await b.cycle();
    await b.driver.execute('DELETE FROM sync_parked');
    await b.driver.execute("INSERT INTO sync_meta (key, value) VALUES ('resume', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'");
    b.clock.advance(1_000);
    await b.cycle();
    const parked = await parkedOf(b);
    expect(parked.length).toBeGreaterThan(0);
    expect(JSON.parse(parked[0]?.op ?? '{}')).toMatchObject({ sv: 18, w: a.id });
  });
});
