import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { START_RUNS, medianMs } from '../../e2e/helpers/perfStart';

/**
 * SHELL-0294e (BL-137, BL-167, D-614) : la mesure de démarrage (tests/e2e/perf-start.spec.ts) juge la médiane de plusieurs chargements
 * à froid, un premier chargement jeté (préchauffage du navigateur et du serveur) ; le budget du PRD § 23.1 reste 1 500 ms (PC) et 2 000 ms (iPhone).
 */
describe('mesure de démarrage (BL-137, BL-167)', () => {
  it('la médiane est exacte (nombre impair, nombre pair, ordre quelconque)', () => {
    expect(medianMs([1700, 1200, 1400])).toBe(1400);
    expect(medianMs([5, 1, 3, 2])).toBe(2.5);
    expect(medianMs([42])).toBe(42);
  });

  it('une médiane de zéro mesure est refusée', () => {
    expect(() => medianMs([])).toThrow('aucune mesure');
  });

  it('un seul chargement lent ne fait pas la médiane, trois chargements lents oui (la dérive réelle reste détectée)', () => {
    expect(medianMs([1576, 1100, 1150])).toBeLessThan(1500);
    expect(medianMs([1576, 1512, 1150])).toBeGreaterThan(1500);
  });

  it('au moins trois mesures retenues, nombre impair', () => {
    expect(START_RUNS).toBeGreaterThanOrEqual(3);
    expect(START_RUNS % 2).toBe(1);
  });

  it('les budgets du spec ne sont pas relevés et le premier chargement est jeté', () => {
    const spec = readFileSync(join(import.meta.dirname, '..', '..', 'e2e', 'perf-start.spec.ts'), 'utf8');
    expect(spec).toContain('{ pc: 1500, iphone: 2000 }');
    expect(spec).toContain('const median = medianMs(runs)');
    expect(spec).toContain('const discarded = await loadOnce()');
    expect(spec).toContain('expect(discarded');
    expect(spec).toContain('.toBeLessThan(2 * BUDGET_MS[kind])');
  });
});
