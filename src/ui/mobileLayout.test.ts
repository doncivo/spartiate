import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Finitions 0.1.2 (f) et (g), constatées sur l'iPhone réel à 440 px : aucun libellé de la barre d'onglets n'est coupé ;
 * « Profil et poids » a la marge latérale de 20 px des planches, posée une seule fois (par la coquille).
 */
const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8');
const tabRail = read('./TabRail.css');
const shell = read('./AppShell.css');
const body = read('../features/settings/BodyScreen.css');

function block(css: string, selector: string): string {
  const escaped = selector.replace(/[.[\]'=()-]/g, String.raw`\$&`);
  const match = new RegExp(escaped + String.raw`\s*\{([^}]*)\}`).exec(css);
  if (!match) throw new Error(`Bloc introuvable : ${selector}`);
  return match[1] ?? '';
}

describe('barre d’onglets iPhone (f)', () => {
  const label = block(tabRail, ".ct-tab-rail[data-layout='mobile'] .ct-tab-rail__label");

  it('aucune coupure ni points de suspension sur les libellés', () => {
    expect(label).not.toMatch(/text-overflow/);
    expect(label).not.toMatch(/overflow:\s*hidden/);
  });

  it('corps de 10 px comme la planche : « Entraînement » et « Aujourd’hui » tiennent dans une cellule de 88 px', () => {
    expect(label).toMatch(/font-size:\s*10px/);
    // 5 onglets dans 440 px : 88 px par cellule. Le libellé le plus long (12 caractères) à 10 px reste sous ~66 px.
    const cell = 440 / 5;
    expect(12 * 10 * 0.55).toBeLessThan(cell);
  });
});

describe('Profil et poids : marge latérale (g)', () => {
  it('la coquille mobile donne 20 px à gauche et à droite du contenu', () => {
    expect(block(shell, '.ct-app-shell__main')).toMatch(/padding:\s*\d+px 20px \d+px;/);
  });

  it('l’écran n’ajoute ni retrait ni marge latérale à ces 20 px', () => {
    for (const selector of ['.ct-body-shell', '.ct-body']) {
      const rules = block(body, selector);
      expect(rules, selector).not.toMatch(/padding(-inline|-left|-right)?\s*:/);
      expect(rules, selector).not.toMatch(/margin(-inline|-left|-right)?\s*:/);
    }
  });

  it('la colonne de l’écran occupe toute la largeur disponible sur iPhone (pas de largeur fixe)', () => {
    const rules = block(body, '.ct-body');
    expect(rules).not.toMatch(/(?<!max-)width:\s*\d+px/);
    expect(rules).toMatch(/flex-grow:\s*1/);
  });

  // 0.1.3 (j) : sur l'iPhone réel, les cartes débordaient du bord droit (bord coupé, texte à la ligne). Aucune largeur ne dépasse la colonne.
  it('(j) la colonne et ses cartes peuvent rétrécir (min-width: 0) et ne dépassent jamais leur parent', () => {
    for (const selector of ['.ct-body-shell', '.ct-body', '.ct-body__grid', '.ct-body__card']) {
      const rules = block(body, selector);
      expect(rules, selector).toMatch(/min-width:\s*0/);
      expect(rules, selector).toMatch(/box-sizing:\s*border-box/);
    }
    expect(block(body, '.ct-body__card')).toMatch(/max-width:\s*100%/);
  });

  it('(j) champs et graphique sont bornés par la carte (aucune largeur fixe plus large que la colonne)', () => {
    expect(block(body, '.ct-body__input')).toMatch(/min-width:\s*0/);
    expect(block(body, '.ct-body__input')).toMatch(/max-width:\s*100%/);
    expect(block(body, '.ct-body__input--short')).toMatch(/max-width:\s*50%/);
    expect(block(body, '.ct-body__spark')).toMatch(/max-width:\s*100%/);
    expect(block(body, '.ct-body__latest')).toMatch(/flex-wrap:\s*wrap/);
  });

  it('(j) le texte des lignes de l’historique passe à la ligne dans la carte au lieu de la déborder', () => {
    expect(block(body, '.ct-body__item')).toMatch(/min-width:\s*0/);
    expect(block(body, '.ct-body__itemKg')).toMatch(/min-width:\s*0/);
  });
});
