import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, parseExportArchive, TABLE_SINCE_SV, TRAINING_EXPORT_TABLES, IPHONE_WRITTEN_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-01 point C (§ 16.7, schéma 11) : l'archive porte le JOURNAL DE FACTEURS (`recovery_factor`), écrit par les DEUX appareils (donc jamais en lecture
 * seule sur le PC). Une archive de schéma 10 s'importe sans rien supprimer du journal, même en « remplacer » ; une archive de schéma 12 est refusée ;
 * une ligne dont le JSON de facteurs est illisible ou dont l'identifiant n'est pas `recovery_factor|date` n'est jamais écrite.
 */

const A = '60000000-0000-4000-8000-0000000000c1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000c2' as DeviceId;
const DAY = '2026-11-09' as LocalDate;

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
const insertFactor = async (db: TestDb, day: string, factors: string, none: number): Promise<void> => {
  await db.driver.execute(
    `INSERT INTO recovery_factor (id, date, factors, none, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, '2026-11-10T07:00:00.000Z', '2026-11-10T07:00:00.000Z', ?, ?)`,
    [`recovery_factor|${day}`, day, factors, none, A, `${String(Date.UTC(2026, 10, 10)).padStart(15, '0')}-0000-${A}`],
  );
};
const parse = async (data: ExportData, sv: number) => {
  const archive = await buildExportArchive(data, { date: '2026-11-10T10:00:00.000Z', sv });
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
const count = async (db: TestDb): Promise<number> => Number((await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM recovery_factor WHERE deleted_at IS NULL'))[0]?.n);

describe('export / import du journal de facteurs (I6-01)', () => {
  it('table exportée en dernier, schéma 11, écrite par les deux appareils', () => {
    expect(TRAINING_EXPORT_TABLES.at(-6)).toBe('recovery_factor'); // FIX-0181 puis I6-05 : food_favorite, supplement, supplement_intake en dernier.
    expect(TABLE_SINCE_SV.recovery_factor).toBe(11);
    expect((IPHONE_WRITTEN_TABLES as readonly string[]).includes('recovery_factor')).toBe(false);
  });

  it('aller-retour : journal identique (hash canonique), « rien de particulier » distinct du jour non renseigné, publié comme toute écriture', async () => {
    const source = await open(A);
    await insertFactor(source, DAY, '["alcohol","stress"]', 0);
    await insertFactor(source, '2026-11-08', '[]', 1);
    const data = await read(source);
    expect(data.training?.recovery_factor?.map((r) => [r.id, r.values['factors'], r.values['none']])).toEqual([
      ['recovery_factor|2026-11-08', '[]', 1],
      ['recovery_factor|2026-11-09', '["alcohol","stress"]', 0],
    ]);
    const target = await open(B);
    await apply(target, data, 'merge', 11);
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(data));
    expect(await target.driver.select("SELECT DISTINCT table_name FROM sync_outbox WHERE table_name = 'recovery_factor'")).toEqual([{ table_name: 'recovery_factor' }]);
  });

  it('archive de schéma 10 en « remplacer » : aucun jour du journal supprimé ; archive de schéma 11 sans journal : supprimés', async () => {
    const db = await open(A);
    await insertFactor(db, DAY, '["travel"]', 0);
    const plain = await read(await open(B));
    await apply(db, { ...plain, training: {} }, 'replace', 10);
    expect(await count(db)).toBe(1);
    await apply(db, plain, 'replace', 11);
    expect(await count(db)).toBe(0);
  });

  it('archive de schéma 18 : refusée (future-version)', async () => {
    const db = await open(A);
    await expect(parse(await read(db), 18)).rejects.toMatchObject({ code: 'future-version' });
  });

  it('ligne au JSON illisible, au code non textuel ou à l’identifiant faux : refusée à l’import, rien n’est écrit', async () => {
    const good = await open(A);
    await insertFactor(good, DAY, '["alcohol"]', 0);
    const base = await read(good);
    const withRow = (patch: (row: { id: string; values: Record<string, string | number | null> }) => void): ExportData => {
      const rows = (base.training?.recovery_factor ?? []).map((r) => ({ id: r.id, values: { ...r.values } }));
      for (const row of rows) patch(row);
      return { ...base, training: { ...base.training, recovery_factor: rows } } as ExportData;
    };
    for (const bad of [
      withRow((r) => (r.values['factors'] = 'pas du json')),
      withRow((r) => (r.values['factors'] = '[1]')),
      withRow((r) => (r.id = 'recovery_factor|2026-11-10')),
      withRow((r) => (r.values['none'] = 1)),
    ]) {
      const target = await open(B);
      let refused = false;
      try {
        await apply(target, bad, 'merge', 11);
      } catch {
        refused = true;
      }
      expect(refused).toBe(true);
      expect(await count(target)).toBe(0);
    }
  });
});
