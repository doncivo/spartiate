import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, EXPORT_SV, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import { sha256Hex } from '../../../domain/exportImport/sha256';
import { buildZip, readZip } from '../../../domain/exportImport/zip';
import type { RoutineInput } from '../../../domain/training/types';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * PROG-01 (B7) : une archive sv 18 (avant la 0019 : ni `next_weeks`, `ramp_up`, ni `rest_kcal`, `rest_carb_g`, `training_days`) s'importe en 0.24.0,
 * en « remplacer » comme en « fusionner », sur une base vide : routine en mode programme de 5 jours avec un superset, cible nutrition, 3 compléments,
 * profil et une pesée ; aucune cible de repos. Données SYNTHÉTIQUES (aucune donnée d'Ali).
 */
const A = '60000000-0000-4000-8000-0000000000c1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000c2' as DeviceId;
const u = (n: number): string => `7c3d2e1f-0000-4000-8000-${String(n).padStart(12, '0')}`;
const day = (n: number, superset: boolean): RoutineInput['days'][number] => ({
  id: u(100 + n),
  name: `Jour ${n}`,
  dayOrder: n,
  exercises: [
    { id: u(200 + n * 10), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 4, repMin: 6, repMax: 10, rir: null, restSec: 120, position: 0, ...(superset ? { circuitId: u(900), circuitRestSec: 15 } : {}) },
    { id: u(201 + n * 10), exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 3, repMin: 8, repMax: 12, rir: null, restSec: 90, position: 1, ...(superset ? { circuitId: u(900), circuitRestSec: 15 } : {}) },
  ],
});
const ROUTINE: RoutineInput = { id: u(1), name: 'Programme test', mode: 'programme', days: [1, 2, 3, 4, 5].map((n) => day(n, n === 1)) };
const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device, '2026-11-13T08:00:00.000Z');
  opened.push(db);
  return db;
};

async function source(): Promise<TestDb> {
  const db = await open(A);
  await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(ROUTINE));
  await (await db.data.repos.nutritionTargets()).record({ weekStart: '2026-11-09' as LocalDate, target: { kcal: 2500, proteinG: 150, fatG: 70, carbG: 317 }, source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: false });
  const supplements = await db.data.repos.supplements();
  for (const name of ['Supplément A', 'Supplément B', 'Supplément C']) await supplements.create({ name, dose: 1, unit: 'g', times: ['08:00' as LocalTime], days: 127, active: true });
  await (await db.data.repos.profile()).save({ birthYear: 1990, heightCm: 180, sex: 'male' }, 2026);
  await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-12' as LocalDate, kg: 80, timezone: 'Europe/Paris' }, '2026-11-13' as LocalDate);
  return db;
}

/** Archive réécrite en sv 18 : les cinq colonnes de la 0019 retirées. */
async function archiveSv18(db: TestDb): Promise<Uint8Array> {
  const data = await (await db.data.repos.exportImport()).readExportData();
  const archive = await buildExportArchive(data, { date: '2026-11-13T10:00:00.000Z', sv: 18 });
  const json = JSON.parse(new TextDecoder().decode(readZip(archive.bytes).find((e) => e.name === 'data.json')?.data)) as { training: Record<string, Record<string, unknown>[]> };
  for (const row of json.training['mesocycle'] ?? []) for (const c of ['next_weeks', 'ramp_up']) delete row[c];
  for (const row of json.training['nutrition_target'] ?? []) for (const c of ['rest_kcal', 'rest_carb_g', 'training_days']) delete row[c];
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  const manifest = { app: 'spartiate', sv: 18, date: '2026-11-13T10:00:00.000Z', sha256: sha256Hex(bytes) };
  return buildZip([
    { name: 'data.json', data: bytes },
    { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest)) },
  ]);
}

describe('PROG-01 : import d’une archive sv 18 en 0.24.0 (B7)', () => {
  for (const mode of ['replace', 'merge'] as const) {
    it(`${mode} : base vide → routine, cible, compléments, profil et pesée présents, aucune cible de repos`, async () => {
      const bytes = await archiveSv18(await source());
      const parsed = await parseExportArchive(bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
      const incoming: ExportData = parsed.data;
      const target = await open(B);
      await target.data.transaction(async (repos) => {
        const repo = await repos.exportImport();
        await repo.applyImport(planImport(await repo.readExportData(), incoming, mode), 2026);
      });
      expect(await target.driver.select('SELECT name, mode FROM routine WHERE deleted_at IS NULL')).toEqual([{ name: 'Programme test', mode: 'programme' }]);
      expect(await target.driver.select('SELECT COUNT(*) AS n FROM routine_day WHERE deleted_at IS NULL')).toEqual([{ n: 5 }]);
      expect(await target.driver.select('SELECT COUNT(*) AS n FROM routine_exercise WHERE circuit_id IS NOT NULL AND deleted_at IS NULL')).toEqual([{ n: 2 }]);
      expect(await target.driver.select('SELECT kcal, rest_kcal, rest_carb_g, training_days FROM nutrition_target WHERE deleted_at IS NULL')).toEqual([{ kcal: 2500, rest_kcal: null, rest_carb_g: null, training_days: null }]);
      expect(await target.driver.select('SELECT COUNT(*) AS n FROM supplement WHERE deleted_at IS NULL')).toEqual([{ n: 3 }]);
      expect(await (await target.data.repos.profile()).get()).toMatchObject({ heightCm: 180 });
      expect(await target.driver.select('SELECT kg FROM body_weight WHERE deleted_at IS NULL')).toEqual([{ kg: 80 }]);
      expect((await (await target.data.repos.nutritionTargets()).list())[0]?.restPlan).toBeNull();
    });
  }
});
