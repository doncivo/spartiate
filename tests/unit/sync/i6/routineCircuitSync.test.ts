import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { parseJournalRecord, journalRecordToText } from '../../../../src/domain/sync/parse';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { RoutineInput } from '../../../../src/domain/training';
import type { IsoDateTime } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import vectors from '../../../fixtures/sync/vectors.json';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * I6-03b (D-26 ; § 9, § 13.8, § 20.2) : `routine_exercise.circuit_id` et `routine_exercise.circuit_rest_sec` (migration 0014) sont PUBLIÉS.
 * Périmètre : (a) catalogue (colonnes, types, conflits visibles : un « Rétablir » est capturé par le déclencheur de la 0014) ; (b) routine groupée
 * sur un appareil, reçue à l'identique par l'autre, qui démarre une séance groupée depuis elle ; (c) défaire le groupe sur l'autre appareil : la
 * modification circule champ par champ ; (d) appareil resté au schéma 13 : routine lisible, colonnes gardées dans `sync_unknown`, aucune erreur,
 * réintégrées après la migration 0014 ; (e) vecteur chiffré lu par Vitest et cargo test.
 */
const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const u = (n: number): string => `7e2d1c3a-0000-4000-8000-${String(n).padStart(12, '0')}`;
const R = u(101);
const D = u(102);
const C = u(109);

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
const ROUTINE: RoutineInput = {
  id: R,
  name: 'Haut / Bas',
  mode: 'libre',
  days: [
    {
      id: D,
      name: 'Haut A',
      dayOrder: 1,
      exercises: [
        { id: u(103), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2, repMin: 8, repMax: 10, rir: null, restSec: 90, position: 0, circuitId: C, circuitRestSec: 15 },
        { id: u(104), exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2, repMin: 8, repMax: 10, rir: null, restSec: 90, position: 1, circuitId: C, circuitRestSec: 15 },
        { id: u(105), exerciseId: 'plank', exerciseName: 'Gainage', sets: 1, repMin: 30, repMax: 60, rir: null, restSec: 60, position: 2 },
      ],
    },
  ],
};
const lines = (d: SimDevice) => d.driver.select<{ id: string; circuit_id: string | null; circuit_rest_sec: number | null }>('SELECT id, circuit_id, circuit_rest_sec FROM routine_exercise ORDER BY position');

const id = SYNC_CATALOGUE.column('routine_exercise', 'circuit_id');
const rest = SYNC_CATALOGUE.column('routine_exercise', 'circuit_rest_sec');
if (!id || !rest) throw new Error('colonnes absentes');

describe('(a) catalogue', () => {
  it('colonnes publiées après position et les deux dates : circuit_id (texte nul, 64 au plus), circuit_rest_sec (entier nul), visibles au journal des conflits', () => {
    const cols = [...publishedColumns(SYNC_CATALOGUE.table('routine_exercise') as never)];
    expect(cols.slice(-2)).toEqual(['circuit_id', 'circuit_rest_sec']);
    expect(SYNC_CATALOGUE.isValidValue(id, null)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(id, 'c1')).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(id, 'x'.repeat(65))).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(id, 5)).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(rest, 20)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(rest, null)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(rest, 'x')).toBe(false);
    expect(id.conflictVisible).toBe(true);
    expect(rest.conflictVisible).toBe(true);
  });
});

describe('(b) routine groupée : reçue à l’identique, séance groupée démarrée sur l’autre appareil', () => {
  it('le PC lit les mêmes lignes et le même groupe ; sa séance depuis la routine alterne les séries avec un groupe neuf', async () => {
    const [pc, iphone] = await pcAndIphone();
    await iphone.data.transaction(async (repos) => (await repos.trainingRoutines()).create(ROUTINE));
    await roundTrip();
    expect(await lines(pc)).toEqual(await lines(iphone));
    expect((await lines(pc)).map((l) => l.circuit_id)).toEqual([C, C, null]);
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    const w = await pc.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'routine', routineId: R, dayId: D }));
    expect(w.sets.map((s) => s.exerciseId)).toEqual(['bench-press-barbell', 'row-barbell', 'bench-press-barbell', 'row-barbell', 'plank']);
    expect(new Set(w.sets.slice(0, 4).map((s) => s.circuitId)).size).toBe(1);
    expect(w.sets[0]?.circuitId).not.toBe(C);
  });
});

describe('(c) défaire le groupe sur l’autre appareil', () => {
  it('l’effacement circule champ par champ, la ligne garde ses autres valeurs', async () => {
    const [pc, iphone] = await pcAndIphone();
    await iphone.data.transaction(async (repos) => (await repos.trainingRoutines()).create(ROUTINE));
    await roundTrip();
    await pc.data.transaction(async (repos) => {
      const repo = await repos.trainingRoutines();
      await repo.updateExercise(u(103), { circuitId: null, circuitRestSec: null });
      await repo.updateExercise(u(104), { circuitId: null, circuitRestSec: null });
    });
    await roundTrip();
    expect((await lines(iphone)).map((l) => [l.circuit_id, l.circuit_rest_sec])).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
    expect(await iphone.driver.select('SELECT sets, rest_sec FROM routine_exercise WHERE id = ?', [u(103)])).toEqual([{ sets: 2, rest_sec: 90 }]);
  });
});

describe('(d) appareil resté au schéma 13 (ADR 0011 §7.2)', () => {
  it('routine lisible ; circuit_id et circuit_rest_sec gardés dans sync_unknown puis réintégrés après la migration 0014', async () => {
    const [pc, iphone] = await pcAndIphone('v13');
    await iphone.data.transaction(async (repos) => (await repos.trainingRoutines()).create(ROUTINE));
    await roundTrip();
    expect(await pc.driver.select('SELECT COUNT(*) AS n FROM routine_exercise')).toEqual([{ n: 3 }]);
    expect(await pc.driver.select("SELECT 1 FROM pragma_table_info('routine_exercise') WHERE name = 'circuit_id'")).toEqual([]);
    const kept = await pc.driver.select<{ table_name: string; field: string }>('SELECT DISTINCT table_name, field FROM sync_unknown ORDER BY field');
    expect(kept).toEqual([
      { table_name: 'routine_exercise', field: 'circuit_id' },
      { table_name: 'routine_exercise', field: 'circuit_rest_sec' },
    ]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    // La séance démarrée sur l'appareil resté au schéma 13 : exercices libres, rien n'est perdu.
    await migrate(pc.driver, migrations);
    await reintegrateUnknownFields(pc.driver, { catalogue: SYNC_CATALOGUE, now: new Date(pc.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect((await lines(pc)).map((l) => [l.circuit_id, l.circuit_rest_sec])).toEqual([
      [C, 15],
      [C, 15],
      [null, null],
    ]);
  });
});

describe('(e) vecteur chiffré (tests/fixtures/sync/vectors.json)', () => {
  it('journal-ops-routine-exercise-circuit : opérations valides pour le catalogue, schéma 14, forme canonique stable', () => {
    const record = vectors.records.find((r) => r.name === 'journal-ops-routine-exercise-circuit');
    if (!record || !('json' in record.plaintext)) throw new Error('vecteur absent');
    expect(record.sv).toBe(14);
    const parsed = parseJournalRecord(record.plaintext.json);
    if (!parsed || parsed.k !== 'ops') throw new Error('vecteur illisible');
    expect(parsed.sv).toBe(14);
    for (const op of parsed.ops) {
      const t = SYNC_CATALOGUE.table(op.t);
      if (!t) throw new Error(op.t);
      expect(op.t).toBe('routine_exercise');
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
