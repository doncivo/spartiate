import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../src/domain/clock';
import { createWriteStamper } from '../../../src/domain/hlc';
import { MAX_APPEND_CALL_BYTES, epochId, type DeviceAck, type SnapshotRecord } from '../../../src/domain/sync/format';
import { parseSnapshotRecord } from '../../../src/domain/sync/parse';
import { SYNC_CATALOGUE } from '../../../src/domain/sync/syncTables';
import { WORKOUT_SETS_MAX } from '../../../src/domain/training';
import type { DeviceId, IsoDateTime } from '../../../src/domain/types';
import type { SqlDriver } from '../../../src/db/driver';
import { migrate } from '../../../src/db/migrator';
import { migrations } from '../../../src/db/migrations';
import { reintegrateUnknownFields, type Repositories } from '../../../src/db/repositories';
import { createWorkoutRepository } from '../../../src/db/repositories/sql/workoutRepository';
import { currentPurgeHorizon, defaultSyncLogger, purgeDeletedRows } from '../../../src/sync';
import type { SyncDeps } from '../../../src/sync/deps';
import { batchRecords, buildRecords, materializeOutbox } from '../../../src/sync/publisher';
import { replaceFromSnapshot, snapshotPages, type LoadedSnapshot } from '../../../src/sync/snapshot';
import { GYM_PROFILE } from '../../fixtures/training';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../sim/syncDevice';

/**
 * I1-03, relecture sync-icloud : clôture et suppression atomiques même appelées hors transaction (B1) ; instantané pris pendant une clôture
 * (aucune série orpheline exportée, et une série orpheline reçue est mise de côté par un remplacement) ; séance purgée puis mise à jour d'un
 * appareil en schéma 3 ; borne du nombre de séries d'une séance (groupe de même hlc sous 1 Mio) ; nettoyage local des séances abandonnées.
 */

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const u = (n: number): string => `7d2e1c3a-0000-4000-8000-${String(n).padStart(12, '0')}`;
const W1 = u(1);
const DAY = 86_400_000;

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

async function openWorkout(d: SimDevice, id: string, n = 3): Promise<string[]> {
  const r = await d.data.repos.workouts();
  await r.start({ source: 'empty', id, name: 'Haut A' });
  const w = await r.addExercise(id, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: n });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 8, loadKg: 60 });
  return w.sets.map((s) => s.id);
}
const closeOn = (d: SimDevice, id: string) => d.data.transaction(async (repos) => (await repos.workouts()).close(id));
const aggregate = (d: SimDevice, id: string) =>
  d.driver.select<{ t: string; id: string; deleted: number }>(
    "SELECT 'workout' AS t, id, deleted_at IS NOT NULL AS deleted FROM workout WHERE id = ? UNION ALL SELECT 'workout_set', id, deleted_at IS NOT NULL FROM workout_set WHERE workout_id = ? ORDER BY t, id",
    [id, id],
  );

/**
 * Repository de séance branché sur le driver de `d` (appel HORS transaction, comme l'exposent `repos.workouts()`), qui exécute `between`
 * juste après la première instruction correspondant à `after` : un cycle de synchro qui s'intercale entre deux instructions.
 */
function interleaved(d: SimDevice, after: RegExp, between: () => Promise<void>) {
  let fired = false;
  const driver: SqlDriver = {
    kind: d.driver.kind,
    select: (sql, params) => d.driver.select(sql, params),
    async execute(sql, params) {
      const result = await d.driver.execute(sql, params);
      if (!fired && after.test(sql)) {
        fired = true;
        await between();
      }
      return result;
    },
    transaction: (fn) => d.driver.transaction(fn),
    close: () => d.driver.close(),
  };
  return createWorkoutRepository(driver, createWriteStamper(d.clock, d.hlc));
}

describe('B1 : clôture et suppression atomiques hors transaction', () => {
  it('suppression appelée hors transaction, publication intercalée : la suppression de la séance arrive quand même', async () => {
    const [a, b] = await twoDevices();
    await openWorkout(b, W1, 2);
    await closeOn(b, W1);
    await roundTrip();
    const repo = interleaved(b, /^UPDATE workout_set SET deleted_at/, () => b.cycle().then(() => undefined));
    await repo.deleteClosed(W1);
    await roundTrip();
    expect(await aggregate(a, W1)).toEqual([
      { t: 'workout', id: W1, deleted: 1 },
      ...(await aggregate(b, W1)).filter((r) => r.t === 'workout_set').map((r) => ({ ...r, deleted: 1 })),
    ]);
  });

  it('clôture appelée hors transaction, écriture et publication intercalées : l’agrégat complet arrive', async () => {
    const [a, b] = await twoDevices();
    await openWorkout(b, W1, 2);
    const repo = interleaved(b, /^UPDATE workout_set SET updated_at/, async () => {
      b.clock.advance(1_000);
      await (await b.data.repos.equipmentProfiles()).create({ id: u(90), name: 'Salle', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: {} });
      await b.cycle();
    });
    await repo.close(W1);
    await roundTrip();
    expect(await aggregate(a, W1)).toHaveLength(3);
  });

  it('dans DataAccess.transaction : inchangé (le repository de la transaction écrit directement)', async () => {
    const [a, b] = await twoDevices();
    await openWorkout(b, W1, 1);
    expect((await closeOn(b, W1)).alreadyClosed).toBe(false);
    await b.data.transaction(async (repos) => (await repos.workouts()).deleteClosed(W1));
    await roundTrip();
    expect((await aggregate(a, W1)).every((r) => r.deleted === 1)).toBe(true);
  });
});

const depsOf = (d: SimDevice): SyncDeps => ({ catalogue: SYNC_CATALOGUE, data: d.data, platform: d.platform, hlc: d.hlc, clock: d.clock, deviceId: d.id, devicePlatform: 'windows', appVersion: '0.4.0', sv: 4, logger: d.logger });

async function texts(repos: Repositories, d: SimDevice): Promise<string[]> {
  const out: string[] = [];
  for await (const page of snapshotPages(repos, SYNC_CATALOGUE, epochId(1, d.id), new Map<DeviceId, DeviceAck>(), 4)) out.push(...page);
  return out;
}

describe('instantané pris pendant une clôture', () => {
  it('aucune série exportée sans sa séance (clôture entre la page workout et la page workout_set)', async () => {
    const [, b] = await twoDevices();
    const sets = await openWorkout(b, W1, 2);
    let closed = false;
    const sync = b.data.repos.sync;
    const repos: Repositories = {
      ...b.data.repos,
      sync: {
        ...sync,
        exportRows: async (t, after, limit) => {
          if (t.name === 'workout_set' && !closed) {
            closed = true;
            await closeOn(b, W1);
          }
          return sync.exportRows(t, after, limit);
        },
      },
    };
    const text = (await texts(repos, b)).join('\n');
    expect(closed).toBe(true);
    for (const id of sets) expect(text).not.toContain(id);
    // La clôture reste en file : elle part par le journal.
    expect((await b.driver.select("SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set'")).length).toBe(2);
  });

  it('remplacement par un instantané qui porte une série orpheline : mise de côté (missing-parent), aucun échec de clé étrangère', async () => {
    const [, b] = await twoDevices();
    const sets = await openWorkout(b, W1, 2);
    await closeOn(b, W1);
    const records = (await texts(b.data.repos, b)).map((t) => parseSnapshotRecord(t) as SnapshotRecord);
    const end = records.at(-1) as Extract<SnapshotRecord, { k: 'snap-end' }>;
    const orphan: SnapshotRecord[] = records.slice(0, -1).map((r) => (r.k === 'snap-rows' ? { ...r, rows: r.rows.filter(([t]) => t !== 'workout') } : r));
    const c = await createSimDevice(C_ID, { name: 'PC 2', schema: 'i0', clock: createManualClock(b.clock.nowMs()) });
    devices.push(c);
    const snapshot: LoadedSnapshot = { records: orphan, end };
    await expect(replaceFromSnapshot(depsOf(c), snapshot)).resolves.not.toBe('clock-ahead');
    expect(await c.driver.select('SELECT 1 FROM workout_set')).toEqual([]);
    expect((await c.driver.select<{ row_id: string }>("SELECT row_id FROM sync_parked WHERE reason = 'missing-parent' AND table_name = 'workout_set' ORDER BY row_id")).map((r) => r.row_id)).toEqual([...sets].sort());
    // Rejouable : un second remplacement ne bloque pas non plus.
    await expect(replaceFromSnapshot(depsOf(c), snapshot)).resolves.not.toBe('clock-ahead');
  });
});

describe('appareil resté en schéma 3 : séance purgée sur le schéma 4', () => {
  it('suppression reçue (gardée), purge sur A, mise à jour de B : la séance revient supprimée, jamais visible', async () => {
    const [a, b] = await twoDevices('v3');
    await openWorkout(a, W1, 2);
    await closeOn(a, W1);
    await roundTrip();
    await a.data.transaction(async (repos) => (await repos.workouts()).deleteClosed(W1));
    await roundTrip();
    for (const d of devices) d.clock.advance(31 * DAY);
    await roundTrip();
    const horizon = await currentPurgeHorizon(a.data.repos, a.id, a.clock.nowMs());
    await purgeDeletedRows({ data: a.data, logger: defaultSyncLogger, catalogue: SYNC_CATALOGUE }, horizon, a.clock.nowMs());
    expect(await aggregate(a, W1)).toEqual([]);
    await migrate(b.driver, migrations);
    await reintegrateUnknownFields(b.driver, { catalogue: SYNC_CATALOGUE, now: new Date(b.clock.nowMs()).toISOString() as IsoDateTime });
    expect((await aggregate(b, W1)).every((r) => r.deleted === 1)).toBe(true);
    expect(await (await b.data.repos.workouts()).listClosed()).toEqual([]);
  });
});

describe('borne du nombre de séries d’une séance', () => {
  it(`${String(WORKOUT_SETS_MAX)} séries au plus ; à la borne, l’agrégat clos tient en un appel d’ajout (1 Mio)`, async () => {
    const [, b] = await twoDevices();
    const r = await b.data.repos.workouts();
    await r.start({ source: 'empty', id: W1 });
    let first = '';
    for (let i = 0; i * 20 < WORKOUT_SETS_MAX; i += 1) {
      const w = await r.addExercise(W1, { exerciseId: `exercice-${String(i)}`, exerciseName: `Exercice numéro ${String(i)} au nom assez long pour peser`, sets: Math.min(20, WORKOUT_SETS_MAX - i * 20) });
      first ||= w.sets[0]?.id ?? '';
    }
    await expect(r.addSet(W1, 'exercice-0')).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.addExercise(W1, { exerciseId: 'en-trop', exerciseName: 'En trop' })).rejects.toMatchObject({ code: 'invalid' });
    await r.validateSet(first, { reps: 8, loadKg: 60 });
    await closeOn(b, W1);
    const ops = (await materializeOutbox(b.data.repos, SYNC_CATALOGUE, b.id, null)).ops.filter((op) => op.op.t.startsWith('workout'));
    expect(ops).toHaveLength(WORKOUT_SETS_MAX + 1);
    const records = buildRecords(ops, 4, () => undefined);
    expect(records.reduce((n, rec) => n + rec.bytes, 0)).toBeLessThan(MAX_APPEND_CALL_BYTES);
    const refused: string[] = [];
    expect(batchRecords(records, (h) => refused.push(h))).toHaveLength(1);
    expect(refused).toEqual([]);
  });
});

describe('séances abandonnées : nettoyage local', () => {
  it('une séance ouverte abandonnée depuis plus de 30 jours est effacée physiquement au démarrage suivant, sans rien publier', async () => {
    const [, b] = await twoDevices();
    const sets = await openWorkout(b, W1, 2);
    await (await b.data.repos.workouts()).discard(W1);
    b.clock.advance(31 * DAY);
    const recent = u(2);
    await openWorkout(b, recent, 1);
    await (await b.data.repos.workouts()).discard(recent);
    await b.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'empty', id: u(3) }));
    expect(await aggregate(b, W1)).toEqual([]);
    for (const id of sets) expect(await b.driver.select('SELECT 1 FROM workout_set WHERE id = ?', [id])).toEqual([]);
    expect(await aggregate(b, recent)).toHaveLength(2);
    expect(await b.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);
    expect(await b.driver.select('SELECT 1 FROM sync_tombstone')).toEqual([]);
  });
});
