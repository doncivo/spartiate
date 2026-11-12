import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { parseJournalRecord, journalRecordToText } from '../../../../src/domain/sync/parse';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { IsoDateTime } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import { syncFieldFr } from '../../../../src/i18n/fr.syncField';
import vectors from '../../../fixtures/sync/vectors.json';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * I6-03 (D-26 ; § 9, § 13.8, § 20.2) : `workout_set.circuit_id` et `workout_set.circuit_rest_sec` (migration 0013) sont PUBLIÉS avec la séance close.
 * Périmètre : (a) catalogue (colonnes, types, libellés) ; (b) séance de circuit close sur un appareil, reçue à l'identique par l'autre (le rejeu
 * y retrouve les groupes) ; (c) séance ouverte jamais publiée (D-27) ; (d) appareil resté au schéma 12 : séance close lisible, colonnes gardées
 * dans `sync_unknown`, aucune erreur, réintégrées après la migration 0013 ; (e) vecteur chiffré lu par Vitest et cargo test.
 */
const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const W = '7e2d1c3a-0000-4000-8000-000000000001';

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function pcAndIphone(schemaPc: SimSchema = 'i0'): Promise<[SimDevice, SimDevice]> {
  const pc = await createSimDevice(PC, { name: 'PC', schema: schemaPc });
  const iphone = await createSimDevice(IPHONE, { name: 'iPhone', schema: 'i0', devicePlatform: 'ios', clock: createManualClock(pc.clock.nowMs()) });
  devices = [pc, iphone];
  await setupFirst(pc);
  await pc.cycle();
  await pair(pc, iphone);
  await iphone.cycle();
  syncFolders(devices);
  await pc.cycle();
  return [pc, iphone];
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
async function circuitWorkout(d: SimDevice, close: boolean): Promise<void> {
  const r = await d.data.repos.workouts();
  await r.start({ source: 'empty', id: W, name: 'Superset' });
  await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2 });
  await r.addExercise(W, { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2 });
  const grouped = await d.data.transaction(async (repos) => (await repos.workouts()).groupExercises(W, { exerciseIds: ['bench-press-barbell', 'row-barbell'], restBetweenSec: 10, restRoundSec: 75 }));
  for (const s of grouped.sets) await r.validateSet(s.id, { reps: 10, loadKg: 50 });
  if (close) await d.data.transaction(async (repos) => (await repos.workouts()).close(W));
}
const groups = (d: SimDevice) => d.driver.select<{ exercise_id: string; position: number; circuit_rest_sec: number | null; same: number }>(
  `SELECT exercise_id, position, circuit_rest_sec, circuit_id = (SELECT circuit_id FROM workout_set WHERE workout_id = '${W}' ORDER BY position LIMIT 1) AS same FROM workout_set WHERE workout_id = '${W}' ORDER BY position`,
);

const id = SYNC_CATALOGUE.column('workout_set', 'circuit_id');
const rest = SYNC_CATALOGUE.column('workout_set', 'circuit_rest_sec');
if (!id || !rest) throw new Error('colonnes absentes');

describe('(a) catalogue', () => {
  it('colonnes publiées après difficulty : circuit_id (texte nul, 64 au plus), circuit_rest_sec (entier nul) ; libellés de synchro', () => {
    const cols = [...publishedColumns(SYNC_CATALOGUE.table('workout_set') as never)];
    expect(cols.slice(-3)).toEqual(['difficulty', 'circuit_id', 'circuit_rest_sec']);

    expect(SYNC_CATALOGUE.isValidValue(id, null)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(id, 'c1')).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(id, 5)).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(rest, 20)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(rest, null)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(rest, 'x')).toBe(false);
    expect(syncFieldFr.workout_set?.circuit_id).toBeTruthy();
    expect(syncFieldFr.workout_set?.circuit_rest_sec).toBeTruthy();
  });

  it('revue sync-icloud B1 : colonnes masquées du journal des conflits (aucun déclencheur ne capture un « Rétablir » sur une séance close)', () => {
    expect(id.conflictVisible).toBe(false);
    expect(rest.conflictVisible).toBe(false);
  });
});

describe('(b) séance de circuit close : reçue à l’identique', () => {
  it('l’autre appareil lit les mêmes séries, le même ordre alterné, le même groupe et le même repos', async () => {
    const [pc, iphone] = await pcAndIphone();
    await circuitWorkout(iphone, true);
    await roundTrip();
    const onPc = await groups(pc);
    expect(onPc).toEqual(await groups(iphone));
    expect(onPc.map((r) => r.exercise_id)).toEqual(['bench-press-barbell', 'row-barbell', 'bench-press-barbell', 'row-barbell']);
    expect(onPc.every((r) => r.same === 1 && r.circuit_rest_sec === 10)).toBe(true);
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    // Rejeu depuis l'autre appareil : les groupes sont retrouvés.
    const replay = await pc.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'copy', copyFromId: W }));
    expect(replay.sets.map((s) => s.exerciseId)).toEqual(onPc.map((r) => r.exercise_id));
    expect(new Set(replay.sets.map((s) => s.circuitId)).size).toBe(1);
  });
});

describe('(c) séance ouverte : jamais publiée (D-27)', () => {
  it('le groupe n’apparaît pas chez l’autre appareil avant la clôture', async () => {
    const [pc, iphone] = await pcAndIphone();
    await circuitWorkout(iphone, false);
    await roundTrip();
    expect(await pc.driver.select('SELECT 1 FROM workout_set')).toEqual([]);
  });
});

describe('(d) appareil resté au schéma 12 (ADR 0011 §7.2)', () => {
  it('séance close lisible ; circuit_id et circuit_rest_sec gardés dans sync_unknown puis réintégrés après la migration 0013', async () => {
    const [pc, iphone] = await pcAndIphone('v12');
    await circuitWorkout(iphone, true);
    await roundTrip();
    expect(await pc.driver.select('SELECT COUNT(*) AS n FROM workout_set WHERE workout_id = ?', [W])).toEqual([{ n: 4 }]);
    expect(await pc.driver.select("SELECT 1 FROM pragma_table_info('workout_set') WHERE name = 'circuit_id'")).toEqual([]);
    const kept = await pc.driver.select<{ table_name: string; field: string }>('SELECT DISTINCT table_name, field FROM sync_unknown ORDER BY field');
    expect(kept).toEqual([
      { table_name: 'workout_set', field: 'circuit_id' },
      { table_name: 'workout_set', field: 'circuit_rest_sec' },
    ]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    await migrate(pc.driver, migrations);
    await reintegrateUnknownFields(pc.driver, { catalogue: SYNC_CATALOGUE, now: new Date(pc.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect((await groups(pc)).every((r) => r.same === 1 && r.circuit_rest_sec === 10)).toBe(true);
  });
});

describe('(e) vecteur chiffré (tests/fixtures/sync/vectors.json)', () => {
  it('journal-ops-workout-set-circuit : opérations valides pour le catalogue, schéma 13, forme canonique stable', () => {
    const record = vectors.records.find((r) => r.name === 'journal-ops-workout-set-circuit');
    if (!record || !('json' in record.plaintext)) throw new Error('vecteur absent');
    expect(record.sv).toBe(13);
    const parsed = parseJournalRecord(record.plaintext.json);
    if (!parsed || parsed.k !== 'ops') throw new Error('vecteur illisible');
    expect(parsed.sv).toBe(13);
    for (const op of parsed.ops) {
      const t = SYNC_CATALOGUE.table(op.t);
      if (!t) throw new Error(op.t);
      expect(op.t).toBe('workout_set');
      expect(SYNC_CATALOGUE.isValidRowId(t, op.id)).toBe(true);
      expect([...op.f.keys()].sort()).toEqual([...publishedColumns(t)].sort());
      for (const [col, [value]] of op.f) {
        const c = SYNC_CATALOGUE.column(op.t, col);
        expect(c && SYNC_CATALOGUE.isValidValue(c, value), `${op.t}.${col}`).toBe(true);
      }
    }
    expect(journalRecordToText(parsed)).toBe(record.plaintext.json);
  });
});
