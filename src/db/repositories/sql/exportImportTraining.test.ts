import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, parseExportArchive, TRAINING_EXPORT_TABLES, trainingTable, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** 0.2.3 (point 4) : l'export / import couvre les tables d'entraînement (routines, exercices personnalisés, séances closes et séries). */

const A = '60000000-0000-4000-8000-0000000000a7' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000b7' as DeviceId;
const u = (n: number): string => `9b3a1c2e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const R = u(1);
const D1 = u(2);
const W_CLOSED = u(100);
const W_OPEN = u(101);

const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device);
  opened.push(db);
  return db;
};

const routine = (): RoutineInput => ({
  id: R,
  name: 'Haut / Bas',
  mode: 'programme',
  days: [
    {
      id: D1,
      name: 'Haut A',
      dayOrder: 0,
      exercises: [{ id: u(4), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 }],
    },
  ],
});

/** Base avec une routine, une séance close (2 séries validées) et une séance ouverte. */
async function seeded(device: DeviceId): Promise<TestDb> {
  const db = await open(device);
  await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(routine()));
  const r = await db.data.repos.workouts();
  db.clock.advance(1_000);
  await r.start({ source: 'empty', id: W_CLOSED, name: 'Séance' });
  const w = await r.addExercise(W_CLOSED, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 8, loadKg: 60 });
  db.clock.advance(1_000);
  await db.data.transaction(async (repos) => (await repos.workouts()).close(W_CLOSED));
  db.clock.advance(1_000);
  await r.start({ source: 'empty', id: W_OPEN, name: 'En cours' });
  await r.addExercise(W_OPEN, { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 1 });
  return db;
}

const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();
async function importInto(db: TestDb, incoming: ExportData, mode: 'merge' | 'replace') {
  return db.data.transaction(async (repos) => {
    const repo = await repos.exportImport();
    const plan = planImport(await repo.readExportData(), incoming, mode);
    await repo.applyImport(plan, 2026);
    return plan;
  });
}

describe('export des tables d’entraînement (0.2.3)', () => {
  it('chaque table exportée existe au catalogue de synchro', () => {
    for (const name of TRAINING_EXPORT_TABLES) expect(trainingTable(name).name).toBe(name);
  });

  it('exporte la routine et la séance close avec ses séries ; jamais la séance ouverte ni ses séries', async () => {
    const data = await read(await seeded(A));
    expect(data.training?.routine?.map((r) => r.id)).toEqual([R]);
    expect(data.training?.routine_day?.map((r) => r.id)).toEqual([D1]);
    expect(data.training?.routine_exercise).toHaveLength(1);
    expect(data.training?.workout?.map((r) => r.id)).toEqual([W_CLOSED]);
    expect(data.training?.workout_set).toHaveLength(2);
    expect(data.training?.workout_set?.every((s) => s.values['workout_id'] === W_CLOSED)).toBe(true);
    expect(JSON.stringify(data)).not.toContain(W_OPEN);
    expect(JSON.stringify(data)).not.toMatch(/"hlc"|device_id|updated_at|rest_timer/);
  });

  it('base sans entraînement : même forme qu’avant la 0.2.3 (clé absente)', async () => {
    const data = await read(await open(A));
    expect('training' in data).toBe(false);
  });

  it('aller-retour : archive → base vide → mêmes données (hash canonique identique), séances visibles au Journal', async () => {
    const source = await read(await seeded(A));
    const archive = await buildExportArchive(source, { date: '2026-11-07T10:00:00.000Z', sv: 4 });
    const parsed = await parseExportArchive(archive.bytes, { currentSv: 4, currentYear: 2026 });
    const target = await open(B);
    await importInto(target, parsed.data, 'merge');
    const after = await read(target);
    expect(await canonicalHash(after)).toBe(await canonicalHash(source));
    const journal = await (await target.data.repos.workouts()).getClosed(W_CLOSED);
    expect(journal?.sets).toHaveLength(2);
    // Publié comme toute écriture : une entrée « * » par ligne importée.
    const queued = await target.driver.select<{ table_name: string }>("SELECT table_name FROM sync_outbox WHERE field = '*'");
    expect(new Set(queued.map((q) => q.table_name))).toEqual(new Set(['routine', 'routine_day', 'routine_exercise', 'workout', 'workout_set']));
  });

  it('fusion répétée : plan vide', async () => {
    const source = await read(await seeded(A));
    const target = await open(B);
    await importInto(target, source, 'merge');
    const again = await importInto(target, source, 'merge');
    expect(again.counts).toMatchObject({ add: 0, modify: 0, delete: 0 });
  });

  it('remplacer : une séance close absente de l’archive est supprimée ; la séance ouverte locale ne l’est jamais', async () => {
    const db = await seeded(A);
    const empty: ExportData = { profile: null, weights: [], settings: {}, training: {} };
    const plan = await importInto(db, empty, 'replace');
    expect(plan.writes.deleteTraining.map((d) => d.table)).toEqual(['workout_set', 'workout_set', 'workout', 'routine_exercise', 'routine_day', 'routine']);
    expect(await (await db.data.repos.workouts()).getClosed(W_CLOSED)).toBeNull();
    expect((await (await db.data.repos.workouts()).getOpen())?.id).toBe(W_OPEN);
  });

  it('remplacer avec une archive sans entraînement (antérieure à la 0.2.3) : rien n’est supprimé côté entraînement', async () => {
    const db = await seeded(A);
    const plan = await importInto(db, { profile: null, weights: [], settings: {} }, 'replace');
    expect(plan.writes.deleteTraining).toEqual([]);
    expect(await (await db.data.repos.workouts()).getClosed(W_CLOSED)).not.toBeNull();
  });
});

describe('validation de l’archive d’entraînement', () => {
  async function tampered(edit: (data: Record<string, unknown>) => void): Promise<Uint8Array> {
    const source = await read(await seeded(A));
    const archive = await buildExportArchive(source, { date: '2026-11-07T10:00:00.000Z', sv: 4 });
    const { readZip, buildZip } = await import('../../../domain/exportImport/zip');
    const { sha256Hex } = await import('../../../domain/exportImport/sha256');
    const entries = readZip(archive.bytes);
    const data = JSON.parse(new TextDecoder().decode(entries.find((e) => e.name === 'data.json')?.data)) as Record<string, unknown>;
    edit(data);
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const manifest = { app: 'spartiate', sv: 4, date: '2026-11-07T10:00:00.000Z', sha256: sha256Hex(bytes) };
    return buildZip([
      { name: 'data.json', data: bytes },
      { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest)) },
    ]);
  }
  const first = (rows: Record<string, unknown>[] | undefined): Record<string, unknown> => {
    const row = rows?.[0];
    if (!row) throw new Error('ligne attendue');
    return row;
  };
  const training = (d: Record<string, unknown>) => d['training'] as Record<string, Record<string, unknown>[]>;

  it('refuse une table inconnue, une série orpheline, une séance ouverte, une valeur hors catalogue', async () => {
    const parse = (bytes: Uint8Array) => parseExportArchive(bytes, { currentSv: 4, currentYear: 2026 });
    await expect(parse(await tampered((d) => (training(d)['inconnue'] = [])))).rejects.toMatchObject({ code: 'invalid-data' });
    await expect(parse(await tampered((d) => delete training(d)['workout']))).rejects.toMatchObject({ code: 'invalid-data' });
    await expect(parse(await tampered((d) => (first(training(d)['workout'])['ended_at'] = null)))).rejects.toMatchObject({ code: 'invalid-data' });
    await expect(parse(await tampered((d) => (first(training(d)['workout_set'])['set_kind'] = 'autre')))).rejects.toMatchObject({ code: 'invalid-data' });
  });
});
