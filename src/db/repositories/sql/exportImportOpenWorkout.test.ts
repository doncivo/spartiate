import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** REV-01 constat 1 (D-57, D-27, D-85) : l'archive contient la séance ouverte ; elle reste ouverte et non publiée à l'import. */

const A = '60000000-0000-4000-8000-0000000000a8' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000b8' as DeviceId;
const u = (n: number): string => `9b3a1c2e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const W_CLOSED = u(100);
const W_OPEN = u(101);
const W_LOCAL_OPEN = u(102);

const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device);
  opened.push(db);
  return db;
};

/** Séance close (1 série validée), puis séance ouverte (1 série validée, 1 série à faire). */
async function seeded(device: DeviceId): Promise<TestDb> {
  const db = await open(device);
  const r = await db.data.repos.workouts();
  db.clock.advance(1_000);
  await r.start({ source: 'empty', id: W_CLOSED, name: 'Séance' });
  const w = await r.addExercise(W_CLOSED, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 1 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 8, loadKg: 60 });
  db.clock.advance(1_000);
  await db.data.transaction(async (repos) => (await repos.workouts()).close(W_CLOSED));
  db.clock.advance(1_000);
  await r.start({ source: 'empty', id: W_OPEN, name: 'En cours' });
  const o = await r.addExercise(W_OPEN, { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2 });
  db.clock.advance(1_000);
  const first = o.sets[0];
  if (!first) throw new Error('série attendue');
  await r.validateSet(first.id, { reps: 10, loadKg: 70 });
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
const viaArchive = async (data: ExportData): Promise<ExportData> => {
  const { bytes } = await buildExportArchive(data, { date: '2026-11-09T10:00:00.000Z', sv: 9 });
  return (await parseExportArchive(bytes, { currentSv: 9, currentYear: 2026 })).data;
};
const queuedRows = async (db: TestDb, table: string): Promise<string[]> =>
  (await db.driver.select<{ row_id: string }>('SELECT row_id FROM sync_outbox WHERE table_name = ?', [table])).map((q) => q.row_id);

describe('REV-01 constat 1 : l’export contient la séance ouverte', () => {
  it('la séance ouverte et ses séries sont exportées, ended_at nul', async () => {
    const data = await read(await seeded(A));
    const workouts = data.training?.workout ?? [];
    expect(workouts.map((w) => w.id).sort()).toEqual([W_CLOSED, W_OPEN].sort());
    expect(workouts.find((w) => w.id === W_OPEN)?.values['ended_at']).toBeNull();
    expect((data.training?.workout_set ?? []).filter((s) => s.values['workout_id'] === W_OPEN)).toHaveLength(2);
  });

  it('aller-retour : la séance ouverte reste ouverte avec ses séries, rien n’est publié avant sa clôture', async () => {
    const source = await read(await seeded(A));
    const target = await open(B);
    await importInto(target, await viaArchive(source), 'merge');
    const openWorkout = await (await target.data.repos.workouts()).getOpen();
    expect(openWorkout?.id).toBe(W_OPEN);
    expect(openWorkout?.sets).toHaveLength(2);
    expect(await (await target.data.repos.workouts()).getClosed(W_CLOSED)).not.toBeNull();
    expect(await queuedRows(target, 'workout')).toEqual([W_CLOSED]);
    expect((await queuedRows(target, 'workout_set')).length).toBe(1);
    // À la clôture, la séance est publiée comme toute séance.
    await target.data.transaction(async (repos) => (await repos.workouts()).close(W_OPEN));
    expect((await queuedRows(target, 'workout')).sort()).toEqual([W_CLOSED, W_OPEN].sort());
  });

  it('D-85 : une autre séance ouverte existe déjà ; l’importée est close à son dernier instant connu, la locale reste ouverte', async () => {
    const source = await read(await seeded(A));
    const target = await open(B);
    target.clock.advance(5_000);
    await (await target.data.repos.workouts()).start({ source: 'empty', id: W_LOCAL_OPEN, name: 'Locale' });
    await importInto(target, await viaArchive(source), 'merge');
    const repo = await target.data.repos.workouts();
    expect((await repo.getOpen())?.id).toBe(W_LOCAL_OPEN);
    const imported = await repo.getClosed(W_OPEN);
    expect(imported).not.toBeNull();
    const lastDone = Math.max(...(imported?.sets ?? []).map((s) => (s.doneAt ? Date.parse(s.doneAt) : 0)));
    expect(Date.parse(imported?.endedAt ?? '')).toBe(lastDone);
    expect(await queuedRows(target, 'workout')).toContain(W_OPEN);
  });

  it('D-85 : l’importée sans aucune série validée n’est pas importée (mise de côté), la locale reste', async () => {
    const source = await read(await seeded(A));
    const incoming = await viaArchive(source);
    const noDone: ExportData = {
      ...incoming,
      training: {
        ...incoming.training,
        workout_set: (incoming.training?.workout_set ?? []).map((s) => (s.values['workout_id'] === W_OPEN ? { ...s, values: { ...s.values, done: 0, done_at: null, reps: null, load_kg: null } } : s)),
      },
    };
    const target = await open(B);
    await (await target.data.repos.workouts()).start({ source: 'empty', id: W_LOCAL_OPEN, name: 'Locale' });
    await importInto(target, noDone, 'merge');
    const repo = await target.data.repos.workouts();
    expect((await repo.getOpen())?.id).toBe(W_LOCAL_OPEN);
    expect(await repo.getClosed(W_OPEN)).toBeNull();
  });

  it('une séance déjà close localement n’est jamais rouverte par une archive plus ancienne', async () => {
    const source = await seeded(A);
    const archiveData = await viaArchive(await read(source));
    await source.data.transaction(async (repos) => (await repos.workouts()).close(W_OPEN));
    const before = await read(source);
    await importInto(source, archiveData, 'replace');
    const after = await read(source);
    expect(after.training?.workout?.find((w) => w.id === W_OPEN)?.values['ended_at']).toBe(before.training?.workout?.find((w) => w.id === W_OPEN)?.values['ended_at']);
    expect((after.training?.workout_set ?? []).filter((s) => s.values['workout_id'] === W_OPEN)).toHaveLength(2);
    expect(await (await source.data.repos.workouts()).getOpen()).toBeNull();
  });

  it('« Remplacer » ne supprime jamais la séance ouverte locale absente de l’archive', async () => {
    const db = await seeded(A);
    await importInto(db, { profile: null, weights: [], settings: {}, training: {}, archiveSv: 9 }, 'replace');
    expect((await (await db.data.repos.workouts()).getOpen())?.id).toBe(W_OPEN);
    expect((await (await db.data.repos.workouts()).getOpen())?.sets).toHaveLength(2);
  });
});

describe('REV-01 constat 1 : suites de la relecture sync-icloud', () => {
  it('(a) séance ouverte de même identifiant ici et dans l’archive : la série validée après l’export n’est pas écrasée, en fusion et en remplacement', async () => {
    for (const mode of ['merge', 'replace'] as const) {
      const db = await seeded(A);
      const archive = await viaArchive(await read(db));
      const w = await (await db.data.repos.workouts()).getOpen();
      const todo = w?.sets.find((s) => !s.done);
      if (!todo) throw new Error('série à faire attendue');
      db.clock.advance(5_000);
      await (await db.data.repos.workouts()).validateSet(todo.id, { reps: 9, loadKg: 72 });
      await importInto(db, archive, mode);
      const after = (await (await db.data.repos.workouts()).getOpen())?.sets.find((s) => s.id === todo.id);
      expect(after).toMatchObject({ done: true, reps: 9, loadKg: 72 });
    }
  });

  it('(c) séance close puis supprimée ici, ouverte dans l’archive : jamais rouverte, rien en file', async () => {
    const source = await seeded(A);
    const archive = await viaArchive(await read(source));
    const target = await open(B);
    await importInto(target, archive, 'merge');
    await target.data.transaction(async (repos) => (await repos.workouts()).close(W_OPEN));
    await target.driver.execute('UPDATE workout SET deleted_at = ? WHERE id = ?', ['2026-11-10T10:00:00.000Z', W_OPEN]);
    await target.driver.execute('DELETE FROM sync_outbox');
    await importInto(target, archive, 'merge');
    const row = (await target.driver.select<{ ended_at: string | null; deleted_at: string | null }>('SELECT ended_at, deleted_at FROM workout WHERE id = ?', [W_OPEN]))[0];
    expect(row?.ended_at).not.toBeNull();
    expect(row?.deleted_at).not.toBeNull();
    expect((await queuedRows(target, 'workout')).includes(W_OPEN)).toBe(false);
  });
});
