import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const lire = (chemin: string): string => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');

// C-173 : la documentation décrit le déclenchement réel de tests.yml (push sur main, pull request vers main, lancement manuel).
describe('C-173 : déclenchement de tests.yml documenté tel qu\'il est', () => {
  const workflow = lire('.github/workflows/tests.yml');
  const bloc = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('\npermissions:'));

  it('le workflow se déclenche sur main, les pull requests vers main et à la main', () => {
    expect(bloc).toContain('push:\n    branches: ["main"]');
    expect(bloc).toContain('pull_request:\n    branches: [main]');
    expect(bloc).toContain('workflow_dispatch:');
  });

  it.each(['CLAUDE.md', 'AGENTS.md'])('%s ne promet pas un run à chaque push de branche', (fichier) => {
    const texte = lire(fichier);
    expect(texte).not.toMatch(/à chaque push(?! sur main)/);
    expect(texte).not.toContain('à chaque push de branche');
  });

  it.each(['CLAUDE.md', 'AGENTS.md'])('%s dit que la suite tourne sur pull request et sur main', (fichier) => {
    expect(lire(fichier)).toMatch(/pull request/i);
  });
});
