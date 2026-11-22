import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, IPHONE_WRITTEN_TABLES, parseExportArchive, TABLE_SINCE_SV, TRAINING_EXPORT_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { FULL_EXPORT_TABLES } from '../../../domain/exportImport/fullExport';
import { planImport } from '../../../domain/exportImport/plan';
import { declareInjury, markHealed, recordCheckin, type Injury } from '../../../domain/training/injuries';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * SYNC-0291 (BL-120, D-467, schéma 21) : l'archive porte les GÊNES (`injury`) ; l'export complet aussi. Une archive de la 0.29.0 (schéma 20, sans la
 * table) s'importe sans rien supprimer, même en « remplacer » ; une ligne incohérente n'est jamais écrite. Notes synthétiques.
 */
const A = '60000000-0000-4000-8000-0000000000e5' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000e6' as DeviceId;
const TODAY = '2026-11-22' as LocalDate;
const U = (n: number): string => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device, '2026-11-22T08:00:00.000Z');
  opened.push(db);
  return db;
};
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();
const parse = async (data: ExportData, sv: number) => {
  const archive = await buildExportArchive(data, { date: '2026-11-22T10:00:00.000Z', sv });
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
const live = async (db: TestDb) => (await (await db.data.repos.injuries()).read()).items;
const seed = async (db: TestDb): Promise<void> => {
  const r = declareInjury({ v: 1, items: [] }, { id: U(1), muscleId: 'chest', patterns: ['push-vertical'], startedOn: '2026-11-01' as LocalDate, note: 'note synthétique' }, TODAY);
  if (!r.ok) throw new Error(r.issue);
  const answered = markHealed(recordCheckin(r.value, U(1), 'better', TODAY), U(1), TODAY);
  await (await db.data.repos.injuries()).save(answered.items[0] as Injury);
  db.clock.advance(1_000);
  const s = declareInjury({ v: 1, items: [] }, { id: U(2), muscleId: null, patterns: ['squat'], startedOn: '2026-11-10' as LocalDate, note: null }, TODAY);
  if (!s.ok) throw new Error(s.issue);
  await (await db.data.repos.injuries()).save(s.value.items[0] as Injury);
};

describe('export / import des gênes (SYNC-0291)', () => {
  it('table exportée en dernier, depuis le schéma 21, écrite par les deux appareils, présente dans l’export complet', () => {
    expect(EXPORT_SV).toBe(21);
    expect(TRAINING_EXPORT_TABLES.slice(-2)).toEqual(['exercise_exclusion', 'injury']);
    expect(TABLE_SINCE_SV.injury).toBe(21);
    expect((IPHONE_WRITTEN_TABLES as readonly string[]).includes('injury')).toBe(false);
    expect(FULL_EXPORT_TABLES).toContain('injury');
  });

  it('aller-retour : gênes identiques (hash canonique, check-ins et guérison compris), publiées comme toute écriture', async () => {
    const source = await open(A);
    await seed(source);
    const data = await read(source);
    expect(data.training?.injury?.map((r) => r.id)).toEqual([U(1), U(2)]);
    const target = await open(B);
    await apply(target, data, 'merge', 21);
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(data));
    expect(await live(target)).toEqual(await live(source));
    expect(await target.driver.select('SELECT table_name FROM sync_outbox GROUP BY table_name ORDER BY table_name')).toEqual([{ table_name: 'injury' }]);
  });

  it('archive 0.29.0 (schéma 20, sans la table) : « remplacer » ne supprime aucune gêne ; archive 21 sans gêne : gênes supprimées', async () => {
    const target = await open(A);
    await seed(target);
    const empty = await read(await open(B));
    const training = { ...empty.training };
    delete (training as Record<string, unknown>)['injury'];
    delete (training as Record<string, unknown>)['exercise_exclusion'];
    await apply(target, { ...empty, training }, 'replace', 20);
    expect(await live(target)).toHaveLength(2);
    await apply(target, { ...empty, training: { ...empty.training, injury: [] } }, 'replace', 21);
    expect(await live(target)).toEqual([]);
  });

  it('ligne incohérente : refusée à l’import, rien n’est écrit', async () => {
    const good = await open(A);
    await seed(good);
    const base = await read(good);
    const patched = (patch: (row: { id: string; values: Record<string, string | number | null> }) => void): ExportData => {
      const rows = (base.training?.injury ?? []).map((r) => ({ id: r.id, values: { ...r.values } }));
      for (const row of rows) patch(row);
      return { ...base, training: { ...base.training, injury: rows } } as ExportData;
    };
    const cases: [string, ExportData][] = [
      ['identifiant non UUID', patched((r) => (r.id = 'g1'))],
      ['aucune cible', patched((r) => { r.values['muscle_id'] = null; r.values['patterns'] = '[]'; })],
      ['mouvement inconnu', patched((r) => (r.values['patterns'] = '["inconnu"]'))],
      ['réponse inconnue', patched((r) => (r.values['checkins'] = '[{"on":"2026-11-15","answer":"peut-être"}]'))],
      ['motifs illisibles', patched((r) => (r.values['patterns'] = '{"a":1}'))],
    ];
    for (const [label, bad] of cases) {
      const target = await open(B);
      let refused = false;
      try {
        await apply(target, bad, 'merge', 21);
      } catch {
        refused = true;
      }
      expect(refused, label).toBe(true);
      expect(await live(target), label).toEqual([]);
    }
  });
});
