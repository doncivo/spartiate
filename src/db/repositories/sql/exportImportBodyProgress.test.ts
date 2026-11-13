import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, parseExportArchive, TABLE_SINCE_SV, TRAINING_EXPORT_TABLES, IPHONE_WRITTEN_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-02 (§ 17.1, schéma 12) : l'archive porte les MENSURATIONS (`measurement`) et les FICHES de photos (`progress_photo`), écrites par les deux appareils,
 * JAMAIS les fichiers image (`progress_photo_file`) : « photos : métadonnées seulement, export manuel ». Une archive de schéma 11 s'importe sans rien
 * supprimer, même en « remplacer » ; une archive de schéma 13 est refusée ; une ligne hors bornes n'est jamais écrite.
 */
const A = '60000000-0000-4000-8000-0000000000d1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000d2' as DeviceId;
const DAY = '2026-11-09' as LocalDate;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]);

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
const parse = async (data: ExportData, sv: number) => {
  const archive = await buildExportArchive(data, { date: '2026-11-12T10:00:00.000Z', sv });
  return parseExportArchive(archive.bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
};
const apply = async (db: TestDb, incoming: ExportData, mode: 'merge' | 'replace', sv: number) => {
  const parsed = await parse(incoming, sv);
  return db.data.transaction(async (repos) => {
    const repo = await repos.exportImport();
    const plan = planImport(await repo.readExportData(), parsed.data, mode);
    await repo.applyImport(plan, 2026);
    return plan;
  });
};
const count = async (db: TestDb, table: string): Promise<number> => Number((await db.driver.select<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL`))[0]?.n);

describe('export / import des mensurations et des fiches de photos (I6-02)', () => {
  it('tables exportées en dernier, schéma 12, écrites par les deux appareils ; le fichier n’est jamais exporté', () => {
    expect(EXPORT_SV).toBe(18); // FIX-0181 : schéma 15 (favoris publiés) ; RESET-01 : schéma 16 (data_reset, jamais exportée) ; I6-05 : schéma 17 (compléments). ; I6-06 : schéma 18 (cardio).
    expect(TRAINING_EXPORT_TABLES.slice(-6, -4)).toEqual(['measurement', 'progress_photo']); // FIX-0181 puis I6-05 : food_favorite, supplement, supplement_intake ensuite.
    expect(TABLE_SINCE_SV.measurement).toBe(12);
    expect(TABLE_SINCE_SV.progress_photo).toBe(12);
    for (const t of ['measurement', 'progress_photo']) expect((IPHONE_WRITTEN_TABLES as readonly string[]).includes(t)).toBe(false);
    expect((TRAINING_EXPORT_TABLES as readonly string[]).includes('progress_photo_file')).toBe(false);
  });

  it('aller-retour : mensurations et fiches identiques (hash canonique), aucun fichier image dans l’archive, publiées comme toute écriture', async () => {
    const source = await open(A);
    await (await source.data.repos.measurements()).save(DAY, 'waist', 82.5);
    await (await source.data.repos.measurements()).save('2026-11-01' as LocalDate, 'arm_left', 36);
    const photo = await (await source.data.repos.progressPhotos()).add(DAY, JPEG);
    const data = await read(source);
    expect(data.training?.measurement?.map((r) => [r.id, r.values['value']])).toEqual([['measurement|2026-11-01|arm_left', 36], ['measurement|2026-11-09|waist', 82.5]]);
    expect(data.training?.progress_photo?.map((r) => [r.id, r.values['file_name']])).toEqual([[photo.id, photo.fileName]]);
    const archive = await buildExportArchive(data, { date: '2026-11-12T10:00:00.000Z', sv: 12 });
    expect(Buffer.from(archive.bytes).includes(Buffer.from('/9j/'))).toBe(false);
    expect(Buffer.from(archive.bytes).includes(Buffer.from(JPEG))).toBe(false);
    const target = await open(B);
    await apply(target, data, 'merge', 12);
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(data));
    expect(await target.driver.select('SELECT table_name FROM sync_outbox GROUP BY table_name ORDER BY table_name')).toEqual([{ table_name: 'measurement' }, { table_name: 'progress_photo' }]);
    expect(await target.driver.select('SELECT 1 FROM progress_photo_file')).toEqual([]);
    expect(await (await target.data.repos.progressPhotos()).loadFile(photo.id)).toBeNull();
  });

  it('archive de schéma 11 en « remplacer » : aucune mensuration ni fiche supprimée ; archive de schéma 12 sans elles : fiches supprimées, fichier local GARDÉ (FIX-0171, D-121)', async () => {
    const db = await open(A);
    await (await db.data.repos.measurements()).save(DAY, 'waist', 80);
    const photo = await (await db.data.repos.progressPhotos()).add(DAY, JPEG);
    const plain = await read(await open(B));
    await apply(db, { ...plain, training: {} }, 'replace', 11);
    expect(await count(db, 'measurement')).toBe(1);
    expect(await count(db, 'progress_photo')).toBe(1);
    await apply(db, plain, 'replace', 12);
    expect(await count(db, 'measurement')).toBe(0);
    expect(await count(db, 'progress_photo')).toBe(0);
    // Le fichier ne s'efface que par une suppression locale confirmée : la fiche reste lisible comme « supprimée ailleurs ».
    expect(await (await db.data.repos.progressPhotos()).loadFile(photo.id)).toEqual(JPEG);
    expect((await (await db.data.repos.progressPhotos()).listDeletedWithFile()).map((p) => p.id)).toEqual([photo.id]);
  });

  it('archive de schéma 19 : refusée (future-version)', async () => {
    const db = await open(A);
    await expect(parse(await read(db), 19)).rejects.toMatchObject({ code: 'future-version' });
  });

  it('ligne hors bornes, à l’identifiant faux ou au nom de fichier avec chemin : refusée à l’import, rien n’est écrit', async () => {
    const good = await open(A);
    await (await good.data.repos.measurements()).save(DAY, 'waist', 82);
    const photo = await (await good.data.repos.progressPhotos()).add(DAY, JPEG);
    const base = await read(good);
    const withRows = (table: 'measurement' | 'progress_photo', patch: (row: { id: string; values: Record<string, string | number | null> }) => void): ExportData => {
      const rows = (base.training?.[table] ?? []).map((r) => ({ id: r.id, values: { ...r.values } }));
      for (const row of rows) patch(row);
      return { ...base, training: { ...base.training, [table]: rows } } as ExportData;
    };
    const cases: [string, ExportData][] = [
      ['value 0', withRows('measurement', (r) => (r.values['value'] = 0))],
      ['taille 300 (sous le plafond SQL, au-dessus de la borne de la zone)', withRows('measurement', (r) => (r.values['value'] = 300))],
      ['value 5000', withRows('measurement', (r) => (r.values['value'] = 5000))],
      ['value texte', withRows('measurement', (r) => (r.values['value'] = 'abc'))],
      ['id faux', withRows('measurement', (r) => (r.id = 'measurement|2026-11-10|waist'))],
      ['genre en majuscules', withRows('measurement', (r) => { r.values['kind'] = 'Waist'; r.id = 'measurement|2026-11-09|Waist'; })],
      ['chemin', withRows('progress_photo', (r) => (r.values['file_name'] = '../x.jpg'))],
      ['nom vide', withRows('progress_photo', (r) => (r.values['file_name'] = ''))],
    ];
    expect(photo.id).toBeTruthy();
    for (const [label, bad] of cases) {
      const target = await open(B);
      let refused = false;
      try {
        await apply(target, bad, 'merge', 12);
      } catch {
        refused = true;
      }
      expect(refused, label).toBe(true);
      expect(await count(target, 'measurement'), label).toBe(0);
      expect(await count(target, 'progress_photo'), label).toBe(0);
    }
  });
});
