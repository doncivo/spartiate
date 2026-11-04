import { afterEach, describe, expect, it } from 'vitest';
import type { ExportData, ExportWeight } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * Revue sync-icloud de l'import (D-57, D-26) : l'import écrit lui-même la file et les horloges parce que `sync_guard` neutralise
 * les déclencheurs de capture. Ces tests prouvent (1) qu'aucun déclencheur ne tire en plus, (2) que ce que l'import écrit est
 * ce que ferait une écriture normale du moteur, (3) que `sync_tombstone` n'est jamais une porte de résurrection.
 */
const A = '60000000-0000-4000-8000-0000000000a1' as DeviceId;
const D1 = '2026-10-05' as LocalDate;
const D2 = '2026-10-06' as LocalDate;
/** HLC de suppression antérieur au départ des horloges de test (1er octobre 2026), au format de `src/domain/hlc.ts`. */
const DELETED_HLC = `${String(Date.UTC(2026, 8, 1)).padStart(15, '0')}-0000-${A}`;
const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (): Promise<TestDb> => {
  const db = await openBaseDb(A);
  opened.push(db);
  return db;
};

const w = (date: string, kg: number): ExportWeight => ({ id: `weight|${date}|manual`, date, kg, source: 'manual', timezone: 'Europe/Paris', healthUuid: null, measuredAt: null });
const archive = (...weights: ExportWeight[]): ExportData => ({ profile: null, weights, settings: {} });

async function importInto(db: TestDb, incoming: ExportData, mode: 'merge' | 'replace'): Promise<void> {
  await db.data.transaction(async (repos) => {
    const repo = await repos.exportImport();
    await repo.applyImport(planImport(await repo.readExportData(), incoming, mode), 2026);
  });
}

interface Snapshot {
  readonly outbox: string[];
  readonly clocks: string[];
  readonly row: { readonly hlc: string; readonly deleted_at: string | null } | undefined;
}
/** File et horloges d'une ligne, hlc remplacé par « ROW » quand il égale celui de la ligne (comparable entre deux bases). */
async function snapshot(db: TestDb, id: string): Promise<Snapshot> {
  const row = (await db.driver.select<{ hlc: string; deleted_at: string | null }>('SELECT hlc, deleted_at FROM body_weight WHERE id = ?', [id]))[0];
  const tag = (hlc: string | null): string => (hlc === null ? 'null' : hlc === row?.hlc ? 'ROW' : 'OLD');
  const outbox = await db.driver.select<{ field: string }>('SELECT field FROM sync_outbox WHERE table_name = ? AND row_id = ? ORDER BY field', ['body_weight', id]);
  const clocks = await db.driver.select<{ field: string; hlc: string; base_hlc: string | null }>('SELECT field, hlc, base_hlc FROM sync_field_clock WHERE table_name = ? AND row_id = ? ORDER BY field', ['body_weight', id]);
  return { outbox: outbox.map((o) => o.field), clocks: clocks.map((c) => `${c.field}:${tag(c.hlc)}:${tag(c.base_hlc)}`), row };
}
const tombstones = (db: TestDb) => db.driver.select<{ table_name: string; row_id: string; deleted_hlc: string }>('SELECT table_name, row_id, deleted_hlc FROM sync_tombstone ORDER BY row_id');
const countOutbox = async (db: TestDb): Promise<number> => (await db.driver.select('SELECT 1 FROM sync_outbox')).length;

describe('import : aucun déclencheur de capture en plus des écritures manuelles', () => {
  it('création : exactement une entrée « * » (aucune entrée par champ), garde retirée', async () => {
    const db = await open();
    await importInto(db, archive(w(D1, 82.4)), 'merge');
    expect((await snapshot(db, `weight|${D1}|manual`)).outbox).toEqual(['*']);
    expect(await db.driver.select('SELECT 1 FROM sync_guard')).toEqual([]);
  });

  it('mise à jour d’une ligne existante : une seule entrée « * », pas de doublon avec des entrées par champ', async () => {
    const db = await open();
    await (await db.data.repos.bodyWeights()).saveManual({ date: D1, kg: 82.4, timezone: 'Europe/Paris' }, D1);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1000);
    await importInto(db, archive(w(D1, 81.9)), 'merge');
    expect((await snapshot(db, `weight|${D1}|manual`)).outbox).toEqual(['*']);
  });
});

describe('import : file et horloges comparées à une écriture normale', () => {
  it('création : même file qu’une écriture normale ; les horloges de champ sont posées à l’HLC de la ligne (D-57)', async () => {
    const normal = await open();
    await (await normal.data.repos.bodyWeights()).saveManual({ date: D1, kg: 82.4, timezone: 'Europe/Paris' }, D1);
    const imported = await open();
    await importInto(imported, archive(w(D1, 82.4)), 'merge');
    const n = await snapshot(normal, `weight|${D1}|manual`);
    const i = await snapshot(imported, `weight|${D1}|manual`);
    expect(i.outbox).toEqual(n.outbox);
    expect(n.clocks).toEqual([]);
    expect(i.clocks.length).toBeGreaterThan(0);
    for (const clock of i.clocks) expect(clock).toMatch(/:ROW:null$/);
  });

  it('mise à jour : l’horloge et la base du champ modifié sont celles d’une écriture normale', async () => {
    const normal = await open();
    const imported = await open();
    for (const db of [normal, imported]) await (await db.data.repos.bodyWeights()).saveManual({ date: D1, kg: 82.4, timezone: 'Europe/Paris' }, D1);
    for (const db of [normal, imported]) {
      await db.driver.execute('DELETE FROM sync_outbox');
      db.clock.advance(1000);
    }
    await (await normal.data.repos.bodyWeights()).saveManual({ date: D1, kg: 81.9, timezone: 'Europe/Paris' }, D1);
    await importInto(imported, archive(w(D1, 81.9)), 'merge');
    const id = `weight|${D1}|manual`;
    const kg = (s: Snapshot) => s.clocks.find((c) => c.startsWith('kg:'));
    expect(kg(await snapshot(imported, id))).toBe(kg(await snapshot(normal, id)));
    expect((await snapshot(imported, id)).clocks.find((c) => c.startsWith('*:'))).toBe((await snapshot(normal, id)).clocks.find((c) => c.startsWith('*:')));
  });

  it('suppression (mode remplacer) : même file, mêmes horloges qu’une suppression normale', async () => {
    const normal = await open();
    const imported = await open();
    for (const db of [normal, imported]) {
      await (await db.data.repos.bodyWeights()).saveManual({ date: D1, kg: 82.4, timezone: 'Europe/Paris' }, D1);
      await db.driver.execute('DELETE FROM sync_outbox');
      db.clock.advance(1000);
    }
    await (await normal.data.repos.bodyWeights()).softDelete(D1, 'manual');
    await importInto(imported, archive(), 'replace');
    const id = `weight|${D1}|manual`;
    const n = await snapshot(normal, id);
    const i = await snapshot(imported, id);
    expect(i.outbox).toEqual(n.outbox);
    expect(i.clocks).toEqual(n.clocks);
    expect(i.row?.deleted_at).not.toBeNull();
  });
});

describe('import : sync_tombstone et résurrection (D-57)', () => {
  const purge = async (db: TestDb, id: string): Promise<void> => {
    await db.driver.execute("INSERT INTO sync_tombstone (table_name, row_id, deleted_hlc, purged_at) VALUES ('body_weight', ?, ?, ?)", [id, DELETED_HLC, '2026-10-01T00:00:00.000Z']);
  };

  it.each(['merge', 'replace'] as const)('mode %s : une ligne purgée absente de l’archive reste absente, son tombstone intact, rien dans la file', async (mode) => {
    const db = await open();
    await purge(db, `weight|${D2}|manual`);
    const before = await tombstones(db);
    await importInto(db, archive(w(D1, 82.4)), mode);
    expect(await db.driver.select('SELECT 1 FROM body_weight WHERE id = ?', [`weight|${D2}|manual`])).toEqual([]);
    expect(await tombstones(db)).toEqual(before);
    expect((await snapshot(db, `weight|${D2}|manual`)).outbox).toEqual([]);
  });

  it('mode remplacer : l’import n’écrit jamais de tombstone, même pour les lignes qu’il supprime', async () => {
    const db = await open();
    await importInto(db, archive(w(D1, 82.4), w(D2, 82.1)), 'merge');
    await importInto(db, archive(w(D1, 82.4)), 'replace');
    expect(await tombstones(db)).toEqual([]);
    expect((await snapshot(db, `weight|${D2}|manual`)).row?.deleted_at).not.toBeNull();
  });

  it('une ligne supprimée localement et absente de l’archive n’est pas réécrite (ni hlc, ni file)', async () => {
    const db = await open();
    await (await db.data.repos.bodyWeights()).saveManual({ date: D2, kg: 82.1, timezone: 'Europe/Paris' }, D2);
    db.clock.advance(1000);
    await (await db.data.repos.bodyWeights()).softDelete(D2, 'manual');
    await db.driver.execute('DELETE FROM sync_outbox');
    const before = await snapshot(db, `weight|${D2}|manual`);
    db.clock.advance(1000);
    await importInto(db, archive(w(D1, 82.4)), 'replace');
    expect(await snapshot(db, `weight|${D2}|manual`)).toEqual(before);
  });

  it('une ligne purgée que l’archive réintroduit volontairement se comporte comme une écriture normale : tombstone retiré, HLC plus récent que la suppression', async () => {
    const normal = await open();
    const imported = await open();
    for (const db of [normal, imported]) await purge(db, `weight|${D1}|manual`);
    await (await normal.data.repos.bodyWeights()).saveManual({ date: D1, kg: 82.4, timezone: 'Europe/Paris' }, D1);
    await importInto(imported, archive(w(D1, 82.4)), 'merge');
    expect(await tombstones(imported)).toEqual(await tombstones(normal));
    expect(await tombstones(imported)).toEqual([]);
    const row = (await snapshot(imported, `weight|${D1}|manual`)).row;
    expect(row && row.hlc > DELETED_HLC).toBe(true);
    expect((await snapshot(imported, `weight|${D1}|manual`)).outbox).toEqual((await snapshot(normal, `weight|${D1}|manual`)).outbox);
  });

  it('une fusion répétée après purge n’ajoute rien à la file', async () => {
    const db = await open();
    await importInto(db, archive(w(D1, 82.4)), 'merge');
    const n = await countOutbox(db);
    await importInto(db, archive(w(D1, 82.4)), 'merge');
    expect(await countOutbox(db)).toBe(n);
  });
});
