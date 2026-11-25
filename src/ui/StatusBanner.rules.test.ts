import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * BL-162 (relecture des paires visuelles, run 45379435573, Degrade-signature-expiree-app.png, 440 px) : le lien « Voir » du bandeau de
 * signature était coupé en « Vo / ir ». Le bouton d'action ne rétrécit jamais ni ne revient à la ligne ; c'est le message qui se replie.
 * La géométrie réelle est relue sur les captures `visual` (CI).
 */
const css = readFileSync(new URL('./StatusBanner.css', import.meta.url), 'utf8');
const rule = (selector: string): string => {
  const start = css.indexOf(`
${selector} {`);
  if (start < 0) throw new Error(`règle absente : ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};

describe('bandeau d’état : bouton d’action entier', () => {
  it('le bouton « Voir » ne rétrécit pas et ne revient pas à la ligne', () => {
    const action = rule('.ct-status-banner__action');
    expect(action).toContain('flex: none');
    expect(action).toContain('white-space: nowrap');
  });
});
