import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { MigrationError, migrate, migrationChecksum, readAppliedMigrations } from '../migrator';
import { CAPTURE_TABLES_V1, migration0001SpartiateInit } from './0001_spartiate_init';
import { migrations as registry } from './index';

/** Cette suite pose la migration 0001 seule (publiée, immuable) ; le registre complet est testé par 0002_training.test.ts. */
const migrations = [migration0001SpartiateInit] as const;

const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-10-01T08:00:00.000Z';
const PROFILE = 'profile|singleton';
const WEIGHT = 'weight|2026-10-01|manual';

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations);
  return db;
}

const names = async (db: SqlDriver, type: string): Promise<string[]> =>
  (await db.select<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name`, [type])).map((r) => r.name);

const insertProfile = (db: SqlDriver, hlc = h(1)): Promise<unknown> =>
  db.execute('INSERT INTO profile (id, sex, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?)', [PROFILE, 'male', AT, AT, DEV, hlc]);
const insertWeight = (db: SqlDriver, hlc = h(1), id = WEIGHT, date = '2026-10-01', source = 'manual'): Promise<unknown> =>
  db.execute('INSERT INTO body_weight (id, date, kg, source, timezone, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, date, 82.4, source, 'Europe/Paris', AT, AT, DEV, hlc]);

const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');
const clocks = (db: SqlDriver) => db.select<{ row_id: string; field: string; hlc: string; base_hlc: string | null }>('SELECT row_id, field, hlc, base_hlc FROM sync_field_clock ORDER BY row_id, field');

describe('migration 0001 : base neuve Spartiate (SPA-001b, D-23, D-24, D-65)', () => {
  it('registre réinitialisé : la première migration est 0001, version 1, spartiate_init', () => {
    expect(registry[0]).toBe(migration0001SpartiateInit);
    expect(migration0001SpartiateInit.version).toBe(1);
    expect(migration0001SpartiateInit.name).toBe('spartiate_init');
  });

  it('base vide : douze tables techniques et deux tables métier, aucune table ancien projet', async () => {
    const db = await freshDb();
    expect(await names(db, 'table')).toEqual(
      [
        'body_weight',
        'conflict_log',
        'epoch_carry_report',
        'profile',
        'schema_migrations',
        'settings',
        'sync_field_clock',
        'sync_guard',
        'sync_meta',
        'sync_outbox',
        'sync_parked',
        'sync_state',
        'sync_tombstone',
        'sync_unknown',
      ].sort(),
    );
    await db.close();
  });

  it('index explicites et déclencheurs : exactement ceux du DDL figé', async () => {
    const db = await freshDb();
    expect(await names(db, 'index')).toEqual(
      [
        'idx_body_weight_date',
        'idx_conflict_log_detected_at',
        'idx_conflict_log_row',
        'idx_settings_hlc',
        'idx_sync_field_clock_hlc',
        'idx_sync_parked_reason',
        'idx_sync_parked_row',
        'idx_sync_tombstone_hlc',
      ].sort(),
    );
    expect(await names(db, 'trigger')).toEqual(['sync_body_weight_ai', 'sync_body_weight_au', 'sync_profile_ai', 'sync_profile_au']);
    const check = await db.select<{ integrity_check: string }>('PRAGMA integrity_check');
    expect(check).toEqual([{ integrity_check: 'ok' }]);
    await db.close();
  });

  it('colonnes de profile et body_weight : nullabilités et types exacts (NULL n’est pas zéro)', async () => {
    const db = await freshDb();
    const cols = async (table: string) =>
      (await db.select<{ name: string; type: string; notnull: number; pk: number }>(`PRAGMA table_info(${table})`)).map((c) => `${c.name}:${c.type}:${c.notnull}:${c.pk}`);
    expect(await cols('profile')).toEqual([
      'id:TEXT:1:1',
      'sex:TEXT:0:0',
      'birth_year:INTEGER:0:0',
      'height_cm:REAL:0:0',
      'goal:TEXT:0:0',
      'experience:TEXT:0:0',
      'units:TEXT:0:0',
      'created_at:TEXT:1:0',
      'updated_at:TEXT:1:0',
      'deleted_at:TEXT:0:0',
      'device_id:TEXT:1:0',
      'hlc:TEXT:1:0',
    ]);
    expect(await cols('body_weight')).toEqual([
      'id:TEXT:1:1',
      'date:TEXT:1:0',
      'kg:REAL:1:0',
      'source:TEXT:1:0',
      'timezone:TEXT:1:0',
      'health_uuid:TEXT:0:0',
      'measured_at:TEXT:0:0',
      'created_at:TEXT:1:0',
      'updated_at:TEXT:1:0',
      'deleted_at:TEXT:0:0',
      'device_id:TEXT:1:0',
      'hlc:TEXT:1:0',
    ]);
    await insertProfile(db);
    const [row] = await db.select<{ birth_year: number | null; height_cm: number | null }>('SELECT birth_year, height_cm FROM profile');
    expect(row).toEqual({ birth_year: null, height_cm: null });
    await db.close();
  });

  it('identités naturelles et CHECK : id discordant, singleton, kg et source rejetés ; deux sources distinctes admises', async () => {
    const db = await freshDb();
    await expect(db.execute('INSERT INTO profile (id, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?)', ['4f1c0a3e-0000-4000-8000-000000000000', AT, AT, DEV, h(1)])).rejects.toThrow();
    await insertProfile(db);
    await expect(insertProfile(db, h(2))).rejects.toThrow();
    await expect(insertWeight(db, h(1), '4f1c0a3e-0000-4000-8000-000000000000')).rejects.toThrow();
    await expect(insertWeight(db, h(1), 'weight|2026-10-02|manual', '2026-10-01')).rejects.toThrow();
    await expect(insertWeight(db, h(1), 'weight|2026-10-01|scale', '2026-10-01', 'scale')).rejects.toThrow();
    await expect(db.execute('INSERT INTO body_weight (id, date, kg, source, timezone, created_at, updated_at, device_id, hlc) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?)', [WEIGHT, '2026-10-01', 'manual', 'Europe/Paris', AT, AT, DEV, h(1)])).rejects.toThrow();
    await insertWeight(db);
    await expect(insertWeight(db, h(2))).rejects.toThrow();
    await insertWeight(db, h(2), 'weight|2026-10-01|health', '2026-10-01', 'health');
    expect((await db.select('SELECT id FROM body_weight')).length).toBe(2);
    await db.close();
  });

  it('relance sans effet ; somme de contrôle stable', async () => {
    const db = await freshDb();
    expect((await migrate(db, migrations)).applied).toEqual([]);
    const applied = await readAppliedMigrations(db);
    expect(applied.map((a) => [a.version, a.name, a.checksum])).toEqual([[1, 'spartiate_init', migrationChecksum(migration0001SpartiateInit)]]);
    await db.close();
  });

  it('une base au schéma 19 (ancien projet) est refusée sans altération (D-54)', async () => {
    const db = await openSqliteWasmDriver();
    await db.execute('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)');
    for (let v = 1; v <= 19; v += 1) await db.execute('INSERT INTO schema_migrations VALUES (?, ?, ?, ?)', [v, `ancienne_${String(v)}`, '00000000', AT]);
    await db.execute('CREATE TABLE task (id TEXT PRIMARY KEY, title TEXT)');
    await db.execute("INSERT INTO task VALUES ('a', 'Facture')");
    const before = await db.select('SELECT name FROM sqlite_master ORDER BY name');
    await expect(migrate(db, migrations)).rejects.toBeInstanceOf(MigrationError);
    expect(await db.select('SELECT name FROM sqlite_master ORDER BY name')).toEqual(before);
    expect(await db.select('SELECT * FROM task')).toEqual([{ id: 'a', title: 'Facture' }]);
    expect((await readAppliedMigrations(db)).length).toBe(19);
    await db.close();
  });

  it('une somme de contrôle divergente est refusée', async () => {
    const db = await freshDb();
    await db.execute("UPDATE schema_migrations SET checksum = 'deadbeef' WHERE version = 1");
    await expect(migrate(db, migrations)).rejects.toBeInstanceOf(MigrationError);
    await db.close();
  });

  it('APP_SCHEMA_VERSION côté Rust vaut la plus haute version du registre', () => {
    const rust = readFileSync('src-tauri/src/backup.rs', 'utf8');
    const highest = Math.max(...registry.map((m) => m.version));
    expect(rust).toMatch(new RegExp(`APP_SCHEMA_VERSION:\\s*u32\\s*=\\s*${String(highest)};`));
  });

  it('la copie figée de capture porte exactement les colonnes publiées de profile et body_weight', () => {
    expect(CAPTURE_TABLES_V1.map(([t, cols]) => `${t}|${cols.join(',')}`)).toEqual([
      'profile|sex,birth_year,height_cm,goal,experience,units,created_at,deleted_at',
      'body_weight|date,kg,source,timezone,health_uuid,measured_at,created_at,deleted_at',
    ]);
  });

  describe('capture (déclencheurs)', () => {
    it('INSERT : une entrée « * » et aucune horloge de champ ; la trace locale est retirée', async () => {
      const db = await freshDb();
      await db.execute('INSERT INTO sync_tombstone (table_name, row_id, deleted_hlc, purged_at) VALUES (?, ?, ?, ?)', ['body_weight', WEIGHT, h(1), AT]);
      await insertWeight(db);
      expect(await outbox(db)).toEqual([{ table_name: 'body_weight', row_id: WEIGHT, field: '*' }]);
      expect(await clocks(db)).toEqual([]);
      expect(await db.select('SELECT * FROM sync_tombstone')).toEqual([]);
      await db.close();
    });

    it('UPDATE sans changement de valeur : aucune entrée ; changement NULL → valeur et valeur → NULL : une entrée par champ, repli « * » à l’ancien hlc', async () => {
      const db = await freshDb();
      await insertProfile(db);
      await db.execute('DELETE FROM sync_outbox');
      await db.execute('UPDATE profile SET sex = ?, hlc = ? WHERE id = ?', ['male', h(2), PROFILE]);
      expect(await outbox(db)).toEqual([]);
      await db.execute('UPDATE profile SET height_cm = ?, hlc = ? WHERE id = ?', [181.5, h(3), PROFILE]);
      expect(await outbox(db)).toEqual([{ table_name: 'profile', row_id: PROFILE, field: 'height_cm' }]);
      expect(await clocks(db)).toEqual([
        { row_id: PROFILE, field: '*', hlc: h(1), base_hlc: null },
        { row_id: PROFILE, field: 'height_cm', hlc: h(3), base_hlc: h(1) },
      ]);
      await db.execute('UPDATE profile SET height_cm = NULL, hlc = ? WHERE id = ?', [h(4), PROFILE]);
      const height = (await clocks(db)).find((c) => c.field === 'height_cm');
      expect(height).toEqual({ row_id: PROFILE, field: 'height_cm', hlc: h(4), base_hlc: h(1) });
      await db.close();
    });

    it('nouvelle écriture pendant la publication : numéro de séquence neuf ; base_hlc stable tant que la file n’est pas vidée', async () => {
      const db = await freshDb();
      await insertWeight(db);
      await db.execute('DELETE FROM sync_outbox');
      await db.execute('UPDATE body_weight SET kg = ?, hlc = ? WHERE id = ?', [82, h(2), WEIGHT]);
      const [first] = await db.select<{ seq: number }>("SELECT seq FROM sync_outbox WHERE field = 'kg'");
      await db.execute('UPDATE body_weight SET kg = ?, hlc = ? WHERE id = ?', [81, h(3), WEIGHT]);
      const [second] = await db.select<{ seq: number }>("SELECT seq FROM sync_outbox WHERE field = 'kg'");
      expect((second as { seq: number }).seq).toBeGreaterThan((first as { seq: number }).seq);
      const kg = (await clocks(db)).find((c) => c.field === 'kg');
      expect(kg).toEqual({ row_id: WEIGHT, field: 'kg', hlc: h(3), base_hlc: h(1) });
      await db.close();
    });

    it('suppression logique : deleted_at est un champ ; restauration : entrée « + » ; aucun déclencheur DELETE', async () => {
      const db = await freshDb();
      await insertWeight(db);
      await db.execute('DELETE FROM sync_outbox');
      await db.execute('UPDATE body_weight SET deleted_at = ?, hlc = ? WHERE id = ?', [AT, h(2), WEIGHT]);
      expect((await outbox(db)).map((o) => o.field)).toEqual(['deleted_at']);
      await db.execute('UPDATE body_weight SET deleted_at = NULL, hlc = ? WHERE id = ?', [h(3), WEIGHT]);
      expect((await outbox(db)).map((o) => o.field).sort()).toEqual(['+', 'deleted_at']);
      const triggers = await db.select<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'trigger'");
      expect(triggers.some((t) => /AFTER DELETE/i.test(t.sql))).toBe(false);
      await db.close();
    });

    it('sous sync_guard : ni horloge ni file d’envoi ; rollback ne laisse ni garde ni trace', async () => {
      const db = await freshDb();
      await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
      await insertProfile(db);
      await db.execute('UPDATE profile SET sex = ?, hlc = ? WHERE id = ?', ['female', h(2), PROFILE]);
      expect(await outbox(db)).toEqual([]);
      expect(await clocks(db)).toEqual([]);
      await db.execute('DELETE FROM sync_guard');
      await expect(
        db.transaction(async (tx) => {
          await tx.execute('INSERT INTO sync_guard (id) VALUES (1)');
          await tx.execute('UPDATE profile SET goal = ? WHERE id = ?', ['gain', PROFILE]);
          throw new Error('échec');
        }),
      ).rejects.toThrow('échec');
      expect(await db.select('SELECT * FROM sync_guard')).toEqual([]);
      expect((await db.select<{ goal: string | null }>('SELECT goal FROM profile'))[0]?.goal).toBeNull();
      expect(await outbox(db)).toEqual([]);
      await db.close();
    });
  });
});
