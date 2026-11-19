import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, EXPORT_SV, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** PROG-04 (D-316, D-317) : jour de la semaine d'un jour de routine — dépôt, export sv 20, import sv 18 et 19 (rattachement par le nom). */
const A = '60000000-0000-4000-8000-0000000004a1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000004b1' as DeviceId;
const u = (n: number): string => `6b5a4c3d-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (n: number) => ({ id: u(n), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 });
const NAMES = ['Lundi — Poussée', 'Mardi — Bas du corps', 'Jeudi — Poussée', 'Vendredi — Tirage', 'Samedi — Jambes'];
const program = (weekdays: (number | null)[]): RoutineInput => ({
  id: u(1),
  name: 'Programme 5 jours',
  mode: 'programme',
  days: NAMES.map((name, i) => ({ id: u(10 + i), name, dayOrder: i + 1, weekday: weekdays[i] ?? null, exercises: [line(20 + i)] })) as RoutineInput['days'],
});
const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device, '2026-11-19T10:00:00.000Z');
  opened.push(db);
  return db;
};
const weekdays = async (db: TestDb) => (await db.driver.select<{ weekday: number | null }>('SELECT weekday FROM routine_day WHERE deleted_at IS NULL ORDER BY day_order')).map((r) => r.weekday);
const importInto = (db: TestDb, data: ExportData, mode: 'merge' | 'replace') =>
  db.data.transaction(async (r) => {
    const repo = await r.exportImport();
    await repo.applyImport(planImport(await repo.readExportData(), data, mode), 2026);
  });
async function archive(db: TestDb, sv: number): Promise<ExportData> {
  const data = await (await db.data.repos.exportImport()).readExportData();
  // Archive d'un schéma antérieur : la colonne n'existe pas encore.
  const old: ExportData = sv >= 20 ? data : { ...data, training: { ...data.training, routine_day: (data.training?.routine_day ?? []).map((r) => ({ id: r.id, values: Object.fromEntries(Object.entries(r.values).filter(([k]) => k !== 'weekday')) })) } };
  const { bytes } = await buildExportArchive(old, { date: '2026-11-19T10:05:00.000Z', sv });
  return (await parseExportArchive(bytes, { currentSv: EXPORT_SV, currentYear: 2026 })).data;
}

describe('PROG-04 : dépôt', () => {
  it('création, lecture et modification du jour de la semaine ; un doublon dans la routine est refusé', async () => {
    const db = await open(A);
    const repo = await db.data.repos.trainingRoutines();
    await db.data.transaction(async (r) => (await r.trainingRoutines()).create(program([1, 2, 4, 5, 6])));
    expect((await repo.get(u(1)))?.days.map((d) => d.weekday)).toEqual([1, 2, 4, 5, 6]);
    await db.data.transaction(async (r) => (await r.trainingRoutines()).updateDay(u(12), { weekday: 3 }));
    expect(await weekdays(db)).toEqual([1, 2, 3, 5, 6]);
    await db.data.transaction(async (r) => (await r.trainingRoutines()).updateDay(u(12), { weekday: null }));
    expect(await weekdays(db)).toEqual([1, 2, null, 5, 6]);
    await expect(db.data.transaction(async (r) => (await r.trainingRoutines()).updateDay(u(13), { weekday: 1 }))).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('PROG-04 : export et import', () => {
  it(`export sv ${String(EXPORT_SV)} (= 20) : le jour de la semaine part et revient tel quel`, async () => {
    expect(EXPORT_SV).toBe(20);
    const a = await open(A);
    await a.data.transaction(async (r) => (await r.trainingRoutines()).create(program([1, 2, 4, null, 6])));
    const b = await open(B);
    await importInto(b, await archive(a, 20), 'replace');
    expect(await weekdays(b)).toEqual([1, 2, 4, null, 6]);
  });

  for (const sv of [18, 19]) {
    it(`archive sv ${String(sv)} sans la colonne, « Remplacer » : jours « Lundi — … » à « Samedi — … » rattachés par leur nom`, async () => {
      const a = await open(A);
      await a.data.transaction(async (r) => (await r.trainingRoutines()).create(program([null, null, null, null, null])));
      const b = await open(B);
      await importInto(b, await archive(a, sv), 'replace');
      expect(await weekdays(b)).toEqual([1, 2, 4, 5, 6]);
    });
  }

  it('archive sv 19, « Fusionner » sur une routine dont un jour est déjà rattaché ici : la valeur locale est gardée', async () => {
    const a = await open(A);
    await a.data.transaction(async (r) => (await r.trainingRoutines()).create(program([null, null, null, null, null])));
    const data = await archive(a, 19);
    const b = await open(B);
    await b.data.transaction(async (r) => (await r.trainingRoutines()).create(program([3, null, null, null, null])));
    await importInto(b, data, 'merge');
    expect(await weekdays(b)).toEqual([3, 2, 4, 5, 6]);
  });
});
