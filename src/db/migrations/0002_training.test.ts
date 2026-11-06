import { describe, expect, it } from 'vitest';
import { SYNC_CATALOGUE, publishedColumns } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate, migrationChecksum, readAppliedMigrations } from '../migrator';
import { migration0001SpartiateInit } from './0001_spartiate_init';
import { CAPTURE_TABLES_V2, migration0002Training } from './0002_training';
import { migrations } from './index';

/** I1-01 : migration 0002 (exercices personnalisés, profils de matériel, routines), D-71, P-09. */

const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-10-01T08:00:00.000Z';
const EX = '4d3c2b1a-0000-4000-8000-000000000001';
const ROUTINE = '4d3c2b1a-0000-4000-8000-0000000000a1';
const DAY = '4d3c2b1a-0000-4000-8000-0000000000b1';
const LINE = '4d3c2b1a-0000-4000-8000-0000000000c1';
const EQUIP = '4d3c2b1a-0000-4000-8000-0000000000d1';

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations);
  return db;
}

const names = async (db: SqlDriver, type: string): Promise<string[]> =>
  (await db.select<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name`, [type])).map((r) => r.name);

const cols = async (db: SqlDriver, table: string): Promise<string[]> =>
  (await db.select<{ name: string; type: string; notnull: number; pk: number }>(`PRAGMA table_info(${table})`)).map((c) => `${c.name}:${c.type}:${c.notnull}:${c.pk}`);

const COMMON = ['created_at:TEXT:1:0', 'updated_at:TEXT:1:0', 'deleted_at:TEXT:0:0', 'device_id:TEXT:1:0', 'hlc:TEXT:1:0'];

const insertExercise = (db: SqlDriver, id = EX, hlc = h(1)): Promise<unknown> =>
  db.execute(
    `INSERT INTO exercise (id, name_fr, aliases_en, muscles, equipment, pattern, kind, metric, bodyweight_fraction, default_rep_min, default_rep_max, default_rest_sec,
       instructions, media, strength_standard_key, schema_version, created_at, updated_at, device_id, hlc)
     VALUES (?, 'Tirage maison', '[]', '[{"id":"lats","weight":1}]', '["dumbbell"]', 'pull-vertical', 'compound', 'load-reps', NULL, 8, 12, 90, '{"setup":"","execution":"","mistakes":[]}', NULL, NULL, 1, ?, ?, ?, ?)`,
    [id, AT, AT, DEV, hlc],
  );
const insertRoutine = (db: SqlDriver, id = ROUTINE, hlc = h(1)): Promise<unknown> =>
  db.execute("INSERT INTO routine (id, name, mode, created_at, updated_at, device_id, hlc) VALUES (?, 'Haut / Bas', 'programme', ?, ?, ?, ?)", [id, AT, AT, DEV, hlc]);
const insertDay = (db: SqlDriver, id = DAY, routineId = ROUTINE, hlc = h(1)): Promise<unknown> =>
  db.execute("INSERT INTO routine_day (id, routine_id, name, day_order, created_at, updated_at, device_id, hlc) VALUES (?, ?, 'Haut A', 0, ?, ?, ?, ?)", [id, routineId, AT, AT, DEV, hlc]);
const insertLine = (db: SqlDriver, exerciseId: string, id = LINE, dayId = DAY, hlc = h(1)): Promise<unknown> =>
  db.execute(
    "INSERT INTO routine_exercise (id, routine_day_id, exercise_id, exercise_name, sets, rep_min, rep_max, rir, rest_sec, position, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, 'Nom figé', 3, 6, 10, 2, 150, 0, ?, ?, ?, ?)",
    [id, dayId, exerciseId, AT, AT, DEV, hlc],
  );
const insertEquipment = (db: SqlDriver, id = EQUIP, hlc = h(1)): Promise<unknown> =>
  db.execute("INSERT INTO equipment_profile (id, name, kind, inventory, increments, created_at, updated_at, device_id, hlc) VALUES (?, 'Salle', 'salle', '{}', '{}', ?, ?, ?, ?)", [id, AT, AT, DEV, hlc]);

const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');

describe('migration 0002 : training (I1-01, D-71, P-09)', () => {
  it('registre : 0001 puis 0002 (version 2, training) ; 0001 inchangée', () => {
    expect(migrations).toEqual([migration0001SpartiateInit, migration0002Training]);
    expect(migration0002Training.version).toBe(2);
    expect(migration0002Training.name).toBe('training');
  });

  it('base vide : cinq tables ajoutées, ni workout ni workout_set (migration 0003)', async () => {
    const db = await freshDb();
    const tables = await names(db, 'table');
    for (const t of ['exercise', 'equipment_profile', 'routine', 'routine_day', 'routine_exercise']) expect(tables).toContain(t);
    for (const t of ['workout', 'workout_set', 'mesocycle', 'recommendation_decision']) expect(tables).not.toContain(t);
    await db.close();
  });

  it('index explicites ajoutés et dix déclencheurs de capture ajoutés', async () => {
    const db = await freshDb();
    const indexes = await names(db, 'index');
    for (const i of ['idx_routine_day_routine', 'idx_routine_exercise_day', 'idx_routine_exercise_exercise']) expect(indexes).toContain(i);
    const triggers = await names(db, 'trigger');
    for (const t of ['exercise', 'equipment_profile', 'routine', 'routine_day', 'routine_exercise']) {
      expect(triggers).toContain(`sync_${t}_ai`);
      expect(triggers).toContain(`sync_${t}_au`);
    }
    expect(triggers).toHaveLength(14);
    expect(await db.select('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    await db.close();
  });

  it('colonnes exactes des cinq tables (types, nullabilités)', async () => {
    const db = await freshDb();
    expect(await cols(db, 'exercise')).toEqual([
      'id:TEXT:1:1',
      'name_fr:TEXT:1:0',
      'aliases_en:TEXT:1:0',
      'muscles:TEXT:1:0',
      'equipment:TEXT:1:0',
      'pattern:TEXT:1:0',
      'kind:TEXT:1:0',
      'metric:TEXT:1:0',
      'bodyweight_fraction:REAL:0:0',
      'default_rep_min:INTEGER:1:0',
      'default_rep_max:INTEGER:1:0',
      'default_rest_sec:INTEGER:1:0',
      'instructions:TEXT:1:0',
      'media:TEXT:0:0',
      'strength_standard_key:TEXT:0:0',
      'is_custom:INTEGER:1:0',
      'schema_version:INTEGER:1:0',
      ...COMMON,
    ]);
    expect(await cols(db, 'equipment_profile')).toEqual(['id:TEXT:1:1', 'name:TEXT:1:0', 'kind:TEXT:1:0', 'inventory:TEXT:1:0', 'increments:TEXT:1:0', ...COMMON]);
    expect(await cols(db, 'routine')).toEqual(['id:TEXT:1:1', 'name:TEXT:1:0', 'mode:TEXT:1:0', ...COMMON]);
    expect(await cols(db, 'routine_day')).toEqual(['id:TEXT:1:1', 'routine_id:TEXT:1:0', 'name:TEXT:1:0', 'day_order:INTEGER:1:0', ...COMMON]);
    expect(await cols(db, 'routine_exercise')).toEqual([
      'id:TEXT:1:1',
      'routine_day_id:TEXT:1:0',
      'exercise_id:TEXT:1:0',
      'exercise_name:TEXT:1:0',
      'sets:INTEGER:1:0',
      'rep_min:INTEGER:1:0',
      'rep_max:INTEGER:1:0',
      'rir:INTEGER:0:0',
      'rest_sec:INTEGER:1:0',
      'position:INTEGER:1:0',
      ...COMMON,
    ]);
    await db.close();
  });

  it('0001 → 0002 sur données synthétiques, clés étrangères actives : profil et pesée conservés, aucune violation', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, [migration0001SpartiateInit]);
    expect(await db.select('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
    await db.execute("INSERT INTO profile (id, sex, created_at, updated_at, device_id, hlc) VALUES ('profile|singleton', 'male', ?, ?, ?, ?)", [AT, AT, DEV, h(1)]);
    await db.execute(
      "INSERT INTO body_weight (id, date, kg, source, timezone, created_at, updated_at, device_id, hlc) VALUES ('weight|2026-10-01|manual', '2026-10-01', 82.4, 'manual', 'Europe/Paris', ?, ?, ?, ?)",
      [AT, AT, DEV, h(1)],
    );
    const before = await db.select('SELECT * FROM sync_outbox ORDER BY seq');
    const report = await migrate(db, migrations);
    expect(report.applied).toEqual([2]);
    expect(await db.select('SELECT sex FROM profile')).toEqual([{ sex: 'male' }]);
    expect(await db.select('SELECT kg FROM body_weight')).toEqual([{ kg: 82.4 }]);
    expect(await db.select('SELECT * FROM sync_outbox ORDER BY seq')).toEqual(before);
    expect(await db.select('PRAGMA foreign_key_check')).toEqual([]);
    expect(await db.select('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
    const applied = await readAppliedMigrations(db);
    expect(applied.map((a) => [a.version, a.name, a.checksum])).toEqual([
      [1, 'spartiate_init', migrationChecksum(migration0001SpartiateInit)],
      [2, 'training', migrationChecksum(migration0002Training)],
    ]);
    await db.close();
  });

  it('références logiques (P-09) : aucune clé étrangère vers exercise ; une ligne référence un exercice embarqué absent de la table', async () => {
    const db = await freshDb();
    expect(await db.select('PRAGMA foreign_key_list(exercise)')).toEqual([]);
    expect(await db.select('PRAGMA foreign_key_list(equipment_profile)')).toEqual([]);
    const fks = await db.select<{ table: string; from: string; on_delete: string }>('PRAGMA foreign_key_list(routine_exercise)');
    expect(fks.map((f) => `${f.from}->${f.table}`)).toEqual(['routine_day_id->routine_day']);
    await insertRoutine(db);
    await insertDay(db);
    await insertLine(db, 'bench-press-barbell');
    expect(await db.select('SELECT exercise_id FROM routine_exercise')).toEqual([{ exercise_id: 'bench-press-barbell' }]);
    expect(await db.select('SELECT 1 FROM exercise')).toEqual([]);
    await insertLine(db, '4d3c2b1a-0000-4000-8000-0000000000ff', '4d3c2b1a-0000-4000-8000-0000000000c2');
    expect(await db.select('PRAGMA foreign_key_check')).toEqual([]);
    await db.close();
  });

  it('clés étrangères parent-enfant actives, sans CASCADE ni SET NULL', async () => {
    const db = await freshDb();
    await expect(insertDay(db)).rejects.toThrow();
    await insertRoutine(db);
    await insertDay(db);
    await expect(insertLine(db, 'x', LINE, '4d3c2b1a-0000-4000-8000-0000000000ee')).rejects.toThrow();
    await insertLine(db, 'bench-press-barbell');
    await expect(db.execute('DELETE FROM routine WHERE id = ?', [ROUTINE])).rejects.toThrow();
    await expect(db.execute('DELETE FROM routine_day WHERE id = ?', [DAY])).rejects.toThrow();
    const ddl = await db.select<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name IN ('exercise', 'equipment_profile', 'routine', 'routine_day', 'routine_exercise')");
    expect(ddl.some((t) => /CASCADE|SET NULL/i.test(t.sql))).toBe(false);
    await db.close();
  });

  it('suppression d’un exercice personnalisé (logique ou physique) : les lignes qui le référencent restent intactes', async () => {
    const db = await freshDb();
    await insertExercise(db);
    await insertRoutine(db);
    await insertDay(db);
    await insertLine(db, EX);
    await db.execute('UPDATE exercise SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(2), EX]);
    await db.execute('DELETE FROM exercise WHERE id = ?', [EX]);
    expect(await db.select('SELECT exercise_id, exercise_name FROM routine_exercise')).toEqual([{ exercise_id: EX, exercise_name: 'Nom figé' }]);
    await db.close();
  });

  it('CHECK : is_custom vaut 1, plages de répétitions et de séries cohérentes', async () => {
    const db = await freshDb();
    await insertExercise(db);
    await expect(db.execute('UPDATE exercise SET is_custom = 0 WHERE id = ?', [EX])).rejects.toThrow();
    await expect(db.execute('UPDATE exercise SET default_rep_min = 12, default_rep_max = 8 WHERE id = ?', [EX])).rejects.toThrow();
    await insertRoutine(db);
    await insertDay(db);
    await expect(db.execute('UPDATE routine_day SET day_order = -1 WHERE id = ?', [DAY])).rejects.toThrow();
    await insertLine(db, 'bench-press-barbell');
    await expect(db.execute('UPDATE routine_exercise SET sets = 0 WHERE id = ?', [LINE])).rejects.toThrow();
    await expect(db.execute('UPDATE routine_exercise SET rep_min = 11, rep_max = 10 WHERE id = ?', [LINE])).rejects.toThrow();
    await expect(db.execute('UPDATE routine_exercise SET rest_sec = -1 WHERE id = ?', [LINE])).rejects.toThrow();
    await db.close();
  });

  it('copie figée de capture : exactement les colonnes publiées du catalogue de production', () => {
    for (const [table, columns] of CAPTURE_TABLES_V2) {
      const t = SYNC_CATALOGUE.table(table);
      expect(t, table).toBeDefined();
      if (t) expect([...columns]).toEqual([...publishedColumns(t)]);
    }
    expect(CAPTURE_TABLES_V2.map(([t]) => t)).toEqual(['exercise', 'equipment_profile', 'routine', 'routine_day', 'routine_exercise']);
  });

  describe('capture (déclencheurs)', () => {
    it('INSERT des cinq tables : une entrée « * » chacune, la tombstone locale de l’identifiant est retirée', async () => {
      const db = await freshDb();
      await db.execute('INSERT INTO sync_tombstone (table_name, row_id, deleted_hlc, purged_at) VALUES (?, ?, ?, ?)', ['exercise', EX, h(1), AT]);
      await insertExercise(db);
      await insertEquipment(db);
      await insertRoutine(db);
      await insertDay(db);
      await insertLine(db, 'bench-press-barbell');
      expect(await outbox(db)).toEqual([
        { table_name: 'exercise', row_id: EX, field: '*' },
        { table_name: 'equipment_profile', row_id: EQUIP, field: '*' },
        { table_name: 'routine', row_id: ROUTINE, field: '*' },
        { table_name: 'routine_day', row_id: DAY, field: '*' },
        { table_name: 'routine_exercise', row_id: LINE, field: '*' },
      ]);
      expect(await db.select('SELECT * FROM sync_tombstone')).toEqual([]);
      await db.close();
    });

    it('UPDATE : une entrée par colonne publiée modifiée avec base_hlc ; la colonne locale is_custom et les champs identiques n’en créent pas', async () => {
      const db = await freshDb();
      await insertExercise(db);
      await db.execute('DELETE FROM sync_outbox');
      await db.execute("UPDATE exercise SET name_fr = 'Tirage maison', hlc = ? WHERE id = ?", [h(2), EX]);
      expect(await outbox(db)).toEqual([]);
      await db.execute("UPDATE exercise SET name_fr = 'Tirage lesté', default_rest_sec = 120, hlc = ? WHERE id = ?", [h(3), EX]);
      expect((await outbox(db)).map((o) => o.field).sort()).toEqual(['default_rest_sec', 'name_fr']);
      const clock = await db.select<{ field: string; hlc: string; base_hlc: string | null }>("SELECT field, hlc, base_hlc FROM sync_field_clock WHERE row_id = ? AND field IN ('name_fr', '*') ORDER BY field", [EX]);
      expect(clock).toEqual([
        { field: '*', hlc: h(1), base_hlc: null },
        { field: 'name_fr', hlc: h(3), base_hlc: h(1) },
      ]);
      await db.close();
    });

    it('suppression logique puis restauration : deleted_at puis « + » (routine, jour, ligne, profil de matériel)', async () => {
      const db = await freshDb();
      await insertRoutine(db);
      await insertDay(db);
      await insertLine(db, 'row-barbell');
      await insertEquipment(db);
      await db.execute('DELETE FROM sync_outbox');
      for (const [table, id] of [['routine_exercise', LINE], ['routine_day', DAY], ['routine', ROUTINE], ['equipment_profile', EQUIP]] as const) {
        await db.execute(`UPDATE ${table} SET deleted_at = ?, hlc = ? WHERE id = ?`, [AT, h(2), id]);
      }
      expect((await outbox(db)).map((o) => `${o.table_name}:${o.field}`).sort()).toEqual([
        'equipment_profile:deleted_at',
        'routine:deleted_at',
        'routine_day:deleted_at',
        'routine_exercise:deleted_at',
      ]);
      await db.execute('UPDATE routine SET deleted_at = NULL, hlc = ? WHERE id = ?', [h(3), ROUTINE]);
      expect((await outbox(db)).filter((o) => o.table_name === 'routine').map((o) => o.field).sort()).toEqual(['+', 'deleted_at']);
      const triggers = await db.select<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'");
      expect(triggers.some((t) => /AFTER DELETE/i.test(t.sql))).toBe(false);
      await db.close();
    });

    it('sous sync_guard : ni horloge ni file d’envoi pour les nouvelles tables', async () => {
      const db = await freshDb();
      await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
      await insertExercise(db);
      await insertRoutine(db);
      await db.execute('UPDATE routine SET name = ?, hlc = ? WHERE id = ?', ['Autre', h(2), ROUTINE]);
      expect(await outbox(db)).toEqual([]);
      expect(await db.select('SELECT * FROM sync_field_clock')).toEqual([]);
      await db.close();
    });

    it('aucune colonne locale dans un déclencheur (is_custom)', async () => {
      const db = await freshDb();
      const triggers = await db.select<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'exercise'");
      expect(triggers).toHaveLength(2);
      expect(triggers.some((t) => /is_custom/.test(t.sql))).toBe(false);
      await db.close();
    });
  });

  it('relance sans effet', async () => {
    const db = await freshDb();
    expect((await migrate(db, migrations)).applied).toEqual([]);
    await db.close();
  });
});
