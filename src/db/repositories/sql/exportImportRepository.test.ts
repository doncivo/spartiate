import { afterEach, describe, expect, it } from 'vitest';
import { canonicalHash, type ExportData, type ExportWeight } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

const A = '60000000-0000-4000-8000-0000000000a1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000b1' as DeviceId;
const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device);
  opened.push(db);
  return db;
};

const w = (date: string, kg: number, source: 'manual' | 'health' = 'manual'): ExportWeight => ({
  id: `weight|${date}|${source}`,
  date,
  kg,
  source,
  timezone: 'Europe/Paris',
  healthUuid: source === 'health' ? `HK-${date}` : null,
  measuredAt: source === 'health' ? `${date}T06:00:00.000Z` : null,
});
const DATA: ExportData = {
  profile: { id: 'profile|singleton', sex: 'male', birthYear: 1990, heightCm: 181, goal: null, experience: 'intermediate', units: 'metric' },
  weights: [w('2026-10-05', 82.4), w('2026-10-06', 82.1, 'health')],
  settings: {},
};
const EMPTY: ExportData = { profile: null, weights: [], settings: {} };

async function importInto(db: TestDb, incoming: ExportData, mode: 'merge' | 'replace'): Promise<void> {
  await db.data.transaction(async (repos) => {
    const repo = await repos.exportImport();
    const plan = planImport(await repo.readExportData(), incoming, mode);
    await repo.applyImport(plan, 2026);
  });
}
const outbox = (db: TestDb) => db.driver.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();

describe('ExportImportRepository : lecture', () => {
  it('ne lit que les lignes non supprimées, sans hlc ni appareil, triées', async () => {
    const db = await open(A);
    await importInto(db, DATA, 'merge');
    db.clock.advance(1000);
    await (await db.data.repos.bodyWeights()).softDelete('2026-10-05' as never, 'manual');
    const data = await read(db);
    expect(data.weights.map((x) => x.id)).toEqual(['weight|2026-10-06|health']);
    expect(JSON.stringify(data)).not.toMatch(/hlc|device|updated/);
  });
});

describe('ExportImportRepository : import (D-57)', () => {
  it('fusion sur base vide : lignes écrites, une entrée « * » par ligne, horloges de chaque champ à l’HLC de l’importateur, garde retirée, aucun tombstone', async () => {
    const db = await open(A);
    await importInto(db, DATA, 'merge');
    expect(await read(db)).toEqual(DATA);
    const entries = await outbox(db);
    expect(entries.filter((e) => e.field === '*').map((e) => e.row_id).sort()).toEqual(['profile|singleton', 'weight|2026-10-05|manual', 'weight|2026-10-06|health']);
    expect(entries.every((e) => e.field === '*')).toBe(true);
    const hlcs = await db.driver.select<{ id: string; hlc: string }>('SELECT id, hlc FROM body_weight');
    const clocks = await db.driver.select<{ row_id: string; field: string; hlc: string }>("SELECT row_id, field, hlc FROM sync_field_clock WHERE table_name = 'body_weight'");
    for (const row of hlcs) {
      const mine = clocks.filter((c) => c.row_id === row.id);
      expect(mine.map((c) => c.field).sort()).toEqual(['created_at', 'date', 'deleted_at', 'health_uuid', 'kg', 'measured_at', 'source', 'timezone']);
      expect(mine.every((c) => c.hlc === row.hlc)).toBe(true);
      expect(row.hlc.endsWith(A)).toBe(true);
    }
    expect(await db.driver.select('SELECT * FROM sync_guard')).toEqual([]);
    expect(await db.driver.select('SELECT * FROM sync_tombstone')).toEqual([]);
  });

  it('remplacement : une ligne locale absente de l’archive reçoit deleted_at, son horloge et son entrée outbox deleted_at ; jamais de tombstone', async () => {
    const db = await open(A);
    await importInto(db, DATA, 'merge');
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1000);
    await importInto(db, { ...DATA, weights: [w('2026-10-05', 82.4)] }, 'replace');
    const gone = await db.driver.select<{ deleted_at: string | null; hlc: string }>("SELECT deleted_at, hlc FROM body_weight WHERE id = 'weight|2026-10-06|health'");
    expect(gone[0]?.deleted_at).not.toBeNull();
    expect(await outbox(db)).toEqual([{ table_name: 'body_weight', row_id: 'weight|2026-10-06|health', field: 'deleted_at' }]);
    const clock = await db.driver.select<{ hlc: string }>("SELECT hlc FROM sync_field_clock WHERE row_id = 'weight|2026-10-06|health' AND field = 'deleted_at'");
    expect(clock[0]?.hlc).toBe(gone[0]?.hlc);
    expect(await db.driver.select('SELECT * FROM sync_tombstone')).toEqual([]);
    expect((await read(db)).weights.map((x) => x.id)).toEqual(['weight|2026-10-05|manual']);
  });

  it('fusion répétée : aucun doublon, aucune nouvelle entrée en file', async () => {
    const db = await open(A);
    await importInto(db, DATA, 'merge');
    const before = (await outbox(db)).length;
    db.clock.advance(1000);
    await importInto(db, DATA, 'merge');
    expect(await db.driver.select('SELECT id FROM body_weight')).toHaveLength(2);
    expect(await db.driver.select('SELECT id FROM profile')).toHaveLength(1);
    expect((await outbox(db)).length).toBe(before);
  });

  it('une pesée supprimée puis réimportée est rétablie et republiée', async () => {
    const db = await open(A);
    await importInto(db, DATA, 'merge');
    db.clock.advance(1000);
    await (await db.data.repos.bodyWeights()).softDelete('2026-10-05' as never, 'manual');
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1000);
    await importInto(db, DATA, 'merge');
    expect(await db.driver.select("SELECT deleted_at FROM body_weight WHERE id = 'weight|2026-10-05|manual'")).toEqual([{ deleted_at: null }]);
    expect((await outbox(db)).some((e) => e.row_id === 'weight|2026-10-05|manual' && e.field === '*')).toBe(true);
  });

  it('crash avant commit : aucune ligne, aucune horloge, aucune entrée, aucune garde', async () => {
    const db = await open(A);
    await expect(
      db.data.transaction(async (repos) => {
        const repo = await repos.exportImport();
        await repo.applyImport(planImport(EMPTY, DATA, 'merge'), 2026);
        throw new Error('crash simulé');
      }),
    ).rejects.toThrow('crash simulé');
    for (const table of ['profile', 'body_weight', 'sync_field_clock', 'sync_outbox', 'sync_guard']) expect(await db.driver.select(`SELECT 1 FROM ${table}`)).toEqual([]);
  });

  it('crash après commit : la file persistée garde les entrées, rien n’est perdu ni doublé', async () => {
    const db = await open(A);
    await importInto(db, DATA, 'merge');
    // « redémarrage » : on relit seulement l'état persistant
    expect((await outbox(db)).filter((e) => e.field === '*')).toHaveLength(3);
    expect(await db.driver.select('SELECT * FROM sync_guard')).toEqual([]);
  });

  it('refuse un plan invalide sans rien écrire (profil hors bornes)', async () => {
    const db = await open(A);
    const bad: ExportData = { ...DATA, profile: { ...(DATA.profile as NonNullable<ExportData['profile']>), heightCm: 5 } };
    await expect(importInto(db, bad, 'merge')).rejects.toThrow();
    for (const table of ['profile', 'body_weight', 'sync_outbox', 'sync_guard']) expect(await db.driver.select(`SELECT 1 FROM ${table}`)).toEqual([]);
  });

  it('export → base vierge → import → export : même hash canonique, mêmes compteurs et identifiants', async () => {
    const a = await open(A);
    await importInto(a, DATA, 'merge');
    const exported = await read(a);
    const b = await open(B);
    await importInto(b, exported, 'replace');
    const again = await read(b);
    expect(await canonicalHash(again)).toBe(await canonicalHash(exported));
    expect(again.weights.map((x) => x.id)).toEqual(exported.weights.map((x) => x.id));
  });
});
