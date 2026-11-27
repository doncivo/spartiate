import { describe, expect, it } from 'vitest';
import { SCHEMA_REPUBLISH } from '../../domain/sync/schemaRepublish';
import { publishedColumns, SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { migration0024WorkoutPause } from './0024_workout_pause';
import { migrations } from './index';

/**
 * SESS-0302 (BL-110, D-658, § 13.2) : migration 0024 (schéma 24), additive : `workout.paused_at` (début de la pause en cours, nul hors pause) et
 * `workout.paused_ms` (cumul des pauses terminées, entier >= 0, 0 par défaut), PUBLIÉES avec la séance close, sans déclencheur (modèle de la 0013 :
 * une séance ouverte n'est jamais publiée, la clôture met la ligne entière en file). Données synthétiques.
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AT = '2026-11-27T18:00:00.000Z';
const u = (n: number): string => `7a1b0c2d-0000-4000-8000-${String(n).padStart(12, '0')}`;
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;

const dbAt = async (version: number): Promise<SqlDriver> => {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.filter((m) => m.version <= version));
  return db;
};
const workout = (db: SqlDriver, id: string, endedAt: string | null = null) =>
  db.execute("INSERT INTO workout (id, name, started_at, ended_at, source, notes, created_at, updated_at, device_id, hlc) VALUES (?, 'Séance', ?, ?, 'empty', '', ?, ?, ?, ?)", [id, AT, endedAt, AT, AT, DEV, h(1)]);
const outbox = async (db: SqlDriver, table: string): Promise<string[]> => (await db.select<{ field: string }>('SELECT field FROM sync_outbox WHERE table_name = ? ORDER BY field', [table])).map((r) => r.field);

describe('migration 0024 : workout_pause (SESS-0302)', () => {
  it('registre : 0001 à 0024 ; version 24, nom workout_pause', () => {
    expect(migrations.slice(0, 24).map((m) => m.version)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(migrations[23]).toBe(migration0024WorkoutPause);
    expect(migration0024WorkoutPause.name).toBe('workout_pause');
  });

  it('BL-097 : seulement des colonnes ajoutées (aucune contrainte existante élargie, aucun déclencheur)', () => {
    for (const sql of migration0024WorkoutPause.statements) expect(sql.trim()).toMatch(/^ALTER TABLE workout ADD COLUMN /);
  });

  it('depuis la version 23 : séances ouvertes et closes intactes, pause nulle et cumul 0, rien de mis en file', async () => {
    const db = await dbAt(23);
    await workout(db, u(1));
    await workout(db, u(2), AT);
    await db.execute('DELETE FROM sync_outbox');
    const before = await db.select('SELECT id, name, started_at, ended_at, hlc FROM workout ORDER BY id');
    await migrate(db, migrations);
    expect(await db.select('SELECT id, name, started_at, ended_at, hlc FROM workout ORDER BY id')).toEqual(before);
    expect(await db.select('SELECT paused_at, paused_ms FROM workout ORDER BY id')).toEqual([
      { paused_at: null, paused_ms: 0 },
      { paused_at: null, paused_ms: 0 },
    ]);
    expect(await db.select('SELECT 1 FROM sync_outbox')).toEqual([]);
    expect(await db.select('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1')).toEqual([{ version: 24 }]);
    await db.close();
  });

  it('contraintes : cumul entier >= 0, jamais nul ; nouvelle ligne sans valeur : 0', async () => {
    const db = await dbAt(24);
    await workout(db, u(1));
    expect(await db.select('SELECT paused_ms FROM workout')).toEqual([{ paused_ms: 0 }]);
    await expect(db.execute('UPDATE workout SET paused_ms = -1')).rejects.toThrow();
    await expect(db.execute('UPDATE workout SET paused_ms = NULL')).rejects.toThrow();
    await expect(db.execute('UPDATE workout SET paused_ms = 90000, paused_at = ?', [AT])).resolves.toBeDefined();
    await db.close();
  });

  it('séance ouverte : pause et reprise jamais capturées ; clôture : la ligne entière part, avec le cumul', async () => {
    const db = await dbAt(24);
    await workout(db, u(1));
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE workout SET paused_at = ?, hlc = ? WHERE id = ?', [AT, h(2), u(1)]);
    await db.execute('UPDATE workout SET paused_at = NULL, paused_ms = 120000, hlc = ? WHERE id = ?', [h(3), u(1)]);
    expect(await outbox(db, 'workout')).toEqual([]);
    await db.execute('UPDATE workout SET ended_at = ?, hlc = ? WHERE id = ?', [AT, h(4), u(1)]);
    expect(await outbox(db, 'workout')).toEqual(['*']);
    await db.close();
  });

  it('catalogue : paused_at (instant, facultatif) et paused_ms (entier, obligatoire) publiés, masqués du journal des conflits ; workout republiée au schéma 24', () => {
    const t = SYNC_CATALOGUE.table('workout');
    if (!t) throw new Error('workout');
    expect([...publishedColumns(t)]).toEqual(expect.arrayContaining(['paused_at', 'paused_ms']));
    expect(t.columns.find((c) => c.name === 'paused_at')).toMatchObject({ type: 'datetime', nullable: true, conflictVisible: false });
    expect(t.columns.find((c) => c.name === 'paused_ms')).toMatchObject({ type: 'int', nullable: false, conflictVisible: false });
    expect(t.local).toEqual(['rest_timer_end_at', 'rest_timer_seconds']);
    expect(SCHEMA_REPUBLISH[24]).toEqual(['workout']);
  });
});
