import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FIX-0302c : les tests d'écran de séance (historique, clôture) attendent un `findBy*` d'une seconde pendant que l'écran importe à froid ses blocs à
 * la demande (lazy, `import()` : HistoryView, séance active, JSON du catalogue, dépôts). Sur un poste chargé, l'import dépasse la seconde et le test
 * échoue une fois sur trois. Garde déterministe : chaque `import('…')` littéral de `src/features/training` (hors tests) figure dans `warmTraining`
 * (préchauffage en `beforeAll`), qui chauffe aussi toutes les fabriques de dépôts. Limite : la garde ne voit pas les `import()` hors de ce dossier.
 */
const ROOT = 'src/features/training';
const HELPER = 'src/features/training/warmTraining.ts';

function sources(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((name) => sources(join(path, name))).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
}
const dynamicImports = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(/import\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => normalize(join(dirname(file), m[1] ?? '')).replaceAll('\\', '/').replace(/\.tsx?$/, ''));

describe('FIX-0302c : aucun import à froid pendant les attentes des écrans de séance', () => {
  it('chaque import() littéral de src/features/training est préchauffé par warmTraining', () => {
    const warmed = new Set(dynamicImports(HELPER));
    const wanted = new Set(sources(ROOT).filter((f) => f !== HELPER).flatMap(dynamicImports));
    expect([...wanted].filter((p) => !warmed.has(p)).sort()).toEqual([]);
  });
});
