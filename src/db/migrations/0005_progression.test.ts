import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate, migrationChecksum, readAppliedMigrations } from '../migrator';
import { migration0005Progression } from './0005_progression';
import { migrations } from './index';

/** I2-01 : migration 0005 (progression_profile, recommendation_decision), tables locales en 0.3.0, sans capture de synchro (publiées par la 0006). */

const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const HLC = `000000000000001-0000-${DEV}`;
const AT = '2026-11-07T18:00:00.000Z';
const W = '5e1a0c2d-0000-4000-8000-000000000001';
const D = '5e1a0c2d-0000-4000-8000-0000000000d1';

/** Base arrêtée à la 0005 (0.3.0) : la 0006 ajoute la publication. */
const V5 = migrations.slice(0, 5);
async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, V5);
  return db;
}

const insertProfile = (db: SqlDriver, over: Record<string, unknown> = {}): Promise<unknown> => {
  const row = { id: 'progression|bench-press-barbell', exercise_id: 'bench-press-barbell', estimated_1rm_kg: 80, confidence: 0.5, last_easy_recalibration_at: null, engine_version: 1, ...over };
  return db.execute(
    `INSERT INTO progression_profile (id, exercise_id, estimated_1rm_kg, confidence, last_easy_recalibration_at, engine_version, created_at, updated_at, device_id, hlc)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.exercise_id, row.estimated_1rm_kg, row.confidence, row.last_easy_recalibration_at, row.engine_version, AT, AT, DEV, HLC] as never,
  );
};
const insertDecision = (db: SqlDriver, over: Record<string, unknown> = {}): Promise<unknown> => {
  const row = { id: D, accepted: 1, chosen_load_kg: 62.5, prescription: '{}', reasons: '[]', chosen_reps: '[8,8,8]', ...over };
  return db.execute(
    `INSERT INTO recommendation_decision (id, exercise_id, workout_id, workout_set_id, engine_version, prescription, reasons, accepted, chosen_load_kg, chosen_reps, decided_at, created_at, updated_at, device_id, hlc)
     VALUES (?, 'bench-press-barbell', ?, NULL, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, W, row.prescription, row.reasons, row.accepted, row.chosen_load_kg, row.chosen_reps, AT, AT, AT, DEV, HLC] as never,
  );
};
const technical = async (db: SqlDriver): Promise<unknown[]> => [
  ...(await db.select('SELECT * FROM sync_outbox')),
  ...(await db.select('SELECT * FROM sync_field_clock')),
  ...(await db.select('SELECT * FROM sync_tombstone')),
];

describe('migration 0005 : progression (I2-01)', () => {
  it('registre : 0005 suit 0001 à 0004 (0006 ensuite, PR 2/2) ; version 5, nom progression', () => {
    expect(V5.map((m) => m.version)).toEqual([1, 2, 3, 4, 5]);
    expect(migrations[4]).toBe(migration0005Progression);
    expect(migration0005Progression.name).toBe('progression');
  });

  it('0004 → 0005 : séances conservées, aucune capture rétroactive, aucune violation de clé étrangère', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, 4));
    await db.execute(`INSERT INTO workout (id, name, started_at, ended_at, source, created_at, updated_at, device_id, hlc) VALUES (?, 'Haut A', ?, NULL, 'empty', ?, ?, ?, ?)`, [W, AT, AT, AT, DEV, HLC]);
    const report = await migrate(db, V5);
    expect(report.applied).toEqual([5]);
    expect(await db.select('SELECT id FROM workout')).toEqual([{ id: W }]);
    expect(await technical(db)).toEqual([]);
    expect(await db.select('PRAGMA foreign_key_check')).toEqual([]);
    expect((await readAppliedMigrations(db)).at(-1)).toMatchObject({ version: 5, name: 'progression', checksum: migrationChecksum(migration0005Progression) });
    await db.close();
  });

  it('progression_profile : identifiant naturel progression|<exercice>, une ligne par exercice, bornes vérifiées', async () => {
    const db = await freshDb();
    await insertProfile(db);
    expect(await db.select('SELECT id, exercise_id, estimated_1rm_kg, confidence FROM progression_profile')).toEqual([
      { id: 'progression|bench-press-barbell', exercise_id: 'bench-press-barbell', estimated_1rm_kg: 80, confidence: 0.5 },
    ]);
    await expect(insertProfile(db)).rejects.toThrow();
    await expect(insertProfile(db, { id: 'progression|squat-barbell' })).rejects.toThrow();
    await expect(insertProfile(db, { id: '5e1a0c2d-0000-4000-8000-0000000000aa', exercise_id: 'row-barbell' })).rejects.toThrow();
    for (const bad of [{ confidence: 1.01 }, { confidence: -0.1 }, { estimated_1rm_kg: 0 }, { engine_version: 0 }]) {
      await expect(insertProfile(db, { id: 'progression|row-barbell', exercise_id: 'row-barbell', ...bad })).rejects.toThrow();
    }
    await insertProfile(db, { id: 'progression|row-barbell', exercise_id: 'row-barbell', estimated_1rm_kg: null, confidence: null });
    expect(await db.select('SELECT COUNT(*) AS n FROM progression_profile')).toEqual([{ n: 2 }]);
    await db.close();
  });

  it('recommendation_decision : accepted 0/1, charge ≥ 0 (JSON validé par le repository) ; index par exercice et date', async () => {
    const db = await freshDb();
    await insertDecision(db);
    for (const bad of [{ accepted: 2 }, { chosen_load_kg: -1 }, { prescription: null }, { chosen_reps: null }]) {
      await expect(insertDecision(db, { id: '5e1a0c2d-0000-4000-8000-0000000000d2', ...bad })).rejects.toThrow();
    }
    await insertDecision(db, { id: '5e1a0c2d-0000-4000-8000-0000000000d3', chosen_load_kg: null });
    expect(await db.select("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'recommendation_decision' AND name LIKE 'idx_%'")).toEqual([{ name: 'idx_recommendation_decision_exercise' }]);
    await db.close();
  });

  it('tables locales en 0.3.0 : aucun déclencheur, aucune écriture dans les tables de synchro (catalogue de la 0.3.1 : migration 0006)', async () => {
    const db = await freshDb();
    expect(await db.select("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name IN ('progression_profile', 'recommendation_decision')")).toEqual([]);
    await insertProfile(db);
    await insertDecision(db);
    await db.execute("UPDATE progression_profile SET confidence = 0.7, deleted_at = ? WHERE id = 'progression|bench-press-barbell'", [AT]);
    expect(await technical(db)).toEqual([]);
    await db.close();
  });
});
