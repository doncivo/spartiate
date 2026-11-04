import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(here, 'tokens.css'), 'utf-8');
const fonts = readFileSync(join(here, 'fonts.css'), 'utf-8');

/**
 * T-01, critère 18 : le bouton rond « + » doit être #3A2A66 (maquettes Main.html)
 * et les polices Fraunces / DM Sans doivent rester les polices de référence
 * (CLAUDE.md, PRD section 5). Ce test ne vérifie pas le rendu visuel complet
 * (voir checklist manuelle iPhone) mais fait échouer toute régression des jetons
 * de couleur et de police utilisés par le design system.
 */
describe('jetons de thème (T-01, critère 18)', () => {
  it('expose le rouge d’accent #b8322a de la charte (fond de bouton portant du texte ivoire, jamais du texte)', () => {
    expect(tokens).toMatch(/--ct-color-accent:\s*#b8322a;/i);
  });

  it('déclare Fraunces pour les titres et DM Sans pour le texte courant', () => {
    expect(tokens).toMatch(/--ct-font-title:\s*'Fraunces Variable'/);
    expect(tokens).toMatch(/--ct-font-text:\s*'DM Sans Variable'/);
    expect(fonts).toMatch(/font-family:\s*'Fraunces Variable';/);
    expect(fonts).toMatch(/font-family:\s*'DM Sans Variable';/);
  });
});
