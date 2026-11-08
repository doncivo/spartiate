import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { epochId, SYNC_TABLE_ORDER, type DeviceAck } from '../../../../src/domain/sync/format';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { DEFAULT_GENERATION_CONFIG as CONFIG } from '../../../../src/domain/training/config';
import { anticipateDeload, createMesocycleSpec, mesocycleState, type MesocycleSpec } from '../../../../src/domain/training/mesocycle';
import { pauseProgram } from '../../../../src/domain/training/programPause';
import type { DeviceId, IsoDateTime } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import { snapshotPages } from '../../../../src/sync/snapshot';
import { carryKindText } from '../../../../src/features/sync/carryReportText';
import { day, ROUTINE_ID, START } from '../../../fixtures/training/mesocycle';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * I3-02 (D-26 ; § 9.1, § 20.2) : publication de `mesocycle` (UUID, sans parent : la routine est une référence logique). Deux bases simulées,
 * conflit par champ (pause sur l'iPhone, deload anticipé sur le PC), instantané d'un appareil associé après coup, appareil resté en schéma 6
 * (valeurs gardées dans `sync_unknown` puis réintégrées).
 */

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const M1 = '6e4d3c2b-0000-4000-8000-000000000001';

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function twoDevices(schemaB: SimSchema = 'i0'): Promise<[SimDevice, SimDevice]> {
  const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', schema: schemaB, clock: createManualClock(a.clock.nowMs()) });
  devices = [a, b];
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders(devices);
  await a.cycle();
  return [a, b];
}
async function roundTrip(list: readonly SimDevice[] = devices): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    for (const d of list) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(list);
  }
}
const spec = (): MesocycleSpec => {
  const s = createMesocycleSpec({ routineId: ROUTINE_ID, startDate: START, weeks: 5 }, CONFIG);
  if (s === null) throw new Error('spec');
  return s;
};
const startOn = (d: SimDevice) => d.data.transaction(async (repos) => (await repos.mesocycles()).start(spec(), { id: M1 }));
const cycleOf = async (d: SimDevice) => (await d.data.repos.mesocycles()).get(M1);

describe('catalogue de production : mesocycle (I3-02)', () => {
  it('à la fin de l’ordre, sans parent, UUID ; colonnes et listes fermées', () => {
    expect(SYNC_TABLE_ORDER.at(-1)).toBe('mesocycle');
    const t = SYNC_CATALOGUE.table('mesocycle');
    if (!t) throw new Error('mesocycle');
    expect(t.idKind).toBe('uuid');
    expect(t.parents).toEqual([]);
    expect(t.local).toEqual([]);
    const col = (name: string) => {
      const c = SYNC_CATALOGUE.column('mesocycle', name);
      if (!c) throw new Error(name);
      return c;
    };
    for (const ok of ['active', 'completed']) expect(SYNC_CATALOGUE.isValidValue(col('status'), ok)).toBe(true);
    for (const ok of ['repeat', 'regenerate', 'change', 'stopped', null]) expect(SYNC_CATALOGUE.isValidValue(col('outcome'), ok)).toBe(true);
    for (const bad of ['paused', '', 1]) expect(SYNC_CATALOGUE.isValidValue(col('status'), bad)).toBe(false);
    for (const ok of [4, 5, 6, 7]) expect(SYNC_CATALOGUE.isValidValue(col('weeks'), ok)).toBe(true);
    for (const bad of [3, 8]) expect(SYNC_CATALOGUE.isValidValue(col('weeks'), bad)).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(col('start_date'), '2026-11-02')).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('start_date'), '2026-11-02T00:00:00.000Z')).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(col('pauses'), '[]')).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('pauses'), 'pas du json')).toBe(false);
  });
});

describe('deux appareils', () => {
  it('cycle créé sur le PC, mis en pause sur l’iPhone : identique des deux côtés, figé partout', async () => {
    const [a, b] = await twoDevices();
    await startOn(a);
    await roundTrip();
    expect(await cycleOf(b)).toMatchObject({ id: M1, routineId: ROUTINE_ID, weeks: 5, status: 'active' });
    const current = await cycleOf(b);
    if (!current) throw new Error('cycle');
    const paused = pauseProgram(current, day(9));
    if (!paused) throw new Error('pause');
    await (await b.data.repos.mesocycles()).save(M1, paused);
    await roundTrip();
    for (const d of [a, b]) {
      const c = await cycleOf(d);
      if (!c) throw new Error(d.name);
      expect(mesocycleState(c, day(30), CONFIG), d.name).toMatchObject({ phase: 'paused', week: 2 });
    }
  });

  it('conflit par champ : pause sur l’iPhone et deload anticipé sur le PC, hors ligne : les deux sont gardés partout', async () => {
    const [a, b] = await twoDevices();
    await startOn(a);
    await roundTrip();
    const base = await cycleOf(a);
    if (!base) throw new Error('cycle');
    const early = anticipateDeload(base, day(10), CONFIG);
    const paused = pauseProgram(base, day(12));
    if (!early || !paused) throw new Error('patch');
    await (await a.data.repos.mesocycles()).save(M1, early);
    b.clock.advance(2_000);
    await (await b.data.repos.mesocycles()).save(M1, paused);
    await roundTrip();
    for (const d of [a, b]) expect(await cycleOf(d), d.name).toMatchObject({ deloadWeek: 2, pauses: [{ from: day(12), to: null, lightWeek: false }] });
  });
});

describe('instantané et appareil associé après coup', () => {
  it('le cycle est dans l’instantané et reçu par le nouvel appareil', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    devices = [a];
    await startOn(a);
    await setupFirst(a);
    await a.cycle();
    const pages: string[] = [];
    for await (const page of snapshotPages(a.data.repos, SYNC_CATALOGUE, epochId(1, a.id), new Map<DeviceId, DeviceAck>(), 4)) pages.push(...page);
    expect(pages.join(' ')).toContain(M1);
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
    devices.push(b);
    await pair(a, b);
    await b.cycle();
    expect(await cycleOf(b)).toMatchObject({ id: M1, startDate: START, status: 'active' });
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
  });
});

describe('appareil resté en schéma 6 (ADR 0011 §7.2)', () => {
  it('cycle reçu : gardé dans sync_unknown ; réintégré après la migration 0007', async () => {
    const [a, b] = await twoDevices('v6');
    await startOn(a);
    await roundTrip();
    expect((await b.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown')).map((r) => r.table_name)).toEqual(['mesocycle']);
    await migrate(b.driver, migrations);
    await reintegrateUnknownFields(b.driver, { catalogue: SYNC_CATALOGUE, now: new Date(b.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await b.driver.select('SELECT id, routine_id, weeks, status FROM mesocycle')).toEqual([{ id: M1, routine_id: ROUTINE_ID, weeks: 5, status: 'active' }]);
  });
});

describe('libellés de synchro', () => {
  it('report d’époque : « Cycle d’entraînement »', () => {
    expect(carryKindText('mesocycle')).toBe('Cycle d’entraînement');
  });
});
