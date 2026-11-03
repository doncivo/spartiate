import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import type { ExportData, ExportWeight } from '../../../../src/domain/exportImport/archive';
import { planImport } from '../../../../src/domain/exportImport/plan';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/** SPA-005 : l'import (D-57) entre dans la synchro comme n'importe quelle écriture ; deux bases, cycles répétés, ordre inversé. */

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function twoDevices(): Promise<[SimDevice, SimDevice]> {
  const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
  devices = [a, b];
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders(devices);
  await a.cycle();
  return [a, b];
}
async function roundTrip(order: readonly SimDevice[] = devices): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    for (const d of order) await d.cycle();
    syncFolders(devices);
  }
}
const w = (date: string, kg: number): ExportWeight => ({ id: `weight|${date}|manual`, date, kg, source: 'manual', timezone: 'Europe/Paris', healthUuid: null, measuredAt: null });
const DATA: ExportData = {
  profile: { id: 'profile|singleton', sex: 'male', birthYear: 1990, heightCm: 181, goal: null, experience: null, units: 'metric' },
  weights: [w('2026-10-05', 82.4), w('2026-10-06', 82.1)],
  settings: {},
};
async function importInto(d: SimDevice, incoming: ExportData, mode: 'merge' | 'replace'): Promise<void> {
  await d.data.transaction(async (repos) => {
    const repo = await repos.exportImport();
    await repo.applyImport(planImport(await repo.readExportData(), incoming, mode), 2026);
  });
}
const weights = (d: SimDevice) => d.driver.select('SELECT id, kg, deleted_at IS NOT NULL AS deleted FROM body_weight ORDER BY id');
const profileOf = (d: SimDevice) => d.driver.select('SELECT id, height_cm, birth_year FROM profile');

describe('import → synchro (deux bases)', () => {
  it('un import sur A arrive sur B ; cycles répétés et ordre inversé ne changent rien', async () => {
    const [a, b] = await twoDevices();
    await importInto(a, DATA, 'merge');
    await roundTrip();
    await roundTrip([b, a]);
    expect(await weights(b)).toEqual(await weights(a));
    expect(await weights(b)).toHaveLength(2);
    expect(await profileOf(b)).toEqual([{ id: 'profile|singleton', height_cm: 181, birth_year: 1990 }]);
    expect(await a.driver.select('SELECT * FROM sync_outbox')).toEqual([]);
  });

  it('un import « remplacer » publie les suppressions : B voit les lignes supprimées logiquement', async () => {
    const [a, b] = await twoDevices();
    await importInto(a, DATA, 'merge');
    await roundTrip();
    a.clock.advance(60_000);
    b.clock.advance(60_000);
    await importInto(a, { ...DATA, weights: [w('2026-10-05', 82.4)] }, 'replace');
    await roundTrip();
    expect(await weights(b)).toEqual([
      { id: 'weight|2026-10-05|manual', kg: 82.4, deleted: 0 },
      { id: 'weight|2026-10-06|manual', kg: 82.1, deleted: 1 },
    ]);
  });

  it('conflit : une valeur plus récente écrite sur B pendant que A importe garde son champ, sans doublon', async () => {
    const [a, b] = await twoDevices();
    await importInto(a, DATA, 'merge');
    await roundTrip();
    a.clock.advance(60_000);
    b.clock.advance(120_000);
    await importInto(a, { ...DATA, weights: [w('2026-10-05', 80), w('2026-10-06', 82.1)] }, 'merge');
    await (await b.data.repos.bodyWeights()).saveManual({ date: '2026-10-05' as never, kg: 79, timezone: 'Europe/Paris' }, '2026-10-30' as never);
    await roundTrip();
    expect(await weights(a)).toEqual(await weights(b));
    expect(await weights(a)).toHaveLength(2);
    expect(await weights(a)).toContainEqual({ id: 'weight|2026-10-05|manual', kg: 79, deleted: 0 });
  });
});
