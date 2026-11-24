import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V21, migration0021ExclusionInjury } from './0021_exclusion_injury';
import { migrations } from './index';

/**
 * SYNC-0291 (BL-109, D-447) : migration 0021 (schéma 21) — `exercise_exclusion`, exercices écartés (« ne plus proposer »), PUBLIÉS et écrits par les
 * deux appareils, et `injury` (BL-120), gênes déclarées, PUBLIÉES. Tables NEUVES ; AUCUNE table existante n'est modifiée ; aucune donnée migrée en SQL (la reprise du réglage local
 * `training.excludedExercises` se fait une fois par le dépôt, avec l'horloge de synchro de l'appareil).
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-22T08:00:00.000Z';
const BASE = 21;

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.slice(0, BASE));
  return db;
}
type Row = Record<string, string | number | null>;
const exclusion = (over: Row = {}): Row => ({ id: 'exclusion|bench-press-barbell', exercise_id: 'bench-press-barbell', created_at: AT, updated_at: AT, device_id: DEV, hlc: h(1), ...over });
const insert = (db: SqlDriver, table: string, row: Row): Promise<unknown> => {
  const cols = Object.keys(row);
  return db.execute(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] ?? null));
};
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');

describe('migration 0021 : exercices écartés publiés (SYNC-0291, schéma 21)', () => {
  it('registre : 0001 à 0021 ; version 21, nom exclusion_injury', () => {
    expect(migrations.slice(0, 21).map((m) => m.version)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect(migrations[20]).toBe(migration0021ExclusionInjury);
    expect(migration0021ExclusionInjury.name).toBe('exclusion_injury');
  });

  it('base 0020 → 0021 : nouveaux objets seulement, tables vides, rien mis en file, AUCUN objet existant modifié', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, BASE - 1));
    await db.execute('DELETE FROM sync_outbox');
    const before = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    await migrate(db, migrations.slice(0, BASE));
    const after = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    const beforeNames = new Set(before.map((r) => r.name));
    for (const row of before) expect(after.find((r) => r.name === row.name), row.name).toEqual(row);
    expect(after.filter((r) => !beforeNames.has(r.name)).map((r) => r.name).sort()).toEqual(['exercise_exclusion', 'injury', 'sync_exercise_exclusion_ai', 'sync_exercise_exclusion_au', 'sync_injury_ai', 'sync_injury_au']);
    expect(await db.select('SELECT * FROM injury')).toEqual([]);
    expect(await db.select('SELECT * FROM exercise_exclusion')).toEqual([]);
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('copie figée des colonnes capturées de exercise_exclusion : exercise_id, created_at, deleted_at', () => {
    expect(CAPTURE_TABLES_V21[0]).toEqual(['exercise_exclusion', ['exercise_id', 'created_at', 'deleted_at']]);
  });

  it('CHECK : identifiant naturel exclusion|<exercice>, exercice de 1 à 118 caractères sans « | »', async () => {
    const db = await freshDb();
    await insert(db, 'exercise_exclusion', exclusion());
    await insert(db, 'exercise_exclusion', exclusion({ id: `exclusion|${'a'.repeat(118)}`, exercise_id: 'a'.repeat(118) }));
    const bad: Row[] = [
      exclusion({ id: 'exclusion|autre' }),
      exclusion({ id: 'x|bench-press-barbell' }),
      exclusion({ id: 'exclusion|', exercise_id: '' }),
      exclusion({ id: `exclusion|${'a'.repeat(119)}`, exercise_id: 'a'.repeat(119) }),
      exclusion({ id: 'exclusion|a|b', exercise_id: 'a|b' }),
      exclusion({ id: 'exclusion|squat', exercise_id: 'squat', created_at: null }),
    ];
    for (const row of bad) await expect(insert(db, 'exercise_exclusion', row), JSON.stringify(row)).rejects.toThrow();
    expect(await db.select('SELECT COUNT(*) AS n FROM exercise_exclusion')).toEqual([{ n: 2 }]);
    await db.close();
  });

  it('capture : insertion = ligne entière ; remise = champ deleted_at ; nouvel écart = « + » ; garde : rien', async () => {
    const db = await freshDb();
    const id = 'exclusion|bench-press-barbell';
    await insert(db, 'exercise_exclusion', exclusion());
    expect(await outbox(db)).toEqual([{ table_name: 'exercise_exclusion', row_id: id, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE exercise_exclusion SET deleted_at = ?, updated_at = ?, hlc = ? WHERE id = ?', [AT, AT, h(2), id]);
    expect(await outbox(db)).toEqual([{ table_name: 'exercise_exclusion', row_id: id, field: 'deleted_at' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE exercise_exclusion SET deleted_at = NULL, updated_at = ?, hlc = ? WHERE id = ?', [AT, h(3), id]);
    expect((await outbox(db)).map((r) => r.field).sort()).toEqual(['+', 'deleted_at']);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('INSERT OR IGNORE INTO sync_guard (id) VALUES (1)');
    await insert(db, 'exercise_exclusion', exclusion({ id: 'exclusion|squat', exercise_id: 'squat' }));
    await db.execute('DELETE FROM sync_guard');
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });
});

const U = '20000000-0000-4000-8000-000000000001';
const injury = (over: Row = {}): Row => ({
  id: U, muscle_id: 'chest', patterns: '["push-vertical"]', started_on: '2026-11-01', note: null, status: 'active', healed_on: null, checkins: '[]', created_at: AT, updated_at: AT, device_id: DEV, hlc: h(1), ...over,
});

describe('migration 0021 : gênes publiées (SYNC-0291, BL-120)', () => {
  it('copie figée des colonnes capturées de injury', () => {
    expect(CAPTURE_TABLES_V21[1]).toEqual(['injury', ['muscle_id', 'patterns', 'started_on', 'note', 'status', 'healed_on', 'checkins', 'created_at', 'deleted_at']]);
  });

  it('CHECK : formes seulement (aucune contrainte croisée entre colonnes : fusion champ par champ)', async () => {
    const db = await freshDb();
    await insert(db, 'injury', injury());
    // Aucune contrainte croisée : statut guéri sans date, ni muscle ni motif (la cohérence est relue par le domaine, jamais imposée à une fusion).
    await insert(db, 'injury', injury({ id: '20000000-0000-4000-8000-000000000002', status: 'healed', muscle_id: null, patterns: '[]' }));
    const bad: Row[] = [
      injury({ id: '20000000-0000-4000-8000-000000000003', status: 'autre' }),
      injury({ id: '20000000-0000-4000-8000-000000000004', started_on: '1er novembre' }),
      injury({ id: '20000000-0000-4000-8000-000000000005', note: 'x'.repeat(141) }),
      injury({ id: '20000000-0000-4000-8000-000000000006', note: '' }),
      injury({ id: '20000000-0000-4000-8000-000000000007', patterns: 'pas du json' }),
      injury({ id: '20000000-0000-4000-8000-000000000008', checkins: '{"a":1}' }),
      injury({ id: '20000000-0000-4000-8000-000000000009', muscle_id: 'x'.repeat(65) }),
      injury({ id: '20000000-0000-4000-8000-00000000000a', healed_on: 'hier' }),
    ];
    for (const row of bad) await expect(insert(db, 'injury', row), JSON.stringify(row)).rejects.toThrow();
    expect(await db.select('SELECT COUNT(*) AS n FROM injury')).toEqual([{ n: 2 }]);
    await db.close();
  });

  it('capture : insertion = ligne entière ; réponse au check-in = champ checkins ; garde : rien', async () => {
    const db = await freshDb();
    await insert(db, 'injury', injury());
    expect(await outbox(db)).toEqual([{ table_name: 'injury', row_id: U, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE injury SET checkins = ?, updated_at = ?, hlc = ? WHERE id = ?', ['[{"on":"2026-11-15","answer":"same"}]', AT, h(2), U]);
    expect(await outbox(db)).toEqual([{ table_name: 'injury', row_id: U, field: 'checkins' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('INSERT OR IGNORE INTO sync_guard (id) VALUES (1)');
    await db.execute('UPDATE injury SET status = ?, updated_at = ?, hlc = ? WHERE id = ?', ['healed', AT, h(3), U]);
    await db.execute('DELETE FROM sync_guard');
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });
});
