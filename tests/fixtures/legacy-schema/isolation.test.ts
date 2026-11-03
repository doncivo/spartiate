import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** D-67 : le banc de test de l'ancien schéma ne sert qu'aux tests ; aucun code de production sous src/ ne l'importe. */
describe('banc legacy-schema (D-67)', () => {
  it('aucun fichier de src/ hors tests n’importe tests/fixtures/legacy-schema', () => {
    const files = execSync('git ls-files src', { encoding: 'utf8' })
      .split('\n')
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !/(^|\/)(testSetup|testKit|testing)\.tsx?$/.test(f));
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes('fixtures/legacy-schema'));
    expect(offenders).toEqual([]);
  });
});
