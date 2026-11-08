import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { migrations } from './index';

/**
 * I4-06 (0.8.1) : fixtures SQL des tests Rust de la sauvegarde (`src-tauri/tests/fixtures/`), tenues identiques aux migrations réelles :
 * - `spartiate-v8-schema.sql` et `spartiate-v7-schema.sql` : schéma RÉEL (tables, index, déclencheurs de sqlite_master) d'une base migrée jusqu'à
 *   la version 8 ou 7 ;
 * - `spartiate-0008-statements.sql` : instructions de la migration 0008, rejouées après une restauration de version 7.
 * Si ce test échoue, les migrations ont changé : régénérer par `UPDATE_SPARTIATE_FIXTURES=1 npx vitest run src/db/migrations/spartiateSchemaFixture.test.ts`
 * (et aligner `APP_SCHEMA_VERSION`, voir data-model).
 */
const fixture = (name: string): string => fileURLToPath(new URL(`../../../src-tauri/tests/fixtures/${name}`, import.meta.url));
const HEADER = '-- Généré par src/db/migrations/spartiateSchemaFixture.test.ts (UPDATE_SPARTIATE_FIXTURES=1) ; ne pas modifier à la main.';

async function schemaUpTo(version: number): Promise<string> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.filter((m) => m.version <= version));
  const rows = await db.select<{ sql: string }>(
    `SELECT sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name`,
  );
  return rows.map((r) => `${r.sql};`).join('\n');
}

const m0008 = (): string => {
  const migration = migrations.find((m) => m.version === 8);
  if (migration === undefined) throw new Error('migration 0008 introuvable');
  return migration.statements.map((s) => `${s};`).join('\n');
};

const cases: [string, () => Promise<string>][] = [
  ['spartiate-v8-schema.sql', () => schemaUpTo(8)],
  ['spartiate-v7-schema.sql', () => schemaUpTo(7)],
  ['spartiate-0008-statements.sql', async () => m0008()],
];

for (const [name, build] of cases) {
  it(`la fixture ${name} correspond aux migrations réelles`, async () => {
    const body = await build();
    if (process.env.UPDATE_SPARTIATE_FIXTURES === '1') writeFileSync(fixture(name), `${HEADER}\n${body}\n`);
    const text = readFileSync(fixture(name), 'utf8').split('\n').filter((l) => !l.startsWith('-- ')).join('\n').trim();
    expect(text).toBe(body);
  });
}
