import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FIX-0272 : (1) ADR 0001 — aucun import de `@tauri-apps/*` dans src/features (la plateforme passe par une façade de src/platform) ;
 * (2) A-006 — le test chronométré de checklist est un test de performance (`*.perf.test.ts`, lancé par `npm run test:perf`), hors de `npm run test`.
 */
const root = resolve(import.meta.dirname, '..', '..');
function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe('FIX-0272 : couches et tests chronométrés', () => {
  it('aucun import de @tauri-apps dans src/features', () => {
    const bad = files(resolve(root, 'src/features'))
      .filter((p) => /from '@tauri-apps|import\('@tauri-apps/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(root, p).replace(/\\/g, '/'));
    expect(bad).toEqual([]);
  });

  it('A-006 : la mesure de 200 items en moins de 300 ms vit dans checklistRepository.perf.test.ts, plus dans la suite unitaire', () => {
    expect(readFileSync(resolve(root, 'src/db/repositories/sql/checklistRepository.test.ts'), 'utf8')).not.toContain('performance.now()');
    const perf = resolve(root, 'src/db/repositories/sql/checklistRepository.perf.test.ts');
    expect(existsSync(perf)).toBe(true);
    expect(existsSync(perf) ? readFileSync(perf, 'utf8') : '').toContain('toBeLessThan(300)');
  });
});
