import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, EXPORT_SV, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import { sha256Hex } from '../../../domain/exportImport/sha256';
import { buildZip, readZip } from '../../../domain/exportImport/zip';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * SESS-0302 (D-658) : export et import de `workout.paused_at` et `workout.paused_ms` (migration 0024). Une archive du schéma 23 (sans ces clés) est lue
 * avec un cumul 0 ; une archive du 24 les rend telles quelles ; « Fusionner » une archive ancienne garde le cumul local. Données synthétiques.
 */
const A = '60000000-0000-4000-8000-0000000302a1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000302b1' as DeviceId;
const AT = '2026-11-27T10:00:00.000Z';
const END = '2026-11-27T11:00:00.000Z';
const W = '6b5a4c3d-0000-4000-8000-000000000302';
const S1 = '6b5a4c3d-0000-4000-8000-000000000303';
const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device, AT);
  opened.push(db);
  return db;
};
async function seed(db: TestDb, pausedMs: number): Promise<void> {
  const d = db.driver;
  await d.execute("INSERT INTO workout (id, name, started_at, ended_at, source, notes, created_at, updated_at, device_id, hlc, paused_ms) VALUES (?, 'Séance', ?, ?, 'empty', '', ?, ?, ?, ?, ?)", [W, AT, END, AT, AT, A, `000000000000001-0000-${A}`, pausedMs]);
  await d.execute("INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, reps, load_kg, done, created_at, updated_at, device_id, hlc) VALUES (?, ?, 'ex', 'Exercice', 0, 'work', 8, 80, 1, ?, ?, ?, ?)", [S1, W, AT, AT, A, `000000000000001-0000-${A}`]);
}
const importInto = (db: TestDb, data: ExportData, mode: 'merge' | 'replace') =>
  db.data.transaction(async (r) => {
    const repo = await r.exportImport();
    await repo.applyImport(planImport(await repo.readExportData(), data, mode), 2026);
  });
async function archive(db: TestDb, sv: number): Promise<ExportData> {
  const data = await (await db.data.repos.exportImport()).readExportData();
  const built = await buildExportArchive(data, { date: AT, sv });
  if (sv >= 24) return (await parseExportArchive(built.bytes, { currentSv: EXPORT_SV, currentYear: 2026 })).data;
  const json = JSON.parse(new TextDecoder().decode(readZip(built.bytes).find((e) => e.name === 'data.json')?.data)) as { training: Record<string, Record<string, unknown>[]> };
  json.training['workout'] = (json.training['workout'] ?? []).map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'paused_at' && k !== 'paused_ms')));
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  const zip = buildZip([
    { name: 'data.json', data: bytes },
    { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify({ app: 'spartiate', sv, date: AT, sha256: sha256Hex(bytes) })) },
  ]);
  return (await parseExportArchive(zip, { currentSv: EXPORT_SV, currentYear: 2026 })).data;
}
const pause = (db: TestDb) => db.driver.select('SELECT paused_at, paused_ms FROM workout');

describe('SESS-0302 : export et import de la pause de séance', () => {
  it('schéma 24 : la version d’export suit la dernière migration ; le cumul revient tel quel', async () => {
    expect(EXPORT_SV).toBe(24);
    const a = await open(A);
    await seed(a, 120_000);
    const b = await open(B);
    await importInto(b, await archive(a, EXPORT_SV), 'replace');
    expect(await pause(b)).toEqual([{ paused_at: null, paused_ms: 120_000 }]);
  });

  it('archive du schéma 23 (sans ces clés) : lue sans erreur, cumul 0 et aucune pause en cours', async () => {
    const a = await open(A);
    await seed(a, 120_000);
    const data = await archive(a, 23);
    expect(data.training?.workout?.[0]?.values).toMatchObject({ paused_at: null, paused_ms: 0 });
    const b = await open(B);
    await importInto(b, data, 'replace');
    expect(await pause(b)).toEqual([{ paused_at: null, paused_ms: 0 }]);
  });

  it('archive du schéma 23, « Fusionner » sur une base du 24 : le cumul local est gardé', async () => {
    const a = await open(A);
    await seed(a, 0);
    const data = await archive(a, 23);
    const b = await open(B);
    await seed(b, 300_000);
    await importInto(b, data, 'merge');
    expect(await pause(b)).toEqual([{ paused_at: null, paused_ms: 300_000 }]);
  });

  it('cumul négatif dans une archive : refusée à la lecture, jamais par un échec SQL', async () => {
    const a = await open(A);
    await seed(a, 0);
    const data = await (await a.data.repos.exportImport()).readExportData();
    const built = await buildExportArchive(data, { date: AT, sv: EXPORT_SV });
    const json = JSON.parse(new TextDecoder().decode(readZip(built.bytes).find((e) => e.name === 'data.json')?.data)) as { training: Record<string, Record<string, unknown>[]> };
    json.training['workout'] = (json.training['workout'] ?? []).map((row) => ({ ...row, paused_ms: -5 }));
    const bytes = new TextEncoder().encode(JSON.stringify(json));
    const zip = buildZip([
      { name: 'data.json', data: bytes },
      { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify({ app: 'spartiate', sv: EXPORT_SV, date: AT, sha256: sha256Hex(bytes) })) },
    ]);
    await expect(parseExportArchive(zip, { currentSv: EXPORT_SV, currentYear: 2026 })).rejects.toMatchObject({ code: 'invalid-data' });
  });
});
