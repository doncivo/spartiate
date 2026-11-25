import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openSqliteWasmDriver } from './drivers/sqliteWasm';
import { migrate } from './migrator';
import { migrations } from './migrations';
import type { SqlValue } from './driver';

/**
 * DATA-0295 (§ 23.1 c, H-18) : moitié Wasm du scénario de parité. Le même fichier (`tests/fixtures/db/wasm-native-parity.json`) est rejoué
 * par le plugin SQL natif (`src-tauri/tests/desktop/wasm_native_parity.rs`) ; les deux doivent rendre exactement `expect` (déclencheurs de
 * capture, garde de synchro, transaction annulée, contraintes, pragma des clés étrangères). Valeurs synthétiques.
 */
interface Statement {
  readonly sql: string;
  readonly params: readonly SqlValue[];
}
interface Scenario {
  readonly steps: readonly Statement[];
  readonly failing: readonly Statement[];
  readonly checks: readonly { readonly sql: string; readonly expect: readonly (readonly SqlValue[])[] }[];
}
const scenario = JSON.parse(readFileSync(join(__dirname, '..', '..', 'tests', 'fixtures', 'db', 'wasm-native-parity.json'), 'utf8')) as Scenario;

describe('H-18 : scénario de parité Wasm / natif, moitié Wasm', () => {
  it('migrations de l’app, puis le scénario : chaque contrôle rend exactement la valeur attendue', async () => {
    const driver = await openSqliteWasmDriver();
    try {
      await migrate(driver, migrations);
      for (const step of scenario.steps) await driver.execute(step.sql, [...step.params]);
      for (const bad of scenario.failing) await expect(driver.execute(bad.sql, [...bad.params]), bad.sql).rejects.toThrow();
      for (const check of scenario.checks) {
        const rows = await driver.select<Record<string, SqlValue>>(check.sql);
        expect(rows.map((row) => Object.values(row)), check.sql).toEqual(check.expect);
      }
    } finally {
      await driver.close();
    }
  });
});
