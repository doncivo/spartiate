import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, IPHONE_WRITTEN_TABLES, parseExportArchive, TABLE_SINCE_SV, TRAINING_EXPORT_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { FULL_EXPORT_TABLES } from '../../../domain/exportImport/fullExport';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * FIX-0181 (D-171, schéma 15) : l'archive porte les FAVORIS (`food_favorite`), écrits par les deux appareils ; l'export complet aussi (`csv/food_favorite.csv`).
 * Une archive de schéma 14 (sans la table) s'importe sans rien supprimer, même en « remplacer » ; une archive de schéma 17 est refusée ; une ligne
 * incohérente (identifiant, provenance, référence) n'est jamais écrite.
 */
const A = '60000000-0000-4000-8000-0000000000e1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000e2' as DeviceId;
const UUID = '20000000-0000-4000-8000-000000000001';

const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device, '2026-11-13T08:00:00.000Z');
  opened.push(db);
  return db;
};
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();
const parse = async (data: ExportData, sv: number) => {
  const archive = await buildExportArchive(data, { date: '2026-11-13T10:00:00.000Z', sv });
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
const count = async (db: TestDb): Promise<number> => Number((await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM food_favorite WHERE deleted_at IS NULL'))[0]?.n);
const seed = async (db: TestDb): Promise<void> => {
  await (await db.data.repos.foodFavorites()).add({ source: 'ciqual', ref: 'ciqual:20' });
  db.clock.advance(1_000);
  await (await db.data.repos.foodFavorites()).add({ source: 'custom', ref: UUID });
};

describe('export / import des favoris (FIX-0181)', () => {
  it('table exportée en dernier, schéma 15, écrite par les deux appareils, présente dans l’export complet', () => {
    expect(EXPORT_SV).toBe(17); // RESET-01 : schéma 16 ; I6-05 : schéma 17.
    expect(TRAINING_EXPORT_TABLES.at(-3)).toBe('food_favorite'); // I6-05 : compléments et prises ensuite.
    expect(TABLE_SINCE_SV.food_favorite).toBe(15);
    expect((IPHONE_WRITTEN_TABLES as readonly string[]).includes('food_favorite')).toBe(false);
    expect(FULL_EXPORT_TABLES).toContain('food_favorite');
  });

  it('aller-retour : favoris identiques (hash canonique), ordre d’ajout gardé, publiés comme toute écriture', async () => {
    const source = await open(A);
    await seed(source);
    const data = await read(source);
    expect(data.training?.food_favorite?.map((r) => [r.id, r.values['source'], r.values['ref']])).toEqual([
      [`favorite|${UUID}`, 'custom', UUID],
      ['favorite|ciqual:20', 'ciqual', 'ciqual:20'],
    ]);
    const target = await open(B);
    await apply(target, data, 'merge', 15);
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(data));
    expect((await (await target.data.repos.foodFavorites()).list()).map((f) => f.ref)).toEqual([UUID, 'ciqual:20']);
    expect(await target.driver.select('SELECT table_name FROM sync_outbox GROUP BY table_name ORDER BY table_name')).toEqual([{ table_name: 'food_favorite' }]);
  });

  it('archive de schéma 14 en « remplacer » : aucun favori supprimé ; archive de schéma 15 sans favori : favoris supprimés', async () => {
    const db = await open(A);
    await seed(db);
    const plain = await read(await open(B));
    await apply(db, { ...plain, training: {} }, 'replace', 14);
    expect(await count(db)).toBe(2);
    await apply(db, plain, 'replace', 15);
    expect(await count(db)).toBe(0);
  });

  it('archive de schéma 18 : refusée (future-version)', async () => {
    const db = await open(A);
    await expect(parse(await read(db), 18)).rejects.toMatchObject({ code: 'future-version' });
  });

  it('ligne incohérente : refusée à l’import, rien n’est écrit', async () => {
    const good = await open(A);
    await seed(good);
    const base = await read(good);
    const patched = (patch: (row: { id: string; values: Record<string, string | number | null> }) => void): ExportData => {
      const rows = (base.training?.food_favorite ?? []).map((r) => ({ id: r.id, values: { ...r.values } }));
      for (const row of rows) patch(row);
      return { ...base, training: { ...base.training, food_favorite: rows } } as ExportData;
    };
    const cases: [string, ExportData][] = [
      ['id faux', patched((r) => (r.id = `${r.id}x`))],
      ['provenance inconnue', patched((r) => (r.values['source'] = 'autre'))],
      ['Ciqual déclaré perso', patched((r) => (r.values['source'] = r.values['source'] === 'ciqual' ? 'custom' : 'ciqual'))],
      ['référence illisible', patched((r) => { r.values['ref'] = 'n’importe quoi'; r.id = 'favorite|n’importe quoi'; })],
    ];
    for (const [label, bad] of cases) {
      const target = await open(B);
      let refused = false;
      try {
        await apply(target, bad, 'merge', 15);
      } catch {
        refused = true;
      }
      expect(refused, label).toBe(true);
      expect(await count(target), label).toBe(0);
    }
  });
});
