import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import { buildZip, readZip } from '../../../domain/exportImport/zip';
import { sha256Hex } from '../../../domain/exportImport/sha256';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-03 (§ 21, schéma 13) : l'archive d'export porte `workout_set.circuit_id` et `workout_set.circuit_rest_sec`. Une archive de schéma 12 (séries sans ces
 * clés) s'importe : colonnes lues comme nulles. Valeur hors bornes : archive refusée.
 */
const A = '60000000-0000-4000-8000-0000000000e1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000e2' as DeviceId;
const W = '7e2d1c3a-0000-4000-8000-000000000001';
const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device);
  opened.push(db);
  return db;
};
async function withCircuit(device: DeviceId): Promise<TestDb> {
  const db = await open(device);
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: W, name: 'Superset' });
  await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2 });
  await r.addExercise(W, { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2 });
  const grouped = await db.data.transaction(async (repos) => (await repos.workouts()).groupExercises(W, { exerciseIds: ['bench-press-barbell', 'row-barbell'], restBetweenSec: 10, restRoundSec: 75 }));
  for (const s of grouped.sets) await r.validateSet(s.id, { reps: 8, loadKg: 50 });
  db.clock.advance(1_000);
  await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
  return db;
}
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();
async function importInto(db: TestDb, incoming: ExportData): Promise<void> {
  await db.data.transaction(async (repos) => {
    const repo = await repos.exportImport();
    await repo.applyImport(planImport(await repo.readExportData(), incoming, 'merge'), 2026);
  });
}
async function rewritten(data: ExportData, sv: number, edit: (training: Record<string, Record<string, unknown>[]>) => void): Promise<Uint8Array> {
  const archive = await buildExportArchive(data, { date: '2026-11-12T10:00:00.000Z', sv });
  const entries = readZip(archive.bytes);
  const json = JSON.parse(new TextDecoder().decode(entries.find((e) => e.name === 'data.json')?.data)) as { training: Record<string, Record<string, unknown>[]> };
  edit(json.training);
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  const manifest = { app: 'spartiate', sv, date: '2026-11-12T10:00:00.000Z', sha256: sha256Hex(bytes) };
  return buildZip([
    { name: 'data.json', data: bytes },
    { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest)) },
  ]);
}
const firstSet = (t: Record<string, Record<string, unknown>[]>): Record<string, unknown> => {
  const row = t['workout_set']?.[0];
  if (!row) throw new Error('série attendue');
  return row;
};
const parse = (bytes: Uint8Array) => parseExportArchive(bytes, { currentSv: EXPORT_SV, currentYear: 2026 });

describe('export / import des groupes de circuit (I6-03)', () => {
  it('schéma 13 puis 14 (I6-03b) ; l’export porte le groupe et le repos du groupe sur chaque série', async () => {
    expect(EXPORT_SV).toBe(16); // I6-05 : schéma 16 (compléments publiés).
    const data = await read(await withCircuit(A));
    const sets = data.training?.workout_set ?? [];
    expect(sets).toHaveLength(4);
    expect(new Set(sets.map((s) => s.values['circuit_id'])).size).toBe(1);
    expect(sets.every((s) => s.values['circuit_rest_sec'] === 10 && typeof s.values['circuit_id'] === 'string')).toBe(true);
  });

  it('aller-retour : base vierge, import, export : même hash canonique, groupes identiques', async () => {
    const source = await read(await withCircuit(A));
    const target = await open(B);
    await importInto(target, (await parse((await buildExportArchive(source, { date: '2026-11-12T10:00:00.000Z', sv: 13 })).bytes)).data);
    const again = await read(target);
    expect(await canonicalHash(again)).toBe(await canonicalHash(source));
    expect((await (await target.data.repos.workouts()).getClosed(W))?.sets.map((s) => [s.exerciseId, s.circuitRestSec])).toEqual([
      ['bench-press-barbell', 10],
      ['row-barbell', 10],
      ['bench-press-barbell', 10],
      ['row-barbell', 10],
    ]);
  });

  it('archive de schéma 12 : séries sans les deux clés, acceptée, groupe nul', async () => {
    const source = await read(await withCircuit(A));
    const parsed = await parse(
      await rewritten(source, 12, (t) => {
        for (const row of t['workout_set'] ?? []) {
          delete row['circuit_id'];
          delete row['circuit_rest_sec'];
        }
      }),
    );
    expect(parsed.data.training?.workout_set?.every((s) => s.values['circuit_id'] === null && s.values['circuit_rest_sec'] === null)).toBe(true);
    const target = await open(B);
    await importInto(target, parsed.data);
    expect((await (await target.data.repos.workouts()).getClosed(W))?.sets).toHaveLength(4);
  });

  describe('FIX-0171 constat 1 : colonne absente d’une archive ancienne ≠ valeur nulle explicite', () => {
    const v12 = (source: ExportData, edit: (t: Record<string, Record<string, unknown>[]>) => void = () => undefined) =>
      rewritten(source, 12, (t) => {
        for (const row of t['workout_set'] ?? []) {
          delete row['circuit_id'];
          delete row['circuit_rest_sec'];
        }
        edit(t);
      });
    const sets = (db: TestDb) => db.driver.select<{ id: string; reps: number; circuit_id: string | null; circuit_rest_sec: number | null }>(`SELECT id, reps, circuit_id, circuit_rest_sec FROM workout_set WHERE workout_id = '${W}' ORDER BY position`);
    async function importMode(db: TestDb, incoming: ExportData, mode: 'merge' | 'replace') {
      return db.data.transaction(async (repos) => {
        const repo = await repos.exportImport();
        const plan = planImport(await repo.readExportData(), incoming, mode);
        await repo.applyImport(plan, 2026);
        return plan;
      });
    }

    for (const mode of ['merge', 'replace'] as const) {
      it(`${mode} : archive v12 de la même séance déjà groupée en v13 : aucune écriture, groupe et repos conservés`, async () => {
        const db = await withCircuit(A);
        const before = await sets(db);
        const plan = await importMode(db, (await parse(await v12(await read(db)))).data, mode);
        expect(plan.counts).toMatchObject({ add: 0, modify: 0, delete: 0 });
        expect(await sets(db)).toEqual(before);
        expect(before.every((s) => typeof s.circuit_id === 'string' && s.circuit_rest_sec === 10)).toBe(true);
      });

      it(`${mode} : archive v12 qui corrige une autre colonne : correction écrite, groupe et repos locaux gardés`, async () => {
        const db = await withCircuit(A);
        const before = await sets(db);
        const plan = await importMode(db, (await parse(await v12(await read(db), (t) => (firstSet(t)['reps'] = 12)))).data, mode);
        expect(plan.counts.modify).toBe(1);
        const after = await sets(db);
        expect(after.map((s) => [s.circuit_id, s.circuit_rest_sec])).toEqual(before.map((s) => [s.circuit_id, s.circuit_rest_sec]));
        expect(after.filter((s) => s.reps === 12)).toHaveLength(1);
      });

      it(`${mode} : archive v13 avec groupe explicitement nul : l’effacement est appliqué`, async () => {
        const db = await withCircuit(A);
        const archive = await rewritten(await read(db), 13, (t) => {
          for (const row of t['workout_set'] ?? []) {
            row['circuit_id'] = null;
            row['circuit_rest_sec'] = null;
          }
        });
        const plan = await importMode(db, (await parse(archive)).data, mode);
        expect(plan.counts.modify).toBe(4);
        expect((await sets(db)).every((s) => s.circuit_id === null && s.circuit_rest_sec === null)).toBe(true);
      });
    }
  });

  it('valeur hors bornes ou de mauvais type : archive refusée', async () => {
    const source = await read(await withCircuit(A));
    await expect(parse(await rewritten(source, 13, (t) => (firstSet(t)['circuit_rest_sec'] = -5)))).rejects.toMatchObject({ code: 'invalid-data' });
    await expect(parse(await rewritten(source, 13, (t) => (firstSet(t)['circuit_rest_sec'] = 3601)))).rejects.toMatchObject({ code: 'invalid-data' });
    await expect(parse(await rewritten(source, 13, (t) => (firstSet(t)['circuit_id'] = 12)))).rejects.toMatchObject({ code: 'invalid-data' });
    await expect(parse(await rewritten(source, 13, (t) => (firstSet(t)['circuit_id'] = '')))).rejects.toMatchObject({ code: 'invalid-data' });
  });
});
