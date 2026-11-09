import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { openSqliteWasmDriver } from '../../src/db/drivers/sqliteWasm';
import { migrate } from '../../src/db/migrator';
import { migrations } from '../../src/db/migrations';

/**
 * I5-01 point 1.1 (relecture sync-icloud, suite du point 9 d'I4-08) : fixture `src-tauri/tests/fixtures/spartiate-migrations.json`, lue par
 * `src-tauri/tests/desktop/backup_versions.rs`. Elle porte, pour chaque migration TypeScript, ses instructions (rejouées côté Rust pour
 * obtenir une base neuve migrée à chaque version) et, pour chaque version de 1 à la dernière, les tables et déclencheurs (nom, table, corps
 * compacté) d'une base migrée ici par le vrai migrateur. Le test Rust exige que la restauration (`reset_triggers`) recrée exactement ces
 * déclencheurs à chaque version.
 *
 * Si ce test échoue, les migrations ont changé et la fixture est périmée : la régénérer par `node scripts/backup/export-migrations-fixture.mjs`,
 * puis déclarer dans `src-tauri/src/backup_triggers.rs` la version de schéma, ses déclencheurs et ses tables (le test Rust le force).
 */
const FIXTURE = resolve(import.meta.dirname, '../../src-tauri/tests/fixtures/spartiate-migrations.json');
const NOTE = 'Généré par scripts/release/backupMigrationsFixture.test.ts (node scripts/backup/export-migrations-fixture.mjs) ; ne pas modifier à la main.';

const compact = (sql: string): string => sql.split(/[ \t\n\r\f\v]+/).filter(Boolean).join(' ');

/** Corps distincts une seule fois (nom, table, SQL compacté, versions où ce corps est celui de la base migrée) ; par version, les seuls noms. */
async function build(): Promise<string> {
  const versions = [];
  const bodies: { name: string; table: string; sql: string; versions: number[] }[] = [];
  for (const migration of migrations) {
    const db = await openSqliteWasmDriver();
    try {
      await migrate(db, migrations.filter((m) => m.version <= migration.version));
      const tables = (await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((r) => r.name);
      const rows = await db.select<{ name: string; tbl_name: string; sql: string }>("SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name");
      for (const row of rows) {
        const sql = compact(row.sql);
        const known = bodies.find((b) => b.name === row.name && b.table === row.tbl_name && b.sql === sql);
        if (known) known.versions.push(migration.version);
        else bodies.push({ name: row.name, table: row.tbl_name, sql, versions: [migration.version] });
      }
      versions.push({ version: migration.version, tables, triggers: rows.map((r) => r.name) });
    } finally {
      await db.close();
    }
  }
  bodies.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : x.versions[0]! - y.versions[0]!));
  const body = {
    note: NOTE,
    migrations: migrations.map((m) => ({ version: m.version, name: m.name, statements: m.statements })),
    versions,
    triggers: bodies,
  };
  return `${JSON.stringify(body, null, 1)}\n`;
}

it('la fixture des migrations (restauration Rust, I5-01 point 1.1) correspond aux migrations TypeScript réelles', async () => {
  const expected = await build();
  if (process.env.UPDATE_BACKUP_MIGRATIONS_FIXTURE === '1') writeFileSync(FIXTURE, expected);
  expect(readFileSync(FIXTURE, 'utf8').replace(/\r\n/g, '\n'), 'fixture périmée : node scripts/backup/export-migrations-fixture.mjs').toBe(expected);
}, 120_000);
