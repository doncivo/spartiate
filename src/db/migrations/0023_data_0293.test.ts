import { describe, expect, it } from 'vitest';
import { publishedColumns, SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { migration0023Data0293 } from './0023_data_0293';
import { migrations } from './index';

/**
 * DATA-0293 : migration 0023 (schéma 23), additive. Données synthétiques.
 * - `recovery_sample.utc_offset_min` (LOCALE, C-058, D-478) ;
 * - `workout_set.distance_m`, `added`, `corrected_from` (PUBLIÉES avec la séance close, sans déclencheur : modèle de la 0013) ;
 * - `progression_profile.config_overrides` (PUBLIÉE, déclencheur propre : modèle de la 0020).
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AT = '2026-11-24T18:00:00.000Z';
const u = (n: number): string => `7a1b0c2d-0000-4000-8000-${String(n).padStart(12, '0')}`;
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;

const dbAt = async (version: number): Promise<SqlDriver> => {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.filter((m) => m.version <= version));
  return db;
};
const workout = (db: SqlDriver, id: string) =>
  db.execute("INSERT INTO workout (id, name, started_at, source, notes, created_at, updated_at, device_id, hlc) VALUES (?, 'Séance', ?, 'empty', '', ?, ?, ?, ?)", [id, AT, AT, AT, DEV, h(1)]);
const wset = (db: SqlDriver, id: string, workoutId: string) =>
  db.execute("INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, created_at, updated_at, device_id, hlc) VALUES (?, ?, 'ex', 'Exercice', 0, 'work', ?, ?, ?, ?)", [id, workoutId, AT, AT, DEV, h(1)]);
const profile = (db: SqlDriver, exercise: string) =>
  db.execute('INSERT INTO progression_profile (id, exercise_id, engine_version, created_at, updated_at, device_id, hlc) VALUES (?, ?, 1, ?, ?, ?, ?)', [`progression|${exercise}`, exercise, AT, AT, DEV, h(1)]);
const outbox = async (db: SqlDriver, table: string): Promise<string[]> => (await db.select<{ field: string }>('SELECT field FROM sync_outbox WHERE table_name = ? ORDER BY field', [table])).map((r) => r.field);

describe('migration 0023 : data_0293 (DATA-0293)', () => {
  it('registre : 0001 à 0023 ; version 23, nom data_0293', () => {
    expect(migrations.slice(0, 23).map((m) => m.version)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(migrations[22]).toBe(migration0023Data0293);
    expect(migration0023Data0293.name).toBe('data_0293');
  });

  it('depuis la version 22 : lignes existantes intactes, colonnes nulles, rien de mis en file', async () => {
    const db = await dbAt(22);
    await workout(db, u(1));
    await wset(db, u(2), u(1));
    await profile(db, 'ex');
    await db.execute("INSERT INTO recovery_sample (type, start_at, end_at, value, source, imported_at) VALUES ('hrv', ?, ?, 50, 'Santé', ?)", [AT, AT, AT]);
    await db.execute('DELETE FROM sync_outbox');
    await migrate(db, migrations);
    expect(await db.select('SELECT distance_m, added, corrected_from FROM workout_set')).toEqual([{ distance_m: null, added: null, corrected_from: null }]);
    expect(await db.select('SELECT config_overrides FROM progression_profile')).toEqual([{ config_overrides: null }]);
    expect(await db.select('SELECT utc_offset_min FROM recovery_sample')).toEqual([{ utc_offset_min: null }]);
    expect(await db.select('SELECT 1 FROM sync_outbox')).toEqual([]);
  });

  it('contraintes : décalage ±840, distance >= 0, added 0 ou 1, corrigé 1 à 200 caractères, surcharges 2 à 512', async () => {
    const db = await dbAt(23);
    await workout(db, u(1));
    await wset(db, u(2), u(1));
    await profile(db, 'ex');
    let n = 0;
    const sample = (offset: number) => {
      n += 1;
      return db.execute("INSERT INTO recovery_sample (type, start_at, end_at, value, source, imported_at, utc_offset_min) VALUES ('hrv', ?, ?, 50, 'Santé', ?, ?)", [`2026-11-24T0${n}:00:00.000Z`, `2026-11-24T0${n}:00:00.000Z`, AT, offset]);
    };
    await expect(sample(841)).rejects.toThrow();
    await expect(sample(-841)).rejects.toThrow();
    await expect(sample(-840)).resolves.toBeDefined();
    await expect(sample(840)).resolves.toBeDefined();
    const set = (column: string, v: string | number) => db.execute(`UPDATE workout_set SET ${column} = ? WHERE id = ?`, [v, u(2)]);
    await expect(set('distance_m', -1)).rejects.toThrow();
    await expect(set('distance_m', 1500)).resolves.toBeDefined();
    await expect(set('added', 2)).rejects.toThrow();
    await expect(set('added', 1)).resolves.toBeDefined();
    await expect(set('corrected_from', '')).rejects.toThrow();
    await expect(set('corrected_from', 'x'.repeat(201))).rejects.toThrow();
    await expect(set('corrected_from', '{"reps":8}')).resolves.toBeDefined();
    await expect(db.execute('UPDATE progression_profile SET config_overrides = ?', ['x'])).rejects.toThrow();
    await expect(db.execute('UPDATE progression_profile SET config_overrides = ?', ['{"deloadLoad":0.9}'])).resolves.toBeDefined();
  });

  it('catalogue : colonnes publiées de workout_set et de progression_profile ; recovery_sample reste locale', () => {
    expect([...publishedColumns(SYNC_CATALOGUE.table('workout_set') as never)]).toEqual(expect.arrayContaining(['distance_m', 'added', 'corrected_from']));
    expect([...publishedColumns(SYNC_CATALOGUE.table('progression_profile') as never)]).toContain('config_overrides');
    expect(SYNC_CATALOGUE.table('recovery_sample')).toBeUndefined();
  });

  it('progression_profile : surcharges capturées champ par champ (déclencheur propre) ; garde de synchro : rien', async () => {
    const db = await dbAt(23);
    await profile(db, 'ex');
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('DELETE FROM sync_field_clock');
    await db.execute('UPDATE progression_profile SET config_overrides = ?, updated_at = ?, hlc = ? WHERE id = ?', ['{"deloadLoad":0.9}', AT, h(5), 'progression|ex']);
    expect(await outbox(db, 'progression_profile')).toEqual(['config_overrides']);
    expect(await db.select("SELECT hlc, base_hlc FROM sync_field_clock WHERE table_name = 'progression_profile' AND field = 'config_overrides'")).toEqual([{ hlc: h(5), base_hlc: h(1) }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await db.execute('UPDATE progression_profile SET config_overrides = NULL, hlc = ? WHERE id = ?', [h(6), 'progression|ex']);
    expect(await outbox(db, 'progression_profile')).toEqual([]);
  });

  it('workout_set : aucune capture des nouvelles colonnes sur une séance ouverte', async () => {
    const db = await dbAt(23);
    await workout(db, u(1));
    await wset(db, u(2), u(1));
    await db.execute('UPDATE workout_set SET added = 1, distance_m = 400, corrected_from = ? WHERE id = ?', ['{"reps":8}', u(2)]);
    expect(await outbox(db, 'workout_set')).toEqual([]);
  });
});
