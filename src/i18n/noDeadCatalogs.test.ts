import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * PURGE-I18N (D-67) : chaque module de textes de `src/i18n` doit être atteignable depuis du code vivant (hors tests) situé hors de
 * `src/i18n`. Un catalogue ou un formateur que plus aucun écran n'importe (restes de CircleTasks : tâches, Focus, événements,
 * rappels, statistiques) échoue ici. Le banc legacy (`tests/fixtures/legacy-schema/`) n'importe rien de `src/` (D-67), il ne
 * justifie donc la présence d'aucun texte.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path.replace(/\\/g, '/')];
  });
}

const isTest = (file: string): boolean => /\.(test|spec)\.tsx?$/.test(file) || /\.test\./.test(file);

describe('catalogues de textes sans écran vivant', () => {
  it('aucun module de src/i18n n’est orphelin', () => {
    const root = SRC.replace(/\\/g, '/');
    const files = walk(SRC).filter((f) => /\.tsx?$/.test(f) && !isTest(f));
    const text = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
    const resolve = (from: string, spec: string): string | null => {
      const base = spec.startsWith('@/') ? `${root}/${spec.slice(2)}` : spec.startsWith('.') ? posix.join(posix.dirname(from), spec) : null;
      if (base === null) return null;
      return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((c) => text.has(c) && existsSync(c)) ?? null;
    };
    const edges = new Map<string, string[]>();
    for (const [file, source] of text) {
      const targets: string[] = [];
      for (const m of source.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)) {
        const target = resolve(file, m[1] ?? '');
        if (target) targets.push(target);
      }
      edges.set(file, targets);
    }
    const inI18n = (f: string): boolean => f.startsWith(`${root}/i18n/`);
    const queue = files.filter((f) => !inI18n(f));
    const seen = new Set(queue);
    while (queue.length > 0) {
      for (const target of edges.get(queue.pop() as string) ?? []) {
        if (!seen.has(target)) {
          seen.add(target);
          queue.push(target);
        }
      }
    }
    const orphans = files.filter((f) => inI18n(f) && !seen.has(f)).map((f) => f.slice(root.length + 1));
    expect(orphans).toEqual([]);
  });
});
