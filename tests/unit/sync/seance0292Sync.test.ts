import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../src/domain/clock';
import { isEligibleSet } from '../../../src/domain/training/estimate1rm';
import { materializeOutbox } from '../../../src/sync/publisher';
import { SYNC_CATALOGUE } from '../../../src/domain/sync/syncTables';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../sim/syncDevice';
import { GYM_PROFILE } from '../../fixtures/training';

/**
 * SEANCE-0292, relecture sync-icloud (D-26) : non-régression de ce que la branche change dans ce qui est publié, sans colonne nouvelle.
 * (a) série validée rouverte en séance ouverte (D-519) ; (b) saisie d'une série non validée (C-078, D-521) ; (c) saisie arrivée autour de la
 * clôture ; (d) suppression du profil de matériel actif (C-081). Deux bases simulées, catalogue de production, données synthétiques.
 */

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const u = (n: number): string => `5e920292-0000-4000-8000-${String(n).padStart(12, '0')}`;
const W1 = u(1);

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

async function roundTrip(): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}

/** Séance ouverte sur `d`, `n` séries de développé couché ; les `validated` premières validées à 60 kg × 8. */
async function openWorkout(d: SimDevice, n: number, validated: number): Promise<string[]> {
  const r = await d.data.repos.workouts();
  await r.start({ source: 'empty', id: W1, name: 'Haut A' });
  const w = await r.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: n });
  for (const s of w.sets.slice(0, validated)) await r.validateSet(s.id, { reps: 8, loadKg: 60 });
  return w.sets.map((s) => s.id);
}
const closeOn = (d: SimDevice) => d.data.transaction(async (repos) => (await repos.workouts()).close(W1));
const queued = (d: SimDevice) => d.driver.select("SELECT table_name, row_id, field FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')");
const workoutOps = async (d: SimDevice) => (await materializeOutbox(d.data.repos, SYNC_CATALOGUE, d.id, null)).ops.filter((op) => op.op.t.startsWith('workout'));

describe('(a) série validée rouverte en séance ouverte (D-519)', () => {
  it('rien en file avant la clôture ; un seul hlc à la clôture ; corrected_at reçu ; aucun conflit des deux côtés', async () => {
    const [a, b] = await twoDevices();
    const [s1, s2] = await openWorkout(b, 2, 2);
    const r = await b.data.repos.workouts();
    b.clock.advance(60_000);
    await r.unvalidateSet(s1 as string);
    b.clock.advance(60_000);
    await r.validateSet(s1 as string, { reps: 8, loadKg: 62.5 });
    expect(await queued(b)).toEqual([]);
    b.clock.advance(60_000);
    await closeOn(b);
    const ops = await workoutOps(b);
    expect(ops.map((op) => op.op.t)).toEqual(['workout', 'workout_set', 'workout_set']);
    expect(new Set(ops.map((op) => op.hlc)).size).toBe(1);
    await roundTrip();
    const sets = (await (await a.data.repos.workouts()).getClosed(W1))?.sets ?? [];
    expect(sets.find((s) => s.id === s1)).toMatchObject({ done: true, loadKg: 62.5 });
    expect(sets.find((s) => s.id === s1)?.correctedAt).not.toBeNull();
    expect(sets.find((s) => s.id === s2)?.correctedAt ?? null).toBeNull();
    for (const d of [a, b]) expect(await d.driver.select('SELECT * FROM conflict_log'), d.name).toEqual([]);
  });
});

describe('(b) saisie d’une série non validée (C-078)', () => {
  it('publiée à la clôture avec done = 0 ; l’autre appareil ne la compte ni dans le résumé, ni dans le tonnage, ni dans un record, ni dans l’e1RM', async () => {
    const [a, b] = await twoDevices();
    const [, draft] = await openWorkout(b, 2, 1);
    // Saisie plus lourde que la série validée : si elle était comptée, tonnage et record changeraient.
    await (await b.data.repos.workouts()).updateSet(draft as string, { reps: 10, loadKg: 100 });
    expect(await queued(b)).toEqual([]);
    await closeOn(b);
    await roundTrip();
    const ra = await a.data.repos.workouts();
    const set = (await ra.getClosed(W1))?.sets.find((s) => s.id === draft);
    expect(set).toMatchObject({ done: false, reps: 10, loadKg: 100 });
    if (!set) throw new Error('série absente');
    const summary = await ra.summary(W1);
    expect(summary).toMatchObject({ validatedSets: 1, validatedWorkSets: 1, plannedSets: 2, tonnageKg: 480 });
    expect(summary.records.some((rec) => rec.setId === draft)).toBe(false);
    expect(isEligibleSet({ position: set.position, setKind: set.setKind, done: set.done, reps: set.reps, loadKg: set.loadKg, rir: set.rir })).toBe(false);
  });
});

describe('(c) saisie arrivée autour de la clôture', () => {
  it('écriture après la clôture : refusée et signalée (erreur), rien en file, la valeur close reste', async () => {
    const [a, b] = await twoDevices();
    const [, draft] = await openWorkout(b, 2, 1);
    await closeOn(b);
    await b.driver.execute('DELETE FROM sync_outbox');
    await expect((await b.data.repos.workouts()).updateSet(draft as string, { reps: 12 })).rejects.toThrow();
    expect(await queued(b)).toEqual([]);
    await roundTrip();
    expect((await (await a.data.repos.workouts()).getClosed(W1))?.sets.find((s) => s.id === draft)?.reps ?? null).toBeNull();
  });

  it('écriture lancée en même temps que la clôture : soit refusée (erreur), soit publiée et reçue, jamais perdue en silence', async () => {
    const [a, b] = await twoDevices();
    const [, draft] = await openWorkout(b, 2, 1);
    const repo = await b.data.repos.workouts();
    const [write, close] = await Promise.allSettled([repo.updateSet(draft as string, { reps: 11, loadKg: 70 }), closeOn(b)]);
    expect(close.status).toBe('fulfilled');
    await roundTrip();
    const received = (await (await a.data.repos.workouts()).getClosed(W1))?.sets.find((s) => s.id === draft);
    const local = (await repo.getClosed(W1))?.sets.find((s) => s.id === draft);
    if (write.status === 'fulfilled') {
      expect(received).toMatchObject({ reps: 11, loadKg: 70, done: false });
    } else {
      expect(received?.reps ?? null).toBeNull();
    }
    expect({ reps: received?.reps, loadKg: received?.loadKg }).toEqual({ reps: local?.reps, loadKg: local?.loadKg });
  });
});

describe('(d) suppression du profil de matériel actif (C-081)', () => {
  it('supprimé sur A : sur B le profil actif devient nul ; le réglage local n’est publié par aucun des deux', async () => {
    const [a, b] = await twoDevices();
    const P = u(90);
    await (await a.data.repos.equipmentProfiles()).create({ id: P, name: 'Salle', kind: 'salle', inventory: GYM_PROFILE.inventory, increments: {} });
    await roundTrip();
    await (await b.data.repos.equipmentProfiles()).setActive(P);
    await (await a.data.repos.equipmentProfiles()).setActive(P);
    await (await a.data.repos.equipmentProfiles()).softDelete(P);
    expect(await (await a.data.repos.equipmentProfiles()).getActiveId()).toBeNull();
    await roundTrip();
    const rb = await b.data.repos.equipmentProfiles();
    expect(await rb.get(P)).toBeNull();
    expect(await rb.getActive()).toBeNull();
    for (const d of [a, b]) {
      expect(await d.driver.select("SELECT 1 FROM sync_outbox WHERE table_name = 'settings'"), d.name).toEqual([]);
      const ops = (await materializeOutbox(d.data.repos, SYNC_CATALOGUE, d.id, null)).ops;
      expect(ops.some((op) => op.op.t === 'settings'), d.name).toBe(false);
    }
  });
});
