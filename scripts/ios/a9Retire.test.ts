import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// C-161 : l'outil d'instrumentation A9 (schéma 19, version 1.0.0, même identifiant que l'app réelle) est retiré.
describe('C-161 : prepare-a9.mjs ne subsiste pas', () => {
  it('le script et son test sont absents', () => {
    expect(existsSync(new URL('./prepare-a9.mjs', import.meta.url))).toBe(false);
    expect(existsSync(new URL('./a9.test.ts', import.meta.url))).toBe(false);
  });
  it('la fiche du rôle ci-release ne le cite plus comme fichier modifiable', () => {
    const fiche = readFileSync(new URL('../../.claude/agents/ci-release.md', import.meta.url), 'utf8');
    expect(fiche).not.toContain('prepare-a9');
  });
});
