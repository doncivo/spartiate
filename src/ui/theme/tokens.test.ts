import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(here, 'tokens.css'), 'utf-8');
const fonts = readFileSync(join(here, 'fonts.css'), 'utf-8');

/**
 * T-01, critère 18 : le bouton rond « + » doit être #3A2A66 (maquettes Main.html)
 * et les polices : Cinzel (titres) et police système (texte) depuis SPA-009 (charte § 18.4)
 * (CLAUDE.md, PRD section 5). Ce test ne vérifie pas le rendu visuel complet
 * (voir checklist manuelle iPhone) mais fait échouer toute régression des jetons
 * de couleur et de police utilisés par le design system.
 */
describe('jetons de thème (T-01, critère 18)', () => {
  it('expose le rouge d’accent #b8322a de la charte (fond de bouton portant du texte ivoire, jamais du texte)', () => {
    expect(tokens).toMatch(/--ct-color-accent:\s*#b8322a;/i);
  });

  it('déclare Cinzel pour les titres et la police du système pour le texte courant (charte § 18.4)', () => {
    expect(tokens).toMatch(/--ct-font-title:\s*'Cinzel'/);
    expect(tokens).toMatch(/--ct-font-text:\s*-apple-system, 'SF Pro Text', 'Segoe UI'/);
    expect(fonts).toMatch(/font-family:\s*'Cinzel';/);
    expect(fonts).not.toMatch(/Fraunces|DM Sans/);
  });
});
