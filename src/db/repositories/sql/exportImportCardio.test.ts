import { afterEach, describe, expect, it } from 'vitest';
import type { CardioSessionInput } from '../../../domain/cardio';
import { buildExportArchive, canonicalHash, EXPORT_SV, IPHONE_WRITTEN_TABLES, parseExportArchive, TABLE_SINCE_SV, TRAINING_EXPORT_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { FULL_EXPORT_EXCLUDED, FULL_EXPORT_TABLES } from '../../../domain/exportImport/fullExport';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-06 (D-221, schéma 18) : l'archive porte les séances cardio (`cardio_session`), écrites par les deux appareils ; l'export complet aussi. Le TRACÉ
 * (`cardio_track`, local) n'est JAMAIS exporté. Une archive de schéma 17 (sans la table) s'importe sans rien supprimer, même en « remplacer » ; une
 * archive de schéma 19 est refusée ; une ligne hors bornes n'est jamais écrite.
 */
const A = '60000000-0000-4000-8000-0000000000d1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000d2' as DeviceId;
const SV = TABLE_SINCE_SV.cardio_session ?? 0;

const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device, '2026-11-13T18:00:00.000Z');
  opened.push(db);
  return db;
};
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();
const parse = async (data: ExportData, sv: number) => {
  const archive = await buildExportArchive(data, { date: '2026-11-13T19:00:00.000Z', sv });
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
const count = async (db: TestDb): Promise<number> => Number((await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM cardio_session WHERE deleted_at IS NULL'))[0]?.n);
const input = (over: Partial<CardioSessionInput> = {}): CardioSessionInput => ({
  kind: 'run', startedAt: '2026-11-13T17:00:00.000Z', durationSec: 2700, distanceM: 7500, avgHr: 152, rpe: 7, notes: '', source: 'manual', ...over,
});
const seed = async (db: TestDb): Promise<void> => {
  const r = await db.data.repos.cardio();
  await r.add(input());
  db.clock.advance(1_000);
  await r.add(input({ kind: 'row', startedAt: '2026-11-12T07:00:00.000Z', distanceM: null, avgHr: null, source: 'gps', notes: 'Rameur ; « 2 km »' }), [{ lat: 0, lon: 0, at: 1_800_000_000_000, accuracyM: 5 }]);
};

describe('export / import des séances cardio (I6-06)', () => {
  it('table exportée en dernier, depuis le schéma 18, écrite par les deux appareils ; le tracé jamais exporté', () => {
    expect(EXPORT_SV).toBeGreaterThanOrEqual(18);
    expect(SV).toBe(EXPORT_SV);
    expect(TRAINING_EXPORT_TABLES.at(-1)).toBe('cardio_session');
    expect((IPHONE_WRITTEN_TABLES as readonly string[]).includes('cardio_session')).toBe(false);
    expect(FULL_EXPORT_TABLES).toContain('cardio_session');
    expect(FULL_EXPORT_TABLES as readonly string[]).not.toContain('cardio_track');
    expect(FULL_EXPORT_EXCLUDED as readonly string[]).toContain('cardio_track');
  });

  it('aller-retour : séances identiques (hash canonique), publiées comme toute écriture ; aucun tracé importé', async () => {
    const source = await open(A);
    await seed(source);
    const data = await read(source);
    expect(data.training?.cardio_session?.map((r) => [r.values['kind'], r.values['duration_sec'], r.values['source']]).sort()).toEqual([
      ['row', 2700, 'gps'],
      ['run', 2700, 'manual'],
    ]);
    expect(JSON.stringify(data)).not.toContain('cardio_track');
    const target = await open(B);
    await apply(target, data, 'merge', SV);
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(data));
    expect(await count(target)).toBe(2);
    expect(await target.driver.select('SELECT 1 FROM cardio_track')).toEqual([]);
    expect(await target.driver.select('SELECT table_name FROM sync_outbox GROUP BY table_name ORDER BY table_name')).toEqual([{ table_name: 'cardio_session' }]);
  });

  it('archive du schéma précédent en « remplacer » : aucune séance supprimée ; archive courante sans séance : séances supprimées', async () => {
    const db = await open(A);
    await seed(db);
    const plain = await read(await open(B));
    await apply(db, { ...plain, training: {} }, 'replace', SV - 1);
    expect(await count(db)).toBe(2);
    await apply(db, plain, 'replace', SV);
    expect(await count(db)).toBe(0);
  });

  it('archive « future » (schéma suivant) : refusée (future-version)', async () => {
    const db = await open(A);
    await expect(parse(await read(db), EXPORT_SV + 1)).rejects.toMatchObject({ code: 'future-version' });
  });

  it('ligne hors bornes : refusée à l’import, rien n’est écrit', async () => {
    const good = await open(A);
    await seed(good);
    const base = await read(good);
    const patched = (patch: (values: Record<string, string | number | null>) => void): ExportData => {
      const rows = (base.training?.cardio_session ?? []).map((r) => ({ id: r.id, values: { ...r.values } }));
      for (const row of rows) patch(row.values);
      return { ...base, training: { ...base.training, cardio_session: rows } } as ExportData;
    };
    const cases: [string, ExportData][] = [
      ['ressenti 11', patched((v) => (v['rpe'] = 11))],
      ['durée nulle', patched((v) => (v['duration_sec'] = 0))],
      ['distance nulle', patched((v) => (v['distance_m'] = 0))],
      ['FC 300', patched((v) => (v['avg_hr'] = 300))],
      ['type mal formé', patched((v) => (v['kind'] = 'Course à pied'))],
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
      expect(await count(target), label).toBe(0);
    }
  });
});
