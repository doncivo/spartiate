import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from './theme';

/** P-02 critère 4 : le script de premier affichage lit le miroir local avant React (pas d'éclair blanc). */
const script = readFileSync(join(process.cwd(), 'public', 'theme-init.js'), 'utf8');
const run = (): void => void new Function(script)();

describe('public/theme-init.js (P-02 critère 4)', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.clear();
  });

  it('pose le thème sombre ou clair mémorisé avant le rendu', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sans choix explicite (système, valeur absente ou inconnue) : aucun attribut, le thème système s’applique', () => {
    run();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'system');
    run();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    run();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('BL-033 : « système » mémorisé retire le sombre posé par index.html (le premier rendu suit le système)', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'system');
    run();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('BL-033 : aucun choix mémorisé (premier lancement) garde le sombre par défaut de index.html', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('est chargé de façon synchrone dans l’en-tête de index.html', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    expect(html).toMatch(/<head>[\s\S]*<script src="\/theme-init\.js"><\/script>[\s\S]*<\/head>/);
  });
});
