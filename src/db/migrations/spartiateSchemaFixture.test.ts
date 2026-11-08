import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { migrations } from './index';

/**
 * I4-06 (0.8.1) : la fixture `src-tauri/tests/fixtures/spartiate-v8-schema.sql` est le schéma RÉEL (tables et déclencheurs de sqlite_master) d'une base
 * Spartiate migrée ; les tests Rust de la sauvegarde la rejouent. Elle doit rester identique aux migrations : si ce test échoue, les migrations ont
 * changé, la fixture et `APP_SCHEMA_VERSION` aussi.
 */
it('la fixture de schéma de src-tauri correspond aux migrations réelles', async () => {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations);
  const rows = await db.select<{ type: string; sql: string }>(
    `SELECT type, sql FROM sqlite_master WHERE type IN ('table','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type, name`,
  );
  const body = rows.map((r) => `${r.sql};`).join('\n');
  const fixture = readFileSync('src-tauri/tests/fixtures/spartiate-v8-schema.sql', 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('-- '))
    .join('\n')
    .trim();
  expect(fixture).toBe(body);
});
