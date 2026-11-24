import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error module JavaScript sans déclaration de types
import { summaryMarkdown } from './cargo-audit-gate.mjs';

/**
 * A-005 : plus aucune liste d'avertissements « autorisés » à tenir à la main (le `--ignore` est parti avec BL-134) ; la liste courante
 * des avertissements de cargo audit est écrite à chaque run dans le résumé du job, donc toujours actualisée.
 */
const report = {
  vulnerabilities: { found: true, count: 1, list: [{ advisory: { id: 'RUSTSEC-2023-0071', title: 'Marvin' }, package: { name: 'rsa', version: '0.9.8' } }] },
  warnings: {
    unmaintained: [{ advisory: { id: 'RUSTSEC-2099-0010', title: 'crate abandonnée' }, package: { name: 'vieille', version: '1.0.0' } }],
    unsound: [{ advisory: { id: 'RUSTSEC-2099-0011', title: 'accès invalide' }, package: { name: 'rustix', version: '1.1.5' } }],
  },
};

describe('A-005 : résumé de cargo audit toujours à jour', () => {
  it('liste les alertes hors graphe et les avertissements par nature, avec leur crate', () => {
    const md = summaryMarkdown(report, { blocking: [], warnings: [{ id: 'RUSTSEC-2023-0071', crate: 'rsa@0.9.8', title: 'Marvin' }] }, 321);
    expect(md).toContain('cargo audit');
    expect(md).toContain('RUSTSEC-2023-0071');
    expect(md).toContain('rsa@0.9.8');
    expect(md).toContain('unmaintained');
    expect(md).toContain('vieille@1.0.0');
    expect(md).toContain('rustix@1.1.5');
    expect(md).toContain('321');
  });
  it('sans alerte ni avertissement : le dit explicitement', () => {
    const md = summaryMarkdown({ vulnerabilities: { list: [] }, warnings: {} }, { blocking: [], warnings: [] }, 5);
    expect(md).toMatch(/aucun/i);
  });
  it('tests.yml n\'ignore aucun avis (--ignore) et passe le résumé du job à la porte', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/tests.yml', import.meta.url), 'utf8');
    expect(workflow).not.toMatch(/cargo audit[^\n]*--ignore/);
    expect(workflow).toContain('cargo-audit-gate.mjs');
  });
  it('le script écrit le résumé dans GITHUB_STEP_SUMMARY (exécution réelle sur un rapport synthétique)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-summary-'));
    const reportPath = join(dir, 'audit.json');
    const treePath = join(dir, 'tree.txt');
    const summaryPath = join(dir, 'summary.md');
    writeFileSync(reportPath, JSON.stringify(report));
    writeFileSync(treePath, 'spartiate v0.1.0 (C:\x)
serde v1.0.0
rustix v1.1.5
');
    writeFileSync(summaryPath, '');
    const script = resolve(import.meta.dirname, 'cargo-audit-gate.mjs');
    const out = execFileSync(process.execPath, [script, reportPath, treePath], { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath } });
    expect(out).toContain('cargo audit : 0 alerte(s) bloquante(s), 1 hors du graphe livré');
    const md = readFileSync(summaryPath, 'utf8');
    expect(md).toContain('### cargo audit');
    expect(md).toContain('RUSTSEC-2023-0071');
    expect(md).toContain('vieille@1.0.0');
  });
});
