import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * SHELL-0299 (BL-168, D-649, Ali, Q-34) : « Journaux » partout, plus aucun « Logs » visible. Le test lit tous les catalogues de textes de
 * src/i18n (fichiers `.ts` hors tests), commentaires retirés, et refuse le mot « log » ou « logs », quelle que soit la casse, dans tout
 * littéral qui contient une espace ou une capitale initiale (les chemins d'import et les clés techniques n'en ont pas).
 *
 * Exception, qui ne peut que se réduire : `fr.health.ts` (module santé, PR parallèle du lot 0.29.9 ; D-686) garde ses renvois
 * « Plus › Logs » jusqu'à la PR qui le reprend (reste de BL-168).
 */
const BANNED = /\blogs?\b/i;
const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
const dir = fileURLToPath(new URL('.', import.meta.url));
const strip = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');

const EXEMPT = new Set(['fr.health.ts']);

const CATALOGS = readdirSync(dir)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts'))
  .sort();

function offenders(file: string, source: string): string[] {
  const found: string[] = [];
  for (const match of strip(source).matchAll(LITERAL)) {
    const text = match[1] ?? match[2] ?? match[3] ?? '';
    if ((/\s/.test(text) || /^[A-Z]/.test(text)) && BANNED.test(text)) found.push(`${file} : ${text.slice(0, 100)}`);
  }
  return found;
}

describe('SHELL-0299 : plus aucun « Logs » visible dans les catalogues de textes (BL-168)', () => {
  it('les catalogues sont trouvés (fr.logs.ts, plusText.ts, fr.ts)', () => {
    expect(CATALOGS).toEqual(expect.arrayContaining(['fr.logs.ts', 'plusText.ts', 'fr.ts']));
  });

  it.each(CATALOGS.filter((name) => !EXEMPT.has(name)))('%s', (file) => {
    expect(offenders(file, readFileSync(`${dir}${file}`, 'utf8'))).toEqual([]);
  });

  it('l’écran et la ligne de Plus disent « Journaux »', () => {
    const logs = readFileSync(`${dir}fr.logs.ts`, 'utf8');
    expect(logs).toContain("rowLabel: 'Journaux'");
    expect(logs).toContain("title: 'Journaux'");
  });

  it('l’exception ne sert qu’à un fichier qui en a encore besoin (la liste ne peut que se réduire)', () => {
    for (const file of EXEMPT) expect(offenders(file, readFileSync(`${dir}${file}`, 'utf8')).length, file).toBeGreaterThan(0);
  });
});
