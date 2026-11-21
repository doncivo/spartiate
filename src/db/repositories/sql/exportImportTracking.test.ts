import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, EXPORT_SV, parseExportArchive, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * SUIVIS-029c/d : notes du matin (`note_*`) et bilans VISBODY (`visbody_*`) sont des genres de `measurement` : exportés, réimportés à l'identique avec leur
 * unité, bornes vérifiées à l'import ; une archive des versions précédentes (sans ces genres) s'importe toujours. Valeurs synthétiques.
 */
const A = '60000000-0000-4000-8000-0000000000f1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000f2' as DeviceId;
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
const apply = async (db: TestDb, incoming: ExportData, sv: number) => {
  const archive = await buildExportArchive(incoming, { date: '2026-11-21T10:00:00.000Z', sv });
  const parsed = await parseExportArchive(archive.bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
  return db.data.transaction(async (repos) => {
    const repo = await repos.exportImport();
    const plan = planImport(await repo.readExportData(), parsed.data, 'merge');
    await repo.applyImport(plan, 2026);
    return plan;
  });
};

describe('export / import des notes et des bilans VISBODY', () => {
  it('aller-retour : genres, valeurs et unités identiques sur l’autre appareil', async () => {
    const source = await open(A);
    const m = await source.data.repos.measurements();
    await m.save('2026-11-20' as LocalDate, 'note_fatigue', 6);
    await m.save('2026-11-20' as LocalDate, 'visbody_weight_kg', 78.4);
    await m.save('2026-11-20' as LocalDate, 'visbody_bmr_dakcal', 165.3);
    await m.save('2026-11-20' as LocalDate, 'visbody_lean_trunk_kg', 25.1);
    const target = await open(B);
    await apply(target, await read(source), EXPORT_SV);
    const t = await target.data.repos.measurements();
    expect((await t.find('2026-11-20' as LocalDate, 'note_fatigue'))?.value).toBe(6);
    expect((await t.find('2026-11-20' as LocalDate, 'visbody_weight_kg'))?.value).toBe(78.4);
    expect((await t.find('2026-11-20' as LocalDate, 'visbody_bmr_dakcal'))?.value).toBe(165.3);
    expect((await t.find('2026-11-20' as LocalDate, 'visbody_lean_trunk_kg'))?.value).toBe(25.1);
    // Le poids VISBODY n'entre jamais dans les pesées (choix prudent, décision proposée).
    expect(await (await target.data.repos.bodyWeights()).listRecent(10)).toEqual([]);
  });

  it('archive d’une version précédente (mensurations seules) : s’importe sans rien perdre', async () => {
    const source = await open(A);
    await (await source.data.repos.measurements()).save('2026-11-01' as LocalDate, 'waist', 82);
    const target = await open(B);
    await (await target.data.repos.measurements()).save('2026-11-20' as LocalDate, 'visbody_fat_pct', 18.2);
    await apply(target, await read(source), 20);
    const t = await target.data.repos.measurements();
    expect((await t.find('2026-11-01' as LocalDate, 'waist'))?.value).toBe(82);
    expect((await t.find('2026-11-20' as LocalDate, 'visbody_fat_pct'))?.value).toBe(18.2);
  });

  it('une note hors bornes (archive modifiée) est refusée, jamais écrite', async () => {
    const source = await open(A);
    await (await source.data.repos.measurements()).save('2026-11-20' as LocalDate, 'note_sleep', 7);
    const data = await read(source);
    const rows = data.training?.measurement ?? [];
    const tampered: ExportData = { ...data, training: { ...data.training, measurement: rows.map((r) => ({ ...r, values: { ...r.values, value: 12 } })) } };
    const archive = await buildExportArchive(tampered, { date: '2026-11-21T10:00:00.000Z', sv: EXPORT_SV });
    await expect(parseExportArchive(archive.bytes, { currentSv: EXPORT_SV, currentYear: 2026 })).rejects.toBeDefined();
  });
});
