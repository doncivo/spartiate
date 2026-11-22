import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V21, migration0021ExclusionInjury } from './0021_exclusion_injury';
import { migrations } from './index';

/**
 * SYNC-0291 (BL-109, D-447) : migration 0021 (schéma 21) — `exercise_exclusion`, exercices écartés (« ne plus proposer »), PUBLIÉS et écrits par les
 * deux appareils. Tables NEUVES ; AUCUNE table existante n'est modifiée ; aucune donnée migrée en SQL (la reprise du réglage local
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
    expect(migrations.map((m) => m.version)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
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
    expect(after.filter((r) => !beforeNames.has(r.name)).map((r) => r.name).sort()).toEqual(['exercise_exclusion', 'sync_exercise_exclusion_ai', 'sync_exercise_exclusion_au']);
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
