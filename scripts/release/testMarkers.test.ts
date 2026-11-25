import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- module JavaScript sans déclaration de types (script de relevé)
import { classifyLine, collectMarkers, compareBaseline } from './test-markers.mjs';
// @ts-expect-error -- module JavaScript sans déclaration de types (script de relevé)
import { coverageByModule, moduleOf } from './coverage-by-module.mjs';

/**
 * SHELL-0295 (BL-044, D-641) : les « skip » conditionnels, pauses et plafonds de délai des tests sont relevés par script (D-51) et figés
 * dans tests/test-markers.json, exact dans les deux sens : un ajout se justifie par un commit qui réécrit la liste (`--write`). La
 * couverture par module est tirée du rapport fusionné de la CI (coverage-summary.json) par coverage-by-module.mjs.
 */
const root = resolve(import.meta.dirname, '..', '..');

describe('BL-044 : classement des marqueurs', () => {
  it.each([
    ["  test.skip(!isPhone(testInfo), 'iPhone seul');", 'skipProjet'],
    ["  test.skip(process.platform !== 'win32', 'Windows');", 'skipCondition'],
    ['  it.skipIf(!hasDir)(\'dossier\', () => {});', 'skipCondition'],
    ['  await page.waitForTimeout(1500);', 'pause'],
    ['  await new Promise((resolve) => setTimeout(resolve, 20));', 'pause'],
    ['  it(\'x\', async () => {}, { timeout: 10_000 });', 'plafond'],
    ['  test.setTimeout(60_000);', 'plafond'],
    ['  it.only(\'x\', () => {});', 'interdit'],
    ['  test.fixme(\'x\', () => {});', 'interdit'],
    ['  expect(1).toBe(1);', null],
  ])('%s → %s', (line, kind) => {
    expect(classifyLine(line)).toBe(kind);
  });

  it('comparaison exacte dans les deux sens, par fichier et par genre', () => {
    const base = { fichiers: { 'a.test.ts': { pause: 1 } } };
    expect(compareBaseline({ 'a.test.ts': { pause: 1 } }, base)).toEqual([]);
    expect(compareBaseline({ 'a.test.ts': { pause: 2 } }, base)).toEqual(['a.test.ts : pause 1 → 2']);
    expect(compareBaseline({}, base)).toEqual(['a.test.ts : pause 1 → 0']);
    expect(compareBaseline({ 'b.test.ts': { skipCondition: 1 } }, base)).toEqual(['a.test.ts : pause 1 → 0', 'b.test.ts : skipCondition 0 → 1']);
  });

  it('le relevé du dépôt ne contient aucun marqueur interdit (only, fixme, todo)', () => {
    const found = collectMarkers(root).filter((m: { kind: string }) => m.kind === 'interdit');
    expect(found).toEqual([]);
  });

  it('tests/test-markers.json est à jour (node scripts/release/test-markers.mjs --check)', () => {
    const out = execFileSync('node', ['scripts/release/test-markers.mjs', '--check'], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('relevé conforme');
  });
});

describe('BL-044 : couverture par module', () => {
  it.each([
    ['src/domain/training/engine.ts', 'src/domain/training'],
    ['src/domain/clock.ts', 'src/domain'],
    ['src/features/nutrition/journal/Journal.tsx', 'src/features/nutrition'],
    ['src/App.tsx', 'src'],
  ])('%s → %s', (file, module) => {
    expect(moduleOf(file)).toBe(module);
  });

  it('agrège lignes et branches par module à partir d’un rapport synthétique', () => {
    const root = 'C:/r';
    const summary = {
      total: { lines: { total: 30, covered: 24, pct: 80 }, branches: { total: 10, covered: 5, pct: 50 } },
      'C:/r/src/domain/a.ts': { lines: { total: 10, covered: 9 }, branches: { total: 4, covered: 4 } },
      'C:/r/src/domain/b.ts': { lines: { total: 10, covered: 7 }, branches: { total: 4, covered: 1 } },
      'C:/r/src/features/x/c.tsx': { lines: { total: 10, covered: 8 }, branches: { total: 2, covered: 0 } },
    };
    expect(coverageByModule(summary, root)).toEqual([
      { module: 'src/domain', files: 2, lines: 80, branches: 62.5 },
      { module: 'src/features/x', files: 1, lines: 80, branches: 0 },
    ]);
  });
});
