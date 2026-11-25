import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SHELL-0295 (C-076, D-639) : dans `src/features` et `src/ui`, aucune unité « min » ou « h », aucun séparateur « · » ou « — », aucune
 * locale `'fr-FR'` ni `toLocaleString(` écrits en dur : ils passent par `src/i18n/units.ts` (textes dans `src/i18n/fr.units.ts`).
 * Relevé par script sur les fichiers suivis par git (D-51), commentaires retirés ; une exception se nomme ici avec sa raison.
 */
const root = resolve(import.meta.dirname, '..', '..');
const EXCEPTIONS: ReadonlyMap<string, string> = new Map([
  ['src/features/sync/syncText.ts', 'module du départ (tests/bundle/start-modules.json) : importer units.ts ajouterait un module au départ'],
]);
const RULES: readonly (readonly [RegExp, string])[] = [
  [/'fr-FR'/g, "locale 'fr-FR' en dur"],
  [/\.toLocaleString\(/g, 'toLocaleString( en dur'],
  [/\$\{[^}]*\} (?:min|h)\b/g, 'unité « min » ou « h » en dur'],
  [/'—'|' · '|` · |'·'/g, 'séparateur « · » ou « — » en dur'],
];

const files = execFileSync('git', ['ls-files', 'src/features', 'src/ui'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.tsx?$/.test(f) && !/\.(test|qa\.test)\.tsx?$/.test(f) && !/\/testing(\/|\.ts)/.test(f));

describe('C-076 : unités et séparateurs par les fonctions communes de src/i18n', () => {
  it('les fichiers de src/features et src/ui sont relevés', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('aucune unité, locale ni séparateur en dur hors des exceptions nommées', () => {
    const found: string[] = [];
    for (const file of files) {
      if (EXCEPTIONS.has(file)) continue;
      const text = readFileSync(resolve(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      text.split('\n').forEach((line, i) => {
        for (const [re, label] of RULES) if (line.match(re)) found.push(`${file}:${String(i + 1)} : ${label}`);
      });
    }
    expect(found).toEqual([]);
  });

  it('chaque exception existe encore et garde un motif réel', () => {
    for (const [file] of EXCEPTIONS) expect(readFileSync(resolve(root, file), 'utf8')).toMatch(/'fr-FR'/);
  });
});
