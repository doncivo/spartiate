// I5-01 point 1.1 : régénère `src-tauri/tests/fixtures/spartiate-migrations.json` (instructions des migrations TypeScript et déclencheurs
// d'une base migrée à chaque version), lue par le test Rust de la restauration (`src-tauri/tests/desktop/backup_versions.rs`).
// Les migrations sont en TypeScript : la génération passe par le test de cohérence, lancé avec UPDATE_BACKUP_MIGRATIONS_FIXTURE=1.
// Usage : node scripts/backup/export-migrations-fixture.mjs
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const result = spawnSync(
  'npx',
  ['vitest', 'run', '--coverage.enabled=false', '--project', 'node', 'scripts/release/backupMigrationsFixture.test.ts'],
  { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, UPDATE_BACKUP_MIGRATIONS_FIXTURE: '1' } },
);
process.exit(result.status ?? 1);
