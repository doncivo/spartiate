import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../src/domain/clock';
import { epochId, type DeviceAck } from '../../../src/domain/sync/format';
import { SYNC_CATALOGUE } from '../../../src/domain/sync/syncTables';
import type { DeviceId, IsoDateTime } from '../../../src/domain/types';
import { migrate } from '../../../src/db/migrator';
import { migrations } from '../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../src/db/repositories';
import { SyncPlatformError } from '../../../src/platform/sync/types';
import { currentPurgeHorizon, defaultSyncLogger, purgeDeletedRows } from '../../../src/sync';
import { buildRecords, materializeOutbox } from '../../../src/sync/publisher';
import { snapshotPages } from '../../../src/sync/snapshot';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../sim/syncDevice';
import { reassociate } from './reset/resetKit';
import { GYM_PROFILE } from '../../fixtures/training';

/**
 * I1-03 (D-26, D-27, § 9.1, § 13.4) : une séance ouverte n'est jamais publiée (journaux, instantanés, report) ; la clôture publie la séance et
 * toutes ses séries d'un bloc ; interruption et réessai, reprise, conflit, correction, suppression et trace, reset, oubli d'appareil, appareil
 * resté en schéma 3. Deux (ou trois) bases simulées, catalogue de production, fixtures synthétiques.
 */

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const u = (n: number): string => `7d2e1c3a-0000-4000-8000-${String(n).padStart(12, '0')}`;
const W1 = u(1);
const W2 = u(2);
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

/** Séance ouverte sur `d` : `n` séries de développé couché (exercice embarqué, aucune ligne `exercise`) validées à 60 kg × 8. */
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

async function snapshotText(d: SimDevice): Promise<string> {
  const out: string[] = [];
  for await (const page of snapshotPages(d.data.repos, SYNC_CATALOGUE, epochId(1, d.id), new Map<DeviceId, DeviceAck>(), 4)) out.push(...page);
  return out.join('\n');
}
const journalOps = async (d: SimDevice) => (await materializeOutbox(d.data.repos, SYNC_CATALOGUE, d.id, null)).ops;

describe('séance ouverte : jamais publiée', () => {
  it('ni dans la file, ni dans les opérations de journal, ni dans un instantané, ni chez l’autre appareil', async () => {
    const [a, b] = await twoDevices();
    const sets = await openWorkout(b, W1);
    await (await b.data.repos.workouts()).startRest({ seconds: 90 });
    await roundTrip();
    expect(await b.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);
    expect((await journalOps(b)).filter((op) => op.op.t.startsWith('workout'))).toEqual([]);
    const text = await snapshotText(b);
    for (const id of [W1, ...sets]) expect(text).not.toContain(id);
    expect(await aggregate(a, W1)).toEqual([]);
    expect(await a.driver.select('SELECT * FROM sync_parked')).toEqual([]);
  });
});

describe('clôture : agrégat complet, atomique', () => {
  it('séance et toutes ses séries en un seul hlc, un seul enregistrement ; lues sur les deux appareils, exercice embarqué sans ligne exercise', async () => {
    const [a, b] = await twoDevices();
    const sets = await openWorkout(b, W1);
    b.clock.advance(30 * 60_000);
    await closeOn(b, W1);
    const ops = (await journalOps(b)).filter((op) => op.op.t.startsWith('workout'));
    expect(ops.map((op) => op.op.t)).toEqual(['workout', 'workout_set', 'workout_set', 'workout_set']);
    expect(new Set(ops.map((op) => op.hlc)).size).toBe(1);
    expect(buildRecords(ops, 4, () => undefined)).toHaveLength(1);
    // Aucune colonne locale publiée (repos en cours).
    expect([...(ops[0]?.op.f.keys() ?? [])]).not.toContain('rest_timer_end_at');
    await roundTrip();
    const onA = await (await a.data.repos.workouts()).getClosed(W1);
    expect(onA?.sets.map((s) => s.id)).toEqual(sets);
    expect(onA?.sets.every((s) => s.exerciseId === 'bench-press-barbell' && s.exerciseName === 'Développé couché' && s.done && s.loadKg === 60)).toBe(true);
    expect(await a.driver.select('SELECT 1 FROM exercise')).toEqual([]);
    expect(await a.driver.select('SELECT * FROM sync_parked')).toEqual([]);
    expect((await (await a.data.repos.workouts()).summary(W1)).tonnageKg).toBe(1440);
    // Rien n'est republié par A (valeurs reçues).
    expect(await a.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);
  });

  it('séries validées longtemps avant la clôture, sous la tête déjà publiée : publiées quand même (tampon de la clôture)', async () => {
    const [a, b] = await twoDevices();
    await openWorkout(b, W1);
    b.clock.advance(60_000);
    await (await b.data.repos.equipmentProfiles()).create({ id: u(90), name: 'Salle', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: {} });
    await roundTrip();
    await closeOn(b, W1);
    await roundTrip();
    expect(await aggregate(a, W1)).toHaveLength(4);
  });

  it('clôture interrompue (arrêt au milieu de la transaction) : rien de publié ; réessai : une seule séance complète', async () => {
    const [a, b] = await twoDevices();
    await openWorkout(b, W1);
    await b.driver.execute("CREATE TEMP TRIGGER crash_close BEFORE UPDATE OF ended_at ON workout BEGIN SELECT RAISE(ABORT, 'arrêt simulé'); END");
    await expect(closeOn(b, W1)).rejects.toThrow();
    await roundTrip();
    expect(await aggregate(a, W1)).toEqual([]);
    expect(await b.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);
    await b.driver.execute('DROP TRIGGER crash_close');
    await closeOn(b, W1);
    expect((await closeOn(b, W1)).alreadyClosed).toBe(true);
    await roundTrip();
    expect((await aggregate(a, W1)).map((r) => r.t)).toEqual(['workout', 'workout_set', 'workout_set', 'workout_set']);
    expect(await a.driver.select('SELECT * FROM conflict_log')).toEqual([]);
  });

  it('reprise : ajout au journal refusé après la clôture, publié entier au cycle suivant, exactement une fois', async () => {
    const [a, b] = await twoDevices();
    await openWorkout(b, W1, 2);
    await closeOn(b, W1);
    const real = b.platform.appendJournal.bind(b.platform);
    let fail = true;
    (b.platform as { appendJournal: typeof real }).appendJournal = (request) => {
      if (fail) {
        fail = false;
        return Promise.reject(new SyncPlatformError('io'));
      }
      return real(request);
    };
    await b.cycle();
    syncFolders(devices);
    await a.cycle();
    expect(await aggregate(a, W1)).toEqual([]);
    await roundTrip();
    expect(await aggregate(a, W1)).toHaveLength(3);
    expect(await b.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);
  });
});

describe('séance close : correction, conflit, suppression', () => {
  it('correction sur le PC (charge, répétitions, type) : visible sur l’iPhone, traçable (corrected_at, horloge par champ)', async () => {
    const [a, b] = await twoDevices();
    const [s1] = await openWorkout(b, W1);
    await closeOn(b, W1);
    await roundTrip();
    await (await a.data.repos.workouts()).correctSet(s1 as string, { reps: 10, loadKg: 57.5, setKind: 'drop' });
    await roundTrip();
    const set = (await (await b.data.repos.workouts()).getClosed(W1))?.sets[0];
    expect(set).toMatchObject({ reps: 10, loadKg: 57.5, setKind: 'drop' });
    expect(set?.correctedAt).not.toBeNull();
    expect(await b.driver.select("SELECT field FROM sync_field_clock WHERE row_id = ? AND field IN ('reps', 'load_kg', 'set_kind') ORDER BY field", [s1 as string])).toHaveLength(3);
  });

  it('même champ corrigé des deux côtés : le plus récent gagne partout, consigné dans conflict_log des deux appareils', async () => {
    const [a, b] = await twoDevices();
    const [s1] = await openWorkout(b, W1);
    await closeOn(b, W1);
    await roundTrip();
    await (await a.data.repos.workouts()).correctSet(s1 as string, { loadKg: 62.5 });
    a.clock.advance(1_000);
    b.clock.advance(2_000);
    await (await b.data.repos.workouts()).correctSet(s1 as string, { loadKg: 65 });
    await roundTrip();
    for (const d of [a, b]) {
      expect((await (await d.data.repos.workouts()).getClosed(W1))?.sets[0]?.loadKg, d.name).toBe(65);
      expect((await d.driver.select<{ field: string }>('SELECT field FROM conflict_log')).map((c) => c.field), d.name).toContain('load_kg');
    }
  });

  it('suppression : circule, puis purge et traces ; l’instantané ne réintroduit ni la séance ni ses séries', async () => {
    const [a, b] = await twoDevices();
    const sets = await openWorkout(b, W1, 2);
    await closeOn(b, W1);
    await roundTrip();
    await b.data.transaction(async (repos) => (await repos.workouts()).deleteClosed(W1));
    await roundTrip();
    expect((await aggregate(a, W1)).every((r) => r.deleted === 1)).toBe(true);
    for (const d of devices) d.clock.advance(31 * DAY);
    await roundTrip();
    for (const d of devices) {
      const horizon = await currentPurgeHorizon(d.data.repos, d.id, d.clock.nowMs());
      await purgeDeletedRows({ data: d.data, logger: defaultSyncLogger, catalogue: SYNC_CATALOGUE }, horizon, d.clock.nowMs());
      expect(await aggregate(d, W1), d.name).toEqual([]);
      expect((await d.driver.select<{ row_id: string }>("SELECT row_id FROM sync_tombstone WHERE table_name IN ('workout', 'workout_set') ORDER BY row_id")).map((r) => r.row_id).sort(), d.name).toEqual([W1, ...sets].sort());
    }
    const text = await snapshotText(a);
    expect(text).toContain(W1);
    expect(text).not.toContain('"Développé couché"');
    const c = await createSimDevice(C_ID, { name: 'PC 2', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
    devices.push(c);
    await pair(a, c);
    await roundTrip();
    for (const d of devices) expect(await aggregate(d, W1), d.name).toEqual([]);
  });
});

describe('instantané, reset, oubli d’appareil', () => {
  it('instantané : séance close avec ses séries, séance ouverte absente ; un nouvel appareil la reçoit sans la séance ouverte', async () => {
    const [a, b] = await twoDevices();
    const closedSets = await openWorkout(b, W1, 2);
    await closeOn(b, W1);
    const openSets = await openWorkout(b, W2, 2);
    const text = await snapshotText(b);
    for (const id of [W1, ...closedSets]) expect(text).toContain(id);
    for (const id of [W2, ...openSets]) expect(text).not.toContain(id);
    await roundTrip();
    const c = await createSimDevice(C_ID, { name: 'PC 2', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
    devices.push(c);
    await pair(a, c);
    await roundTrip();
    expect(await aggregate(c, W1)).toHaveLength(3);
    expect(await aggregate(c, W2)).toEqual([]);
    expect(await aggregate(a, W2)).toEqual([]);
  });

  it('reset : la séance ouverte de l’iPhone survit, reste locale, puis part à sa clôture ; la séance close est sur les deux', async () => {
    const [a, b] = await twoDevices();
    await openWorkout(b, W1, 2);
    await closeOn(b, W1);
    await roundTrip();
    const open = await openWorkout(b, W2, 2);
    expect((await a.service.resetSync()).kind).toBe('started');
    syncFolders(devices);
    expect((await b.cycle()).phase).toBe('reset-required');
    await reassociate(a, b, devices);
    await roundTrip();
    expect(b.service.status().reset).toMatchObject({ role: 'joined' });
    expect(await aggregate(a, W1)).toHaveLength(3);
    expect(await aggregate(a, W2)).toEqual([]);
    expect((await (await b.data.repos.workouts()).getOpen())?.sets.map((s) => s.id)).toEqual(open);
    await closeOn(b, W2);
    await roundTrip();
    expect(await aggregate(a, W2)).toHaveLength(3);
  });

  it('oubli d’appareil : ce que A avait lu de B reste, la séance ouverte de B n’a jamais quitté B', async () => {
    const [a, b] = await twoDevices();
    await openWorkout(b, W1, 2);
    await closeOn(b, W1);
    await roundTrip();
    await openWorkout(b, W2, 2);
    await roundTrip();
    expect(await a.service.forgetDevice(b.id)).toEqual({ kind: 'done' });
    await roundTrip([a]);
    expect(await aggregate(a, W1)).toHaveLength(3);
    expect(await aggregate(a, W2)).toEqual([]);
    expect(await aggregate(b, W2)).toHaveLength(3);
  });
});

describe('appareil resté en schéma 3 (ADR 0011 §7.2)', () => {
  it('séances closes reçues par l’instantané puis par le journal : gardées dans sync_unknown, réintégrées après la mise à jour', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    devices = [a];
    const sets = await openWorkout(a, W1, 2);
    await closeOn(a, W1);
    await setupFirst(a);
    await a.cycle();
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'v3', clock: createManualClock(a.clock.nowMs()) });
    devices.push(b);
    await pair(a, b);
    await b.cycle();
    const kept = await b.driver.select<{ table_name: string; row_id: string }>('SELECT DISTINCT table_name, row_id FROM sync_unknown ORDER BY table_name, row_id');
    expect(kept).toEqual([{ table_name: 'workout', row_id: W1 }, ...[...sets].sort().map((id) => ({ table_name: 'workout_set', row_id: id }))]);
    await openWorkout(a, W2, 1);
    await closeOn(a, W2);
    await roundTrip();
    expect(await b.driver.select("SELECT DISTINCT row_id FROM sync_unknown WHERE table_name = 'workout' ORDER BY row_id")).toEqual([{ row_id: W1 }, { row_id: W2 }]);
    // Mise à jour de l'app sur B : migration 0004, puis réintégration des champs gardés.
    await migrate(b.driver, migrations);
    await reintegrateUnknownFields(b.driver, { catalogue: SYNC_CATALOGUE, now: new Date(b.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await aggregate(b, W1)).toHaveLength(3);
    expect(await aggregate(b, W2)).toHaveLength(2);
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
  });
});
