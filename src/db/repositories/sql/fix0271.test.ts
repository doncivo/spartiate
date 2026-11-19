import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** FIX-0271 (D-314) : cible importée et cible prévue, scénario 1a de l'AUDIT-USAGE (U-2, U-3), base synthétique. */

const A = '60000000-0000-4000-8000-0000000000a1' as DeviceId;
const X = '60000000-0000-4000-8000-0000000000c1' as DeviceId;
const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId, at: string): Promise<TestDb> => {
  const db = await openBaseDb(device, at);
  opened.push(db);
  return db;
};
const kcal = (k: number) => ({ kcal: k, proteinG: 150, fatG: 70, carbG: 250 });
const strip = (data: ExportData): ExportData => ({
  ...data,
  training: { ...data.training, nutrition_target: (data.training?.nutrition_target ?? []).map((r) => ({ id: r.id, values: Object.fromEntries(Object.entries(r.values).filter(([k]) => k !== 'decided_at')) })) },
});
async function archiveSv18(withDecidedAt = true): Promise<ExportData> {
  const x = await open(X, '2026-11-14T18:00:00.000Z');
  await x.data.transaction(async (r) => (await r.nutritionTargets()).record({ weekStart: '2026-11-16' as LocalDate, target: kcal(2450), source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: false }));
  const read = await (await x.data.repos.exportImport()).readExportData();
  const { bytes } = await buildExportArchive(withDecidedAt ? read : strip(read), { date: '2026-11-14T18:05:00.000Z', sv: 18 });
  return (await parseExportArchive(bytes, { currentSv: 19, currentYear: 2026 })).data;
}
const checkIn = (db: TestDb) =>
  db.data.transaction(async (r) => (await r.nutritionTargets()).record({ weekStart: '2026-11-09' as LocalDate, target: kcal(3177), source: 'auto', accepted: true, engineVersion: 1, lowFloorConfirmed: false }));
const importInto = (db: TestDb, data: ExportData, mode: 'merge' | 'replace') =>
  db.data.transaction(async (r) => {
    const repo = await r.exportImport();
    await repo.applyImport(planImport(await repo.readExportData(), data, mode), 2026);
  });
const inForce = async (db: TestDb, date: string) => (await (await db.data.repos.nutritionTargets()).effective(date as LocalDate))?.target.kcal;

describe('FIX-0271 : cible importée prévue pour le lundi 16/11', () => {
  for (const mode of ['replace', 'merge'] as const) {
    for (const withDecidedAt of [true, false]) {
      it(`${mode}${withDecidedAt ? '' : ', archive sans date de décision'} : check-in du 15/11 avant l’import, 3 177 le 15/11 puis 2 450 le 19/11`, async () => {
        const data = await archiveSv18(withDecidedAt);
        const a = await open(A, '2026-11-15T10:00:00.000Z');
        await checkIn(a);
        a.clock.advance(60_000);
        await importInto(a, data, mode);
        expect(await inForce(a, '2026-11-19')).toBe(2450);
        if (mode === 'merge') expect(await inForce(a, '2026-11-15')).toBe(3177);
      });
      it(`${mode}${withDecidedAt ? '' : ', archive sans date de décision'} : check-in du 15/11 après l’import, la cible prévue s’applique le 19/11`, async () => {
        const data = await archiveSv18(withDecidedAt);
        const a = await open(A, '2026-11-15T10:00:00.000Z');
        await importInto(a, data, mode);
        a.clock.advance(60_000);
        await checkIn(a);
        expect(await inForce(a, '2026-11-15')).toBe(3177);
        expect(await inForce(a, '2026-11-19')).toBe(2450);
      });
    }
  }
});
