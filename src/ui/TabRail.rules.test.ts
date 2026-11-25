import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * BL-161 (relecture des paires visuelles du 24/11, PC-Entrainement-indisponible-app.png, 1 440 px) : dans la barre latérale, « SPARTIATE » ne
 * passe pas sur deux lignes et « Entraînement » ne touche pas « Ctrl 2 ». La géométrie réelle est relue sur les captures `visual` ; ces règles
 * rendent la cause visible en revue (largeur de la barre, retour à la ligne interdit, écart minimal entre libellé et raccourci).
 */
const css = readFileSync(new URL('./TabRail.css', import.meta.url), 'utf8');
const rule = (selector: string): string => {
  const start = css.indexOf(`
${selector} {`);
  if (start < 0) throw new Error(`règle absente : ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};

describe('barre latérale PC : marque et raccourcis', () => {
  it('la marque « SPARTIATE » reste sur une ligne', () => {
    expect(rule('.ct-tab-rail__name')).toContain('white-space: nowrap');
  });

  it('la barre dépliée a la place du nom, du bouton de repli et du libellé le plus long (256 px)', () => {
    expect(rule(".ct-tab-rail[data-layout='pc']")).toContain('width: 256px');
  });

  it('un écart minimal sépare le libellé du raccourci, qui ne rétrécit jamais', () => {
    const hint = rule('.ct-tab-rail__hint');
    expect(hint).toContain('margin-left: var(--ct-space-3)');
    expect(hint).toContain('flex: 0 0 auto');
  });
});
