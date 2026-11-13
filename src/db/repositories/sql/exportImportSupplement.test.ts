import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, IPHONE_WRITTEN_TABLES, parseExportArchive, TABLE_SINCE_SV, TRAINING_EXPORT_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { FULL_EXPORT_TABLES } from '../../../domain/exportImport/fullExport';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { migrations } from '../../migrations';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-05 (D-210) : l'archive porte les COMPLÉMENTS et leurs PRISES (`supplement`, `supplement_intake`), écrits par les deux appareils ; l'export complet
 * aussi. Une archive du schéma précédent (sans ces tables) s'importe sans rien supprimer, même en « remplacer » ; une archive d'un schéma futur est
 * refusée ; une ligne incohérente n'est jamais écrite.
 */
const A = '60000000-0000-4000-8000-0000000000e3' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000e4' as DeviceId;
const SV = migrations.length;
const D = '2026-11-13' as LocalDate;
const T = '08:00' as LocalTime;

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
const count = async (db: TestDb, table: string): Promise<number> => Number((await db.driver.select<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL`))[0]?.n);
const seed = async (db: TestDb): Promise<string> => {
  const repo = await db.data.repos.supplements();
  const s = await repo.create({ name: 'Créatine', dose: 5, unit: 'g', times: [T], days: 127, active: true });
  await repo.setTaken(s.id, D, T, true);
  return s.id;
};

describe('export / import des compléments (I6-05)', () => {
  it('tables exportées en dernier, depuis le schéma courant, écrites par les deux appareils, présentes dans l’export complet', () => {
    expect(EXPORT_SV).toBe(SV);
    expect(TRAINING_EXPORT_TABLES.slice(-2)).toEqual(['supplement', 'supplement_intake']);
    expect(TABLE_SINCE_SV.supplement).toBe(SV);
    expect(TABLE_SINCE_SV.supplement_intake).toBe(SV);
    for (const t of ['supplement', 'supplement_intake']) {
      expect((IPHONE_WRITTEN_TABLES as readonly string[]).includes(t)).toBe(false);
      expect(FULL_EXPORT_TABLES).toContain(t);
    }
  });

  it('aller-retour : identique (hash canonique), publié comme toute écriture', async () => {
    const source = await open(A);
    const id = await seed(source);
    const data = await read(source);
    expect(data.training?.supplement?.map((r) => [r.id, r.values['name'], r.values['times'], r.values['days']])).toEqual([[id, 'Créatine', '["08:00"]', 127]]);
    expect(data.training?.supplement_intake?.map((r) => r.id)).toEqual([`intake|${id}|${D}|${T}`]);
    const target = await open(B);
    await apply(target, data, 'merge', SV);
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(data));
    expect(await (await target.data.repos.supplements()).intakes(D, D)).toEqual([{ supplementId: id, date: D, moment: T }]);
    expect(await target.driver.select("SELECT table_name FROM sync_outbox WHERE table_name LIKE 'supplement%' GROUP BY table_name ORDER BY table_name")).toEqual([{ table_name: 'supplement' }, { table_name: 'supplement_intake' }]);
  });

  it('archive du schéma précédent en « remplacer » : rien supprimé ; archive courante sans compléments : supprimés', async () => {
    const db = await open(A);
    await seed(db);
    const plain = await read(await open(B));
    await apply(db, { ...plain, training: {} }, 'replace', SV - 1);
    expect(await count(db, 'supplement')).toBe(1);
    expect(await count(db, 'supplement_intake')).toBe(1);
    await apply(db, plain, 'replace', SV);
    expect(await count(db, 'supplement')).toBe(0);
    expect(await count(db, 'supplement_intake')).toBe(0);
  });

  it('archive d’un schéma futur : refusée (future-version)', async () => {
    const db = await open(A);
    await expect(parse(await read(db), SV + 1)).rejects.toMatchObject({ code: 'future-version' });
  });

  it('ligne incohérente : refusée à l’import, rien n’est écrit', async () => {
    const good = await open(A);
    await seed(good);
    const base = await read(good);
    type R = { id: string; values: Record<string, string | number | null> };
    const patched = (table: 'supplement' | 'supplement_intake', patch: (row: R) => void): ExportData => {
      const rows = (base.training?.[table] ?? []).map((r) => ({ id: r.id, values: { ...r.values } }));
      for (const row of rows) patch(row);
      return { ...base, training: { ...base.training, [table]: rows } } as ExportData;
    };
    const cases: [string, ExportData][] = [
      ['nom vide', patched('supplement', (r) => (r.values['name'] = ''))],
      ['heures illisibles', patched('supplement', (r) => (r.values['times'] = '["8h"]'))],
      ['jours hors bornes', patched('supplement', (r) => (r.values['days'] = 0))],
      ['dose nulle', patched('supplement', (r) => (r.values['dose'] = 0))],
      ['id de prise faux', patched('supplement_intake', (r) => (r.id = `${r.id}x`))],
      ['heure de prise illisible', patched('supplement_intake', (r) => (r.values['moment'] = '8h'))],
    ];
    for (const [label, bad] of cases) {
      const target = await open(B);
      let refused = false;
      try {
        await apply(target, bad, 'merge', SV);
      } catch {
        refused = true;
      }
      expect(refused, label).toBe(true);
      expect(await count(target, 'supplement'), label).toBe(0);
      expect(await count(target, 'supplement_intake'), label).toBe(0);
    }
  });
});
