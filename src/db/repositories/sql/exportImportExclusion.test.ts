import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, IPHONE_WRITTEN_TABLES, parseExportArchive, TABLE_SINCE_SV, TRAINING_EXPORT_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { FULL_EXPORT_TABLES } from '../../../domain/exportImport/fullExport';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * SYNC-0291 (BL-109, D-467, schéma 21) : l'archive porte les EXERCICES ÉCARTÉS (`exercise_exclusion`) ; l'export complet aussi. Une archive de la 0.29.0
 * (schéma 20, sans la table) s'importe sans rien supprimer, même en « remplacer » ; une ligne incohérente n'est jamais écrite.
 */
const A = '60000000-0000-4000-8000-0000000000e3' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000e4' as DeviceId;

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
const live = async (db: TestDb) => (await db.data.repos.exerciseExclusions()).list();
const seed = async (db: TestDb): Promise<void> => {
  await (await db.data.repos.exerciseExclusions()).setExcluded('squat-barbell', true);
  db.clock.advance(1_000);
  await (await db.data.repos.exerciseExclusions()).setExcluded('row-cable', true);
};

describe('export / import des exercices écartés (SYNC-0291)', () => {
  it('table exportée, depuis le schéma 21, écrite par les deux appareils, présente dans l’export complet', () => {
    expect(EXPORT_SV).toBeGreaterThanOrEqual(21);
    expect(TRAINING_EXPORT_TABLES).toContain('exercise_exclusion');
    expect(TABLE_SINCE_SV.exercise_exclusion).toBe(21);
    expect((IPHONE_WRITTEN_TABLES as readonly string[]).includes('exercise_exclusion')).toBe(false);
    expect(FULL_EXPORT_TABLES).toContain('exercise_exclusion');
  });

  it('aller-retour : écartés identiques (hash canonique), publiés comme toute écriture', async () => {
    const source = await open(A);
    await seed(source);
    const data = await read(source);
    expect(data.training?.exercise_exclusion?.map((r) => [r.id, r.values['exercise_id']])).toEqual([
      ['exclusion|row-cable', 'row-cable'],
      ['exclusion|squat-barbell', 'squat-barbell'],
    ]);
    const target = await open(B);
    await apply(target, data, 'merge', 21);
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(data));
    expect(await live(target)).toEqual(['row-cable', 'squat-barbell']);
    expect(await target.driver.select('SELECT table_name FROM sync_outbox GROUP BY table_name ORDER BY table_name')).toEqual([{ table_name: 'exercise_exclusion' }]);
  });

  it('archive 0.29.0 (schéma 20, sans la table) : importée sans perte, « remplacer » ne supprime aucun écarté ; archive 21 sans écarté : écartés supprimés', async () => {
    const db = await open(A);
    await seed(db);
    await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-20' as never, kg: 80, timezone: 'Europe/Paris' }, '2026-11-22' as never);
    const old = await read(db);
    const training = { ...old.training };
    delete (training as Record<string, unknown>)['exercise_exclusion'];
    delete (training as Record<string, unknown>)['injury'];
    const target = await open(B);
    await seed(target);
    await apply(target, { ...old, training }, 'replace', 20);
    expect(await live(target)).toEqual(['row-cable', 'squat-barbell']);
    expect(await target.driver.select('SELECT kg FROM body_weight WHERE deleted_at IS NULL')).toEqual([{ kg: 80 }]);
    const empty = await read(await open(B));
    await apply(target, { ...empty, training: { ...empty.training, exercise_exclusion: [] } }, 'replace', 21);
    expect(await live(target)).toEqual([]);
  });

  it('ligne incohérente : refusée à l’import, rien n’est écrit', async () => {
    const good = await open(A);
    await seed(good);
    const base = await read(good);
    const patched = (patch: (row: { id: string; values: Record<string, string | number | null> }) => void): ExportData => {
      const rows = (base.training?.exercise_exclusion ?? []).map((r) => ({ id: r.id, values: { ...r.values } }));
      for (const row of rows) patch(row);
      return { ...base, training: { ...base.training, exercise_exclusion: rows } } as ExportData;
    };
    const cases: [string, ExportData][] = [
      ['id faux', patched((r) => (r.id = `${r.id}x`))],
      ['exercice avec « | »', patched((r) => { r.values['exercise_id'] = 'a|b'; r.id = 'exclusion|a|b'; })],
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
