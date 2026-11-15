import { describe, expect, it } from 'vitest';
import { SCHEMA_REPUBLISH, SCHEMA_REPUBLISH_EXEMPT, tablesToRepublish } from '../../domain/sync/schemaRepublish';
import { publishedColumns, SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { migrations } from './index';

/**
 * SYNC-01 (D-275, D-290) : garde de la republication après une migration additive. Pour chaque migration `n`, les tables déjà publiées
 * avant `n` (déclencheur de capture `sync_<table>_ai` présent) auxquelles `n` ajoute une colonne publiée du catalogue doivent figurer dans
 * `SCHEMA_REPUBLISH[n]` (ou, pour l'historique d'avant la 0.24.0, dans `SCHEMA_REPUBLISH_EXEMPT[n]`). Une migration future qui l'oublie
 * échoue ici : ses créations faites par un appareil resté en arrière ne seraient jamais reprises.
 */

async function shape(db: SqlDriver): Promise<{ captured: Set<string>; columns: Map<string, Set<string>> }> {
  const triggers = await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%_ai'");
  const captured = new Set(triggers.map((r) => r.name.slice('sync_'.length, -'_ai'.length)));
  const columns = new Map<string, Set<string>>();
  for (const t of SYNC_CATALOGUE.tables) {
    const info = await db.select<{ name: string }>(`SELECT name FROM pragma_table_info('${t.name}')`);
    columns.set(t.name, new Set(info.map((r) => r.name)));
  }
  return { captured, columns };
}

describe('republication après une migration additive (SYNC-01)', () => {
  it('chaque table publiée qui gagne une colonne publiée est republiée (ou exemptée, historique)', async () => {
    const db = await openSqliteWasmDriver();
    const found: Record<number, string[]> = {};
    let before = await shape(db);
    for (const migration of migrations) {
      await migrate(db, migrations.filter((m) => m.version <= migration.version));
      const after = await shape(db);
      for (const t of SYNC_CATALOGUE.tables) {
        if (!before.captured.has(t.name)) continue;
        const added = [...publishedColumns(t)].filter((c) => (after.columns.get(t.name)?.has(c) ?? false) && !(before.columns.get(t.name)?.has(c) ?? false));
        if (added.length > 0) (found[migration.version] ??= []).push(t.name);
      }
      before = after;
    }
    await db.close();
    const declared: Record<number, string[]> = {};
    for (const source of [SCHEMA_REPUBLISH, SCHEMA_REPUBLISH_EXEMPT]) for (const [v, names] of Object.entries(source)) (declared[Number(v)] ??= []).push(...names);
    for (const names of Object.values(declared)) names.sort();
    for (const names of Object.values(found)) names.sort();
    expect(found).toEqual(declared);
  });

  it('tables à republier : versions au-delà de la dernière faite, jusqu’au schéma courant', () => {
    expect(tablesToRepublish(0, 19)).toEqual(['mesocycle', 'nutrition_target']);
    expect(tablesToRepublish(18, 19)).toEqual(['mesocycle', 'nutrition_target']);
    expect(tablesToRepublish(19, 19)).toEqual([]);
    expect(tablesToRepublish(0, 18)).toEqual([]);
    for (const names of Object.values(SCHEMA_REPUBLISH)) for (const name of names) expect(SYNC_CATALOGUE.table(name)).toBeDefined();
  });
});
