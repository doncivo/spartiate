import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Finitions 0.1.2 (b) : sur iPhone, la marge de l'encoche (safe area du haut) est appliquée UNE fois, par la coquille. Le contenu
 * ne doit pas ajouter son propre grand retrait au-dessus du titre (planche : barre d'état de 59 px puis 4 px avant « Plus »).
 */
const css = readFileSync(new URL('./AppShell.css', import.meta.url), 'utf8');

function block(selector: string): string {
  const escaped = selector.replace(/[.[\]'=()-]/g, String.raw`\$&`);
  const match = new RegExp(escaped + String.raw`\s*\{([^}]*)\}`).exec(css);
  if (!match) throw new Error(`Bloc introuvable : ${selector}`);
  return match[1] ?? '';
}

function paddingTop(body: string): number {
  const shorthand = /padding:\s*(\d+)px/.exec(body);
  const longhand = /padding-top:\s*(\d+)px/.exec(body);
  const value = longhand ?? shorthand;
  return value ? Number(value[1]) : 0;
}

describe('coquille iPhone : marge de l’encoche appliquée une seule fois', () => {
  it('la coquille mobile porte la safe area du haut', () => {
    expect(block(".ct-app-shell[data-layout='mobile']")).toContain('var(--ct-safe-area-top)');
  });

  it('le contenu mobile n’ajoute pas un second grand retrait au-dessus du titre (≤ 8 px)', () => {
    expect(paddingTop(block('.ct-app-shell__main'))).toBeLessThanOrEqual(8);
  });

  it('le contenu n’ajoute pas non plus la safe area du haut', () => {
    expect(block('.ct-app-shell__main')).not.toContain('safe-area-top');
  });
});
