import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * I4-02 : le catalogue Ciqual (537 Ko) est chargé À LA DEMANDE. Aucun module de `src/` ne l'importe statiquement : seul
 * `ciqualCatalogue.ts` l'ouvre, par import dynamique ; il n'entre donc jamais dans le paquet de départ (l'assertion « hors du départ » sur
 * le build viendra avec l'écran du journal, I4-03, premier importeur du chargeur).
 */

const SRC = resolve(import.meta.dirname, '../../..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('catalogue Ciqual hors du départ', () => {
  it('aucun import statique de content/food ; un seul import dynamique, dans le chargeur', () => {
    const staticImport = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"][^'"]*content\/food\//;
    const dynamicImport = /import\(\s*['"][^'"]*content\/food\/ciqual\.json['"]\s*\)/;
    const dynamicUsers: string[] = [];
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf8');
      expect(staticImport.test(text), file).toBe(false);
      if (dynamicImport.test(text)) dynamicUsers.push(file.replaceAll('\\', '/').slice(SRC.replaceAll('\\', '/').length + 1));
    }
    expect(dynamicUsers).toEqual(['features/nutrition/catalogue/ciqualCatalogue.ts']);
  });
});
