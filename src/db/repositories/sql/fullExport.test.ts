import { afterEach, describe, expect, it } from 'vitest';
import { buildFullExport, FULL_EXPORT_TABLES, fullExportColumns, parseCsvText } from '../../../domain/exportImport/fullExport';
import { DEFAULT_THEME, EXPORT_SV, type ExportData } from '../../../domain/exportImport/archive';
import { readZip } from '../../../domain/exportImport/zip';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-03 (§ 21) : l'archive d'export complet, produite depuis une vraie base (données synthétiques, D-38), est RELUE et comparée aux tables : chaque
 * fichier CSV contient exactement les lignes non supprimées de sa table, colonne par colonne (valeurs, NULL, ordre par identifiant).
 */
const A = '60000000-0000-4000-8000-0000000000f1' as DeviceId;
const W = '7e2d1c3a-0000-4000-8000-000000000001';
let db: TestDb;
afterEach(async () => db.close());

async function seed(): Promise<void> {
  db = await openBaseDb(A, '2026-11-12T08:00:00.000Z');
  await (await db.data.repos.profile()).save({ sex: 'male', birthYear: 1990, heightCm: 181.5, goal: null, experience: null, units: 'metric' }, 2026);
  await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-10' as LocalDate, kg: 82.4, timezone: 'Europe/Paris' }, '2026-11-12' as LocalDate);
  await (await db.data.repos.measurements()).save('2026-11-09' as LocalDate, 'waist', 82.5);
  await (await db.data.repos.progressPhotos()).add('2026-11-09' as LocalDate, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]));
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: W, name: 'Superset ; « bras »' });
  await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2 });
  await r.addExercise(W, { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2 });
  const grouped = await db.data.transaction(async (repos) => (await repos.workouts()).groupExercises(W, { exerciseIds: ['bench-press-barbell', 'row-barbell'], restBetweenSec: 10, restRoundSec: 75 }));
  for (const s of grouped.sets) await r.validateSet(s.id, { reps: 8, loadKg: 52.5 });
  db.clock.advance(1_000);
  await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
}

describe('export complet relu et comparé aux tables', () => {
  it('chaque CSV = les lignes non supprimées de sa table, mêmes valeurs, NULL vide, tri par identifiant', async () => {
    await seed();
    const base = await (await db.data.repos.exportImport()).readExportData();
    const theme = await db.data.repos.settings.get('ui.theme');
    const data: ExportData = theme === DEFAULT_THEME ? base : { ...base, settings: { 'ui.theme': theme } };
    const built = await buildFullExport(data, { date: '2026-11-12T10:00:00.000Z', sv: EXPORT_SV, appVersion: '0.14.0' });
    const files = new Map(readZip(built.bytes).map((e) => [e.name, new TextDecoder('utf-8', { ignoreBOM: true }).decode(e.data)]));
    let compared = 0;
    for (const table of FULL_EXPORT_TABLES) {
      if (table === 'settings') continue;
      const columns = fullExportColumns(table).map((c) => c.name);
      const csv = parseCsvText(files.get(`csv/${table}.csv`) ?? '');
      expect(csv[0], table).toEqual(columns);
      const sql = await db.driver.select<Record<string, string | number | null>>(`SELECT ${columns.join(', ')} FROM ${table} WHERE deleted_at IS NULL ORDER BY id`);
      const expected = sql.map((row) => columns.map((c) => (row[c] === null || row[c] === undefined ? '' : String(row[c]))));
      expect(csv.slice(1), table).toEqual(expected);
      compared += expected.length;
    }
    expect(compared).toBeGreaterThanOrEqual(9);
    // Valeurs de la séance de circuit, lues dans le fichier.
    const sets = parseCsvText(files.get('csv/workout_set.csv') ?? '');
    const head = sets[0] ?? [];
    const restCol = head.indexOf('circuit_rest_sec');
    const loadCol = head.indexOf('load_kg');
    expect(sets.slice(1).map((r) => [r[loadCol], r[restCol]])).toEqual([['52.5', '10'], ['52.5', '10'], ['52.5', '10'], ['52.5', '10']]);
    // Jamais le fichier d'une photo, ni la table locale des fichiers.
    expect(files.has('csv/progress_photo_file.csv')).toBe(false);
    expect([...files.values()].join('\n')).not.toMatch(/progress_photo_file|\/9j\/|JFIF/);
  });
});
