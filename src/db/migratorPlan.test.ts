import { describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../domain/clock';
import { openSqliteWasmDriver } from './drivers/sqliteWasm';
import { latestVersion, migrate, migrationChecksum, MigrationError, SchemaNewerThanApp, type Migration, type MigrationPlan } from './migrator';

/**
 * DATA-0292 (bundle de départ) : le migrateur accepte un PLAN (version, nom, somme de contrôle de chaque migration) et ne charge les instructions
 * (`load`) que s'il y a du travail. Une base à jour n'en exécute aucune : le départ n'embarque plus le SQL de 0001 à la dernière.
 */
const m1: Migration = { version: 1, name: 'un', statements: ['CREATE TABLE a (id INTEGER)'] };
const m2: Migration = { version: 2, name: 'deux', statements: ['CREATE TABLE b (id INTEGER)'] };
const planOf = (migrations: readonly Migration[], load: () => Promise<readonly Migration[]>): MigrationPlan => ({
  entries: migrations.map((m) => ({ version: m.version, name: m.name, checksum: migrationChecksum(m) })),
  load,
});
const clock = createManualClock('2026-11-24T10:00:00.000Z');

describe('migrate avec un plan (instructions chargées à la demande)', () => {
  it('base à jour : load() n’est jamais appelé', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, [m1, m2], { clock });
    const load = vi.fn(() => Promise.resolve([m1, m2]));
    const report = await migrate(db, planOf([m1, m2], load), { clock });
    expect(load).not.toHaveBeenCalled();
    expect(report).toEqual({ applied: [], currentVersion: 2 });
    await db.close();
  });

  it('migrations en attente : load() appelé une fois, seules les manquantes sont appliquées, sauvegarde reçoit leurs corps', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, [m1], { clock });
    const load = vi.fn(() => Promise.resolve([m1, m2]));
    const beforeApply = vi.fn(() => Promise.resolve());
    const report = await migrate(db, planOf([m1, m2], load), { clock, beforeApply });
    expect(load).toHaveBeenCalledTimes(1);
    expect(beforeApply).toHaveBeenCalledWith([m2], { fromVersion: 1 });
    expect(report).toEqual({ applied: [2], currentVersion: 2 });
    expect(await db.select("SELECT name FROM sqlite_master WHERE name = 'b'")).toEqual([{ name: 'b' }]);
    await db.close();
  });

  it('base neuve : tout est appliqué depuis le plan', async () => {
    const db = await openSqliteWasmDriver();
    const report = await migrate(db, planOf([m1, m2], () => Promise.resolve([m1, m2])), { clock });
    expect(report.applied).toEqual([1, 2]);
    await db.close();
  });

  it('somme de contrôle d’une migration appliquée différente de celle du plan : refus sans rien appliquer ni charger', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, [m1], { clock });
    const load = vi.fn(() => Promise.resolve([m1, m2]));
    const changed = { ...planOf([m1, m2], load), entries: [{ version: 1, name: 'un', checksum: 'deadbeef' }, ...planOf([m2], load).entries] };
    await expect(migrate(db, changed, { clock })).rejects.toThrow(MigrationError);
    expect(load).not.toHaveBeenCalled();
    await db.close();
  });

  it('corps chargé qui ne correspond pas à la somme de contrôle du plan : refus avant toute écriture', async () => {
    const db = await openSqliteWasmDriver();
    const tampered: Migration = { ...m2, statements: ['CREATE TABLE b (id INTEGER, extra TEXT)'] };
    await expect(migrate(db, planOf([m1, m2], () => Promise.resolve([m1, tampered])), { clock })).rejects.toThrow(MigrationError);
    expect(await db.select("SELECT name FROM sqlite_master WHERE name IN ('a', 'b')")).toEqual([]);
    await db.close();
  });

  it('base plus récente que le plan : SchemaNewerThanApp, sans charger', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, [m1, m2], { clock });
    const load = vi.fn(() => Promise.resolve([m1]));
    await expect(migrate(db, planOf([m1], load), { clock })).rejects.toThrow(SchemaNewerThanApp);
    expect(load).not.toHaveBeenCalled();
    await db.close();
  });

  it('chargement des instructions en échec : MigrationError, étape « load », ni sauvegarde ni écriture, base intacte', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, [m1], { clock });
    const steps: string[] = [];
    const beforeApply = vi.fn(() => Promise.resolve());
    const failing = planOf([m1, m2], () => Promise.reject(new Error('import impossible')));
    await expect(migrate(db, failing, { clock, beforeApply, onStep: (s) => steps.push(s.kind) })).rejects.toThrow(MigrationError);
    expect(steps).toEqual(['schema', 'load']);
    expect(beforeApply).not.toHaveBeenCalled();
    expect(await db.select('SELECT version FROM schema_migrations ORDER BY version')).toEqual([{ version: 1 }]);
    expect(await db.select("SELECT name FROM sqlite_master WHERE name = 'b'")).toEqual([]);
    await db.close();
  });

  it('étape « load » annoncée seulement quand il y a du travail', async () => {
    const db = await openSqliteWasmDriver();
    const steps: string[] = [];
    await migrate(db, [m1, m2], { clock });
    await migrate(db, planOf([m1, m2], () => Promise.resolve([m1, m2])), { clock, onStep: (s) => steps.push(s.kind) });
    expect(steps).toEqual(['schema']);
    await db.close();
  });

  it('latestVersion : dernière version d’un tableau ou d’un plan, 0 si vide', () => {
    expect(latestVersion([m1, m2])).toBe(2);
    expect(latestVersion(planOf([m1], () => Promise.resolve([m1])))).toBe(1);
    expect(latestVersion([])).toBe(0);
  });
});
