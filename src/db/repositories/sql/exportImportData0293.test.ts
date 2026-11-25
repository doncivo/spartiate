import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, EXPORT_SV, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import { sha256Hex } from '../../../domain/exportImport/sha256';
import { buildZip, readZip } from '../../../domain/exportImport/zip';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * DATA-0293 (D-481, Q-13, § 11, BL-112) : export et import des colonnes de la migration 0023 (`workout_set.distance_m`, `added`, `corrected_from` ;
 * `progression_profile.config_overrides`). Une archive du schéma 22 (sans ces clés) est lue sans perte ; une archive du 23 les rend telles quelles.
 */
const A = '60000000-0000-4000-8000-0000000293a1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000293b1' as DeviceId;
const AT = '2026-11-24T10:00:00.000Z';
const W = '6b5a4c3d-0000-4000-8000-000000000001';
const S1 = '6b5a4c3d-0000-4000-8000-000000000002';
const S2 = '6b5a4c3d-0000-4000-8000-000000000003';
const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device, AT);
  opened.push(db);
  return db;
};
async function seed(db: TestDb): Promise<void> {
  const d = db.driver;
  await d.execute("INSERT INTO workout (id, name, started_at, ended_at, source, notes, created_at, updated_at, device_id, hlc) VALUES (?, 'Séance', ?, ?, 'empty', '', ?, ?, ?, ?)", [W, AT, AT, AT, AT, A, `000000000000001-0000-${A}`]);
  const set = (id: string, pos: number, extra: string) =>
    d.execute(`INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, reps, load_kg, done, created_at, updated_at, device_id, hlc, distance_m, added, corrected_from) VALUES (?, ?, 'ex', 'Exercice', ?, 'work', 8, 80, 1, ?, ?, ?, ?, ${extra})`, [id, W, pos, AT, AT, A, `000000000000001-0000-${A}`]);
  await set(S1, 0, "NULL, 0, '{\"reps\":7,\"loadKg\":80}'");
  await set(S2, 1, 'NULL, 1, NULL');
  await d.execute("INSERT INTO progression_profile (id, exercise_id, engine_version, created_at, updated_at, device_id, hlc, config_overrides) VALUES ('progression|ex', 'ex', 1, ?, ?, ?, ?, '{\"deloadLoad\":0.9}')", [AT, AT, A, `000000000000001-0000-${A}`]);
}
const importInto = (db: TestDb, data: ExportData, mode: 'merge' | 'replace') =>
  db.data.transaction(async (r) => {
    const repo = await r.exportImport();
    await repo.applyImport(planImport(await repo.readExportData(), data, mode), 2026);
  });
async function archive(db: TestDb, sv: number): Promise<ExportData> {
  const data = await (await db.data.repos.exportImport()).readExportData();
  const built = await buildExportArchive(data, { date: AT, sv });
  if (sv >= 23) return (await parseExportArchive(built.bytes, { currentSv: EXPORT_SV, currentYear: 2026 })).data;
  const json = JSON.parse(new TextDecoder().decode(readZip(built.bytes).find((e) => e.name === 'data.json')?.data)) as { training: Record<string, Record<string, unknown>[]> };
  const without = (rows: Record<string, unknown>[] | undefined, keys: readonly string[]) => (rows ?? []).map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k))));
  json.training['workout_set'] = without(json.training['workout_set'], ['distance_m', 'added', 'corrected_from']);
  json.training['progression_profile'] = without(json.training['progression_profile'], ['config_overrides']);
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  const zip = buildZip([
    { name: 'data.json', data: bytes },
    { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify({ app: 'spartiate', sv, date: AT, sha256: sha256Hex(bytes) })) },
  ]);
  return (await parseExportArchive(zip, { currentSv: EXPORT_SV, currentYear: 2026 })).data;
}
const sets = (db: TestDb) => db.driver.select('SELECT id, distance_m, added, corrected_from FROM workout_set ORDER BY id');
const overrides = (db: TestDb) => db.driver.select('SELECT config_overrides FROM progression_profile');

describe('DATA-0293 : export et import de la migration 0023', () => {
  it('archive du schéma 23 : séries ajoutées, valeur d’avant correction et surcharges reviennent telles quelles', async () => {
    expect(EXPORT_SV).toBeGreaterThanOrEqual(23);
    const a = await open(A);
    await seed(a);
    const b = await open(B);
    await importInto(b, await archive(a, EXPORT_SV), 'replace');
    expect(await sets(b)).toEqual([
      { id: S1, distance_m: null, added: 0, corrected_from: '{"reps":7,"loadKg":80}' },
      { id: S2, distance_m: null, added: 1, corrected_from: null },
    ]);
    expect(await overrides(b)).toEqual([{ config_overrides: '{"deloadLoad":0.9}' }]);
  });

  it('archive du schéma 22 (sans ces clés) : lue sans erreur ; « Remplacer » crée les lignes avec des colonnes nulles', async () => {
    const a = await open(A);
    await seed(a);
    const b = await open(B);
    await importInto(b, await archive(a, 22), 'replace');
    expect(await sets(b)).toEqual([
      { id: S1, distance_m: null, added: null, corrected_from: null },
      { id: S2, distance_m: null, added: null, corrected_from: null },
    ]);
    expect(await overrides(b)).toEqual([{ config_overrides: null }]);
  });

  it('archive du schéma 22, « Fusionner » sur une base du 23 : les valeurs locales des colonnes absentes sont gardées', async () => {
    const a = await open(A);
    await seed(a);
    const data = await archive(a, 22);
    const b = await open(B);
    await seed(b);
    await importInto(b, data, 'merge');
    expect(await sets(b)).toEqual([
      { id: S1, distance_m: null, added: 0, corrected_from: '{"reps":7,"loadKg":80}' },
      { id: S2, distance_m: null, added: 1, corrected_from: null },
    ]);
    expect(await overrides(b)).toEqual([{ config_overrides: '{"deloadLoad":0.9}' }]);
  });
});
