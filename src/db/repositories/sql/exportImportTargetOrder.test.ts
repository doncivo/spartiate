import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** REV-01 constat 3 : la cible en vigueur (dernière décision par HLC, D-82) ne change pas après export puis import. */

const A = '60000000-0000-4000-8000-0000000000a9' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000b9' as DeviceId;
// Ordre des identifiants INVERSE de l'ordre des décisions : l'import trie par identifiant.
const FIRST = '7b5e4d3c-0000-4000-8000-0000000000ff';
const SECOND = '7b5e4d3c-0000-4000-8000-000000000001';
const LOCAL_RECENT = '7b5e4d3c-0000-4000-8000-000000000050';
const DAY = '2026-11-04' as LocalDate;
const week = '2026-11-02' as LocalDate;

const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device);
  opened.push(db);
  return db;
};
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();
const draft = (kcal: number, source: 'auto' | 'manual') => ({ weekStart: week, target: { kcal, proteinG: 150, fatG: 70, carbG: 250 }, source, accepted: true, engineVersion: source === 'auto' ? 1 : null, lowFloorConfirmed: false });

async function twoDecisions(db: TestDb): Promise<void> {
  db.clock.advance(1_000);
  await db.data.transaction(async (repos) => (await repos.nutritionTargets()).record(draft(2400, 'auto'), { id: FIRST }));
  db.clock.advance(60_000);
  await db.data.transaction(async (repos) => (await repos.nutritionTargets()).record(draft(2200, 'manual'), { id: SECOND }));
}
const viaArchive = async (data: ExportData): Promise<ExportData> => {
  const { bytes } = await buildExportArchive(data, { date: '2026-11-09T10:00:00.000Z', sv: 9 });
  return (await parseExportArchive(bytes, { currentSv: 9, currentYear: 2026 })).data;
};
const importInto = (db: TestDb, incoming: ExportData, mode: 'merge' | 'replace') =>
  db.data.transaction(async (repos) => {
    const repo = await repos.exportImport();
    await repo.applyImport(planImport(await repo.readExportData(), incoming, mode), 2026);
  });
const effectiveId = async (db: TestDb): Promise<string | undefined> => (await (await db.data.repos.nutritionTargets()).effective(DAY))?.id;

describe('REV-01 constat 3 : ordre des décisions de cible', () => {
  it('la cible en vigueur est la même après export puis import, en fusion et en remplacement', async () => {
    const source = await open(A);
    await twoDecisions(source);
    expect(await effectiveId(source)).toBe(SECOND);
    const archive = await viaArchive(await read(source));
    for (const mode of ['merge', 'replace'] as const) {
      const target = await open(B);
      await importInto(target, archive, mode);
      expect(await effectiveId(target)).toBe(SECOND);
    }
  });

  it('fusion : une ancienne décision absente d’ici ne prend pas le pas sur une décision locale plus récente', async () => {
    const source = await open(A);
    await twoDecisions(source);
    const archive = await viaArchive(await read(source));
    const target = await open(B);
    target.clock.advance(10 * 60_000);
    await target.data.transaction(async (repos) => (await repos.nutritionTargets()).record(draft(2000, 'manual'), { id: LOCAL_RECENT }));
    await importInto(target, archive, 'merge');
    expect(await effectiveId(target)).toBe(LOCAL_RECENT);
  });

  it('une archive plus ancienne, sans date de décision, reste importable', async () => {
    const source = await open(A);
    await twoDecisions(source);
    const data = await read(source);
    const stripped: ExportData = { ...data, training: { ...data.training, nutrition_target: (data.training?.nutrition_target ?? []).map((r) => ({ id: r.id, values: Object.fromEntries(Object.entries(r.values).filter(([k]) => k !== 'decided_at')) })) } };
    const target = await open(B);
    await importInto(target, await viaArchive(stripped), 'merge');
    expect((await (await target.data.repos.nutritionTargets()).list()).length).toBe(2);
  });
});
