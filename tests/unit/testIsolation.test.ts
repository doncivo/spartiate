import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SHELL-0295 (A-004, D-640) : aucun test ne dépend du résultat d'un test précédent par une variable de module restée nulle. L'audit
 * 0.26.0 a vu trois tests échouer « expected null not to be null » parce que le test de référence avait dépassé son délai : un échec
 * en entraînait trois autres, sans rapport avec leur propre code. Relevé par script (D-51) : variable `let x … = null` au niveau du
 * module, dont un test vérifie `expect(x).not.toBeNull()` avant de s'en servir.
 */
const root = resolve(import.meta.dirname, '..', '..');
const files = execFileSync('git', ['ls-files', 'src', 'tests', 'scripts'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(test|spec)\.tsx?$/.test(f));

describe('A-004 : tests indépendants les uns des autres', () => {
  it('les fichiers de test sont relevés', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('aucune référence de module nulle partagée entre tests', () => {
    const found: string[] = [];
    for (const file of files) {
      const text = readFileSync(resolve(root, file), 'utf8');
      for (const m of text.matchAll(/^let (\w+)\b[^=\n]*= null;/gm)) {
        const name = m[1] ?? '';
        if (text.includes(`expect(${name}).not.toBeNull()`)) found.push(`${file} : ${name}`);
      }
    }
    expect(found).toEqual([]);
  });
});
