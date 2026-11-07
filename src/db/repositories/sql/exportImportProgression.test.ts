import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, parseExportArchive, TRAINING_EXPORT_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import { buildZip, readZip } from '../../../domain/exportImport/zip';
import { sha256Hex } from '../../../domain/exportImport/sha256';
import { prescribe } from '../../../domain/training/prescribe';
import type { DeviceId } from '../../../domain/types';
import { input } from '../../../../tests/fixtures/training/progression';
import { openBaseDb, type TestDb } from './testSetup';

/** I2-01 (PR 2/2, critère 14) : l'export / import porte le profil de progression, les décisions et la difficulté ; une archive 0.3.0 reste importable. */

const A = '60000000-0000-4000-8000-0000000000a8' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000b8' as DeviceId;
const u = (n: number): string => `8c4b2d1e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const W = u(1);
const D = u(2);

const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device);
  opened.push(db);
  return db;
};

async function seeded(device: DeviceId): Promise<TestDb> {
  const db = await open(device);
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: W, name: 'Séance' });
  const w = await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 10, loadKg: 60 });
  await r.setDifficulty(W, 'bench-press-barbell', 'easy');
  db.clock.advance(1_000);
  await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
  const p = await db.data.repos.progression();
  await p.saveProfile({ exerciseId: 'bench-press-barbell', estimated1rmKg: 80, confidence: 0.5, lastEasyRecalibrationAt: null, engineVersion: 1 });
  await p.recordDecision({ id: D, exerciseId: 'bench-press-barbell', workoutId: W, prescription: prescribe(input()), accepted: true, chosenLoadKg: 62.5, chosenReps: [8, 8] });
  return db;
}
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();

describe('export / import de la progression (0.3.1)', () => {
  it('tables exportées : … workout_set, progression_profile, recommendation_decision', () => {
    expect(TRAINING_EXPORT_TABLES.slice(-3)).toEqual(['workout_set', 'progression_profile', 'recommendation_decision']);
  });

  it('aller-retour : profil, décision et difficulté identiques (hash canonique), publiés comme toute écriture', async () => {
    const source = await read(await seeded(A));
    expect(source.training?.progression_profile?.map((r) => r.id)).toEqual(['progression|bench-press-barbell']);
    expect(source.training?.recommendation_decision?.map((r) => r.id)).toEqual([D]);
    expect(source.training?.workout_set?.map((r) => r.values['difficulty'])).toEqual(['easy', 'easy']);
    const archive = await buildExportArchive(source, { date: '2026-11-07T10:00:00.000Z', sv: 6 });
    const parsed = await parseExportArchive(archive.bytes, { currentSv: 6, currentYear: 2026 });
    const target = await open(B);
    await target.data.transaction(async (repos) => {
      const repo = await repos.exportImport();
      await repo.applyImport(planImport(await repo.readExportData(), parsed.data, 'merge'), 2026);
    });
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(source));
    expect((await (await target.data.repos.progression()).lastDecision('bench-press-barbell'))?.loadKg).toBe(62.5);
    const queued = await target.driver.select<{ table_name: string }>("SELECT DISTINCT table_name FROM sync_outbox WHERE field = '*' AND table_name IN ('progression_profile', 'recommendation_decision') ORDER BY table_name");
    expect(queued.map((q) => q.table_name)).toEqual(['progression_profile', 'recommendation_decision']);
  });

  it('archive 0.3.0 (schéma 5 : séries sans difficulté, ni profil ni décision) : importée, difficulté nulle', async () => {
    const source = await read(await seeded(A));
    const archive = await buildExportArchive(source, { date: '2026-11-07T10:00:00.000Z', sv: 6 });
    const data = JSON.parse(new TextDecoder().decode(readZip(archive.bytes).find((e) => e.name === 'data.json')?.data)) as { training: Record<string, Record<string, unknown>[]> };
    delete data.training['progression_profile'];
    delete data.training['recommendation_decision'];
    for (const row of data.training['workout_set'] ?? []) delete row['difficulty'];
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const manifest = { app: 'spartiate', sv: 5, date: '2026-11-07T10:00:00.000Z', sha256: sha256Hex(bytes) };
    const old = buildZip([
      { name: 'data.json', data: bytes },
      { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest)) },
    ]);
    const parsed = await parseExportArchive(old, { currentSv: 6, currentYear: 2026 });
    expect(parsed.data.training?.workout_set?.map((r) => r.values['difficulty'])).toEqual([null, null]);
    const target = await open(B);
    await target.data.transaction(async (repos) => {
      const repo = await repos.exportImport();
      await repo.applyImport(planImport(await repo.readExportData(), parsed.data, 'merge'), 2026);
    });
    expect(await target.driver.select('SELECT DISTINCT difficulty FROM workout_set')).toEqual([{ difficulty: null }]);
  });
});
