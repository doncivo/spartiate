import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V12, migration0012BodyProgress } from './0012_body_progress';
import { migrations } from './index';

/**
 * I6-02 : migration 0012 (schéma 12) — `measurement` (mensurations, publiée), `progress_photo` (métadonnées de photo, publiée), `progress_photo_file`
 * (fichier réduit, LOCAL : jamais publié, jamais exporté). Strictement additif : aucune table existante n'est modifiée.
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-12T08:00:00.000Z';
const BASE = 12;
const PHOTO_ID = '7d3c2e4f-0000-4000-8000-000000000001';
const BACKSLASH = String.fromCharCode(92);

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations);
  return db;
}
type Row = Record<string, string | number | null>;
const insert = (db: SqlDriver, table: string, row: Row): Promise<unknown> => {
  const cols = Object.keys(row);
  return db.execute(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] ?? null));
};
const measurement = (over: Row = {}): Row => ({ id: 'measurement|2026-11-09|waist', date: '2026-11-09', kind: 'waist', value: 82.5, created_at: AT, updated_at: AT, device_id: DEV, hlc: h(1), ...over });
const photo = (over: Row = {}): Row => ({ id: PHOTO_ID, date: '2026-11-09', file_name: `${PHOTO_ID}.jpg`, created_at: AT, updated_at: AT, device_id: DEV, hlc: h(1), ...over });
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');

describe('migration 0012 : corps (I6-02, schéma 12)', () => {
  it('registre : 0001 à 0012 ; version 12, nom body_progress', () => {
    expect(migrations.slice(0, 12).map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(migrations[11]).toBe(migration0012BodyProgress);
    expect(migration0012BodyProgress.name).toBe('body_progress');
  });

  it('base 0011 → 0012 : trois tables vides, rien mis en file, AUCUNE table existante modifiée', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, BASE - 1));
    await db.execute('DELETE FROM sync_outbox');
    const before = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    // La 0013 (I6-03) modifie `workout_set` : cette migration se teste sur sa base, comme la 0011 et la 0010.
    await migrate(db, migrations.slice(0, BASE));
    const after = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    const beforeNames = new Set(before.map((r) => r.name));
    for (const row of before) expect(after.find((r) => r.name === row.name), row.name).toEqual(row);
    expect(after.filter((r) => !beforeNames.has(r.name)).map((r) => r.name).filter((n) => n !== 'progress_photo_date_idx').sort()).toEqual([
      'measurement',
      'progress_photo',
      'progress_photo_file',
      'sync_measurement_ai',
      'sync_measurement_au',
      'sync_progress_photo_ai',
      'sync_progress_photo_au',
    ]);
    for (const t of ['measurement', 'progress_photo', 'progress_photo_file']) expect(await db.select(`SELECT * FROM ${t}`)).toEqual([]);
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('measurement : identifiant naturel, une mesure par (date, kind), valeur strictement positive et bornée, genre en minuscules', async () => {
    const db = await freshDb();
    const bad: Row[] = [
      { id: 'measurement|2026-11-10|waist' },
      { id: 'measurement|2026-11-09|hips' },
      { date: '2026-11-9', id: 'measurement|2026-11-9|waist' },
      { kind: 'Waist', id: 'measurement|2026-11-09|Waist' },
      { kind: '', id: 'measurement|2026-11-09|' },
      { value: 0 },
      { value: -3 },
      { value: 1000 },
      { value: 'abc' },
      { value: null },
      { device_id: null },
      { hlc: null },
      { created_at: null },
    ];
    for (const over of bad) await expect(insert(db, 'measurement', measurement(over)), JSON.stringify(over)).rejects.toThrow();
    await insert(db, 'measurement', measurement());
    await expect(insert(db, 'measurement', measurement())).rejects.toThrow();
    await insert(db, 'measurement', measurement({ id: 'measurement|2026-11-09|hips', kind: 'hips', value: 95 }));
    await insert(db, 'measurement', measurement({ id: 'measurement|2026-11-10|waist', date: '2026-11-10' }));
    expect(await db.select('SELECT COUNT(*) AS n FROM measurement')).toEqual([{ n: 3 }]);
    await db.close();
  });

  it('progress_photo : identifiant libre (UUID), date locale, nom de fichier sans séparateur de chemin', async () => {
    const db = await freshDb();
    const bad: Row[] = [{ date: '2026-11-9' }, { date: null }, { file_name: null }, { file_name: '' }, { file_name: 'a/b.jpg' }, { file_name: `a${BACKSLASH}b.jpg` }, { file_name: '../x.jpg' }, { file_name: 'x'.repeat(65) }, { hlc: null }];
    for (const over of bad) await expect(insert(db, 'progress_photo', photo(over)), JSON.stringify(over)).rejects.toThrow();
    await insert(db, 'progress_photo', photo());
    await insert(db, 'progress_photo', photo({ id: '7d3c2e4f-0000-4000-8000-000000000002', file_name: '7d3c2e4f-0000-4000-8000-000000000002.jpg' }));
    expect(await db.select('SELECT COUNT(*) AS n FROM progress_photo')).toEqual([{ n: 2 }]);
    await db.close();
  });

  it('progress_photo_file : locale, JPEG seulement, contenu non vide et borné, aucune colonne de synchro, aucun déclencheur', async () => {
    const db = await freshDb();
    const cols = (await db.select<{ name: string }>('PRAGMA table_info(progress_photo_file)')).map((c) => c.name).sort();
    expect(cols).toEqual(['data', 'mime', 'photo_id', 'saved_at']);
    await insert(db, 'progress_photo_file', { photo_id: PHOTO_ID, mime: 'image/jpeg', data: '/9j/4AAQ', saved_at: AT });
    await expect(insert(db, 'progress_photo_file', { photo_id: PHOTO_ID, mime: 'image/jpeg', data: 'AAAA', saved_at: AT })).rejects.toThrow();
    for (const over of [{ mime: 'image/png' }, { data: '' }, { data: null }, { data: 'x'.repeat(3_000_001) }]) {
      await expect(insert(db, 'progress_photo_file', { photo_id: 'autre', mime: 'image/jpeg', data: 'AAAA', saved_at: AT, ...over }), JSON.stringify(over).slice(0, 40)).rejects.toThrow();
    }
    expect(await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'progress_photo_file'")).toEqual([]);
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('index : la plage de dates des photos est servie par un index', async () => {
    const db = await freshDb();
    const detail = (await db.select<{ detail: string }>("EXPLAIN QUERY PLAN SELECT * FROM progress_photo WHERE date >= '2026-10-01' AND date <= '2026-11-30' AND deleted_at IS NULL")).map((p) => p.detail).join(' ');
    expect(detail).toMatch(/USING (COVERING )?INDEX/);
    await db.close();
  });

  it('copie figée : colonnes capturées = colonnes métier des deux tables publiées (hors id, updated_at, device_id, hlc)', async () => {
    expect(CAPTURE_TABLES_V12.map(([name]) => name)).toEqual(['measurement', 'progress_photo']);
    const db = await freshDb();
    for (const [name, columns] of CAPTURE_TABLES_V12) {
      const real = (await db.select<{ name: string }>(`PRAGMA table_info(${name})`)).map((c) => c.name).filter((c) => !['id', 'updated_at', 'device_id', 'hlc'].includes(c));
      expect([...columns].sort(), name).toEqual(real.sort());
    }
    await db.close();
  });

  it('quatre déclencheurs de capture (deux par table publiée), 53 au total (la 0014, I6-03b, ajoute la capture propre des groupes de routine ; la 0015, FIX-0181, les deux de food_favorite)', async () => {
    const db = await freshDb();
    const names = (await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger' AND (name LIKE 'sync_measurement%' OR name LIKE 'sync_progress_photo%') ORDER BY name")).map((r) => r.name);
    expect(names).toEqual(['sync_measurement_ai', 'sync_measurement_au', 'sync_progress_photo_ai', 'sync_progress_photo_au']);
    expect(await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'")).toHaveLength(53);
    await db.close();
  });

  it('capture de measurement.value : insertion en ligne entière, modification champ par champ avec base_hlc, restauration « + »', async () => {
    const db = await freshDb();
    const id = 'measurement|2026-11-09|waist';
    await db.execute('DELETE FROM sync_outbox');
    await insert(db, 'measurement', measurement());
    expect(await outbox(db)).toEqual([{ table_name: 'measurement', row_id: id, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE measurement SET value = ?, hlc = ? WHERE id = ?', [81, h(5), id]);
    expect((await outbox(db)).map((o) => o.field)).toEqual(['value']);
    expect(await db.select('SELECT field, hlc, base_hlc FROM sync_field_clock WHERE table_name = ? AND row_id = ? AND field = ?', ['measurement', id, 'value'])).toEqual([{ field: 'value', hlc: h(5), base_hlc: h(1) }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE measurement SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(6), id]);
    await db.execute('UPDATE measurement SET deleted_at = NULL, hlc = ? WHERE id = ?', [h(7), id]);
    expect((await outbox(db)).map((o) => o.field).sort()).toEqual(['+', 'deleted_at']);
    await db.close();
  });

  it('capture de progress_photo : insertion en ligne entière, suppression logique suivie', async () => {
    const db = await freshDb();
    await db.execute('DELETE FROM sync_outbox');
    await insert(db, 'progress_photo', photo());
    expect(await outbox(db)).toEqual([{ table_name: 'progress_photo', row_id: PHOTO_ID, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE progress_photo SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(6), PHOTO_ID]);
    expect((await outbox(db)).map((o) => o.field)).toEqual(['deleted_at']);
    await db.close();
  });

  it('recréation d’un identifiant supprimé : la tombstone est retirée', async () => {
    const db = await freshDb();
    await db.execute("INSERT INTO sync_tombstone (table_name, row_id, deleted_hlc, purged_at) VALUES ('measurement', 'measurement|2026-11-09|waist', ?, ?)", [h(2), AT]);
    await insert(db, 'measurement', measurement());
    expect(await db.select("SELECT 1 FROM sync_tombstone WHERE table_name = 'measurement'")).toEqual([]);
    await db.close();
  });

  it('sous sync_guard : aucune capture ; relance sans effet', async () => {
    const db = await freshDb();
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await insert(db, 'measurement', measurement());
    await db.execute('UPDATE measurement SET value = ?, hlc = ? WHERE id = ?', [70, h(2), 'measurement|2026-11-09|waist']);
    expect(await outbox(db)).toEqual([]);
    expect((await migrate(db, migrations)).applied).toEqual([]);
    await db.close();
  });
});
