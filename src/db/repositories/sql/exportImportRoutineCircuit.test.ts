import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, IMPORT_ZIP_LIMITS, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { buildFullExport, fullExportColumns, parseCsvText } from '../../../domain/exportImport/fullExport';
import { planImport } from '../../../domain/exportImport/plan';
import { buildZip, readZip } from '../../../domain/exportImport/zip';
import { sha256Hex } from '../../../domain/exportImport/sha256';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-03b (§ 21, schéma 14) : l'archive d'export porte `routine_exercise.circuit_id` et `routine_exercise.circuit_rest_sec` ; l'export complet aussi
 * (colonnes du CSV `routine_exercise.csv`). Une archive de schéma 13 (lignes sans ces clés) s'importe : colonnes absentes, la valeur LOCALE d'une
 * ligne existante est gardée (FIX-0171, D-120), une ligne nouvelle les reçoit nulles. Valeur hors bornes : archive refusée.
 */
const A = '60000000-0000-4000-8000-0000000000e4' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000e5' as DeviceId;
const u = (n: number): string => `7e2d1c3a-0000-4000-8000-${String(n).padStart(12, '0')}`;
const R = u(201);
const C = u(209);
const ROUTINE: RoutineInput = {
  id: R,
  name: 'Haut / Bas',
  mode: 'libre',
  days: [
    {
      id: u(202),
      name: 'Haut A',
      dayOrder: 1,
      exercises: [
        { id: u(203), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2, repMin: 8, repMax: 10, rir: null, restSec: 90, position: 0, circuitId: C, circuitRestSec: 15 },
        { id: u(204), exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2, repMin: 8, repMax: 10, rir: null, restSec: 90, position: 1, circuitId: C, circuitRestSec: 15 },
        { id: u(205), exerciseId: 'plank', exerciseName: 'Gainage', sets: 1, repMin: 30, repMax: 60, rir: null, restSec: 60, position: 2 },
      ],
    },
  ],
};
const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device, '2026-11-12T08:00:00.000Z');
  opened.push(db);
  return db;
};
async function withRoutine(device: DeviceId): Promise<TestDb> {
  const db = await open(device);
  await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(ROUTINE));
  return db;
}
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();
async function importMode(db: TestDb, incoming: ExportData, mode: 'merge' | 'replace') {
  return db.data.transaction(async (repos) => {
    const repo = await repos.exportImport();
    const plan = planImport(await repo.readExportData(), incoming, mode);
    await repo.applyImport(plan, 2026);
    return plan;
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
const parse = (bytes: Uint8Array) => parseExportArchive(bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
const withoutGroups = (t: Record<string, Record<string, unknown>[]>): void => {
  for (const row of t['routine_exercise'] ?? []) {
    delete row['circuit_id'];
    delete row['circuit_rest_sec'];
  }
};
const lines = (db: TestDb) => db.driver.select<{ id: string; sets: number; circuit_id: string | null; circuit_rest_sec: number | null }>('SELECT id, sets, circuit_id, circuit_rest_sec FROM routine_exercise ORDER BY position');
const firstLine = (t: Record<string, Record<string, unknown>[]>): Record<string, unknown> => {
  const row = t['routine_exercise']?.find((r) => r['id'] === u(203));
  if (!row) throw new Error('ligne attendue');
  return row;
};

describe('export / import des groupes de routine (I6-03b)', () => {
  it('schéma 14 ; l’export porte le groupe et le repos du groupe sur chaque ligne de routine', async () => {
    expect(EXPORT_SV).toBe(15); // FIX-0181 : schéma 15 (favoris publiés).
    const data = await read(await withRoutine(A));
    const rows = data.training?.routine_exercise ?? [];
    expect(rows.map((r) => [r.values['circuit_id'], r.values['circuit_rest_sec']])).toEqual(
      expect.arrayContaining([
        [C, 15],
        [C, 15],
        [null, null],
      ]),
    );
  });

  it('aller-retour : base vierge, import, export : même hash canonique, groupe identique', async () => {
    const source = await read(await withRoutine(A));
    const target = await open(B);
    await importMode(target, (await parse((await buildExportArchive(source, { date: '2026-11-12T10:00:00.000Z', sv: EXPORT_SV })).bytes)).data, 'merge');
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(source));
    expect((await lines(target)).map((l) => [l.circuit_id, l.circuit_rest_sec])).toEqual([
      [C, 15],
      [C, 15],
      [null, null],
    ]);
  });

  for (const mode of ['merge', 'replace'] as const) {
    it(`${mode} : archive de schéma 13 (sans les deux clés) sur une routine déjà groupée : aucune écriture, groupe gardé`, async () => {
      const db = await withRoutine(A);
      const before = await lines(db);
      const plan = await importMode(db, (await parse(await rewritten(await read(db), 13, withoutGroups))).data, mode);
      expect(plan.counts).toMatchObject({ add: 0, modify: 0, delete: 0 });
      expect(await lines(db)).toEqual(before);
    });

    it(`${mode} : archive de schéma 13 qui corrige une autre colonne : correction écrite, groupe local gardé`, async () => {
      const db = await withRoutine(A);
      const plan = await importMode(
        db,
        (
          await parse(
            await rewritten(await read(db), 13, (t) => {
              withoutGroups(t);
              firstLine(t)['sets'] = 4;
            }),
          )
        ).data,
        mode,
      );
      expect(plan.counts.modify).toBe(1);
      expect((await lines(db)).map((l) => [l.sets, l.circuit_id, l.circuit_rest_sec])).toEqual([
        [4, C, 15],
        [2, C, 15],
        [1, null, null],
      ]);
    });
  }

  it('archive de schéma 13 dans une base vierge : lignes acceptées, groupe nul', async () => {
    const source = await read(await withRoutine(A));
    const parsed = await parse(await rewritten(source, 13, withoutGroups));
    const target = await open(B);
    await importMode(target, parsed.data, 'merge');
    expect((await lines(target)).every((l) => l.circuit_id === null && l.circuit_rest_sec === null)).toBe(true);
  });

  it('valeur hors bornes ou de mauvais type : archive refusée', async () => {
    const source = await read(await withRoutine(A));
    await expect(parse(await rewritten(source, 14, (t) => (firstLine(t)['circuit_rest_sec'] = -5)))).rejects.toMatchObject({ code: 'invalid-data' });
    await expect(parse(await rewritten(source, 14, (t) => (firstLine(t)['circuit_rest_sec'] = 3601)))).rejects.toMatchObject({ code: 'invalid-data' });
    await expect(parse(await rewritten(source, 14, (t) => (firstLine(t)['circuit_id'] = 12)))).rejects.toMatchObject({ code: 'invalid-data' });
    await expect(parse(await rewritten(source, 14, (t) => (firstLine(t)['circuit_id'] = '')))).rejects.toMatchObject({ code: 'invalid-data' });
  });

  it('export complet : `routine_exercise.csv` porte les deux colonnes, relues dans le fichier', async () => {
    const db = await withRoutine(A);
    expect(fullExportColumns('routine_exercise').slice(-2).map((c) => [c.name, c.type, c.unit, c.nullable])).toEqual([
      ['circuit_id', 'text', null, true],
      ['circuit_rest_sec', 'int', 's', true],
    ]);
    const built = await buildFullExport(await read(db), { date: '2026-11-12T10:00:00.000Z', sv: EXPORT_SV, appVersion: '0.18.0' });
    const files = new Map(readZip(built.bytes, IMPORT_ZIP_LIMITS).map((e) => [e.name, new TextDecoder('utf-8', { ignoreBOM: true }).decode(e.data)]));
    const csv = parseCsvText(files.get('csv/routine_exercise.csv') ?? '');
    const head = csv[0] ?? [];
    const byId = new Map(csv.slice(1).map((r) => [r[head.indexOf('id')], [r[head.indexOf('circuit_id')], r[head.indexOf('circuit_rest_sec')]]]));
    expect(byId.get(u(203))).toEqual([C, '15']);
    expect(byId.get(u(205))).toEqual(['', '']);
  });
});
