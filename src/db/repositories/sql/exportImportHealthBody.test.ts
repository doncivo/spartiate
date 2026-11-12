import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import { renphoDayDraft } from '../../../domain/nutrition/renphoDay';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-04 (D-113) : les mesures importées de Santé (`health_*`) et l'entrée « Renpho — total du jour » voyagent dans l'export / import comme toute ligne
 * (aucune table, aucune colonne nouvelle : schéma inchangé, EXPORT_SV inchangé) ; une ligne d'un genre importé hors bornes n'est jamais écrite.
 */
const A = '60000000-0000-4000-8000-0000000000e1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000e2' as DeviceId;
const DAY = '2026-11-08' as LocalDate;
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
const parse = async (data: ExportData) => parseExportArchive((await buildExportArchive(data, { date: '2026-11-12T10:00:00.000Z', sv: EXPORT_SV })).bytes, { currentSv: EXPORT_SV, currentYear: 2026 });

describe('export / import des données Renpho (I6-04)', () => {
  it('aller-retour : mesures `health_*` et entrée du jour identiques (hash canonique)', async () => {
    const source = await open(A);
    const measures = await source.data.repos.measurements();
    await measures.save(DAY, 'health_body_fat_pct', 18.5);
    await measures.save(DAY, 'health_fiber_g', 28);
    await measures.save(DAY, 'waist', 82);
    await (await source.data.repos.mealEntries()).create(renphoDayDraft(DAY, { kcal: 2300, proteinG: 150, fatG: 70, carbG: 260, fiberG: 28 }));
    const data = await read(source);
    expect(data.training?.measurement?.map((r) => r.id)).toEqual(['measurement|2026-11-08|health_body_fat_pct', 'measurement|2026-11-08|health_fiber_g', 'measurement|2026-11-08|waist']);
    const target = await open(B);
    const parsed = await parse(data);
    await target.data.transaction(async (repos) => {
      const repo = await repos.exportImport();
      await repo.applyImport(planImport(await repo.readExportData(), parsed.data, 'merge'), 2026);
    });
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(data));
    expect((await (await target.data.repos.mealEntries()).listByDate(DAY)).map((e) => e.foodName)).toEqual(['Renpho — total du jour']);
  });

  it('une ligne d’un genre importé hors de ses bornes est refusée à l’import', async () => {
    const source = await open(A);
    await (await source.data.repos.measurements()).save(DAY, 'health_height_cm', 178);
    const data = await read(source);
    const bad = JSON.parse(JSON.stringify(data)) as ExportData;
    const row = bad.training?.measurement?.[0];
    if (row === undefined) throw new Error('mesure absente');
    (row.values as Record<string, unknown>)['value'] = 999;
    await expect(parse(bad)).rejects.toBeDefined();
  });
});
