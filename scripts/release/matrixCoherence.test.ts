import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * BL-148 (audit du projet du 24/11, N-11) : la matrice des capacités et l'ADR 0014 suivent l'état réel. Un statut n'est promu que par
 * un constat d'Ali daté cité dans sa ligne, jamais par une lecture de code (D-36).
 */
const matrix = readFileSync('docs/capability-matrix.md', 'utf8').split('\n');
const row = (start: string): string => matrix.find((l) => l.startsWith(`| ${start}`)) ?? '';
const status = (line: string): string => line.split(' | ')[1] ?? '';

describe('BL-148 : matrice et ADR 0014', () => {
  it('la ligne « Fork, renommage… » n’est plus UNVERIFIED et cite le constat d’Ali qui la promeut', () => {
    const line = row('Fork, renommage');
    expect(line).not.toBe('');
    expect(status(line).startsWith('UNVERIFIED')).toBe(false);
    expect(status(line)).toMatch(/constats? d’Ali du 2026-11-06/);
  });
  it('H-12 suit le constat du scan (fiche Open Food Facts obtenue le 19/11/2026) ; ses limites restent UNVERIFIED', () => {
    const line = row('API Open Food Facts');
    expect(status(line)).toMatch(/^CONFIRMED .*19\/11\/2026/);
    expect(status(line)).toMatch(/UNVERIFIED/);
  });
  it('H-15 est reformulée sans Recharts (retiré, D-614)', () => {
    const line = matrix.find((l) => l.includes('(H-15')) ?? '';
    expect(line).not.toBe('');
    expect(line.split(' | ')[0].includes('Recharts')).toBe(false);
  });
  it('l’ADR 0014 nomme les fichiers réels du journal (spartiate.log), plus circletasks.log', () => { // ancien-ok: ancien nom du journal, assertion négative (BL-148)
    const adr = readFileSync('docs/adr/0014-journal-technique-persistant.md', 'utf8');
    expect(adr.includes('circletasks.log')).toBe(false); // ancien-ok: ancien nom du journal, assertion négative (BL-148)
    expect(adr.includes('circletasks-logs-')).toBe(false); // ancien-ok: ancien nom du journal, assertion négative (BL-148)
    expect(adr).toContain('spartiate.log');
  });
});
