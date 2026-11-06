import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 0.1.4 (1) : sur l'iPhone, toucher un champ dont le texte fait moins de 16 px fait zoomer toute la page (zoom automatique de WebKit), et
 * elle reste zoomée : cartes qui débordent à droite, libellés des onglets coupés. Correction : 16 px au moins pour input, select et textarea sur
 * iOS, sans bloquer le zoom de l'utilisateur.
 */
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

function iosBlock(): string {
  const start = css.indexOf('@supports (-webkit-touch-callout: none)');
  if (start < 0) throw new Error('Bloc @supports iOS introuvable');
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}' && (depth -= 1) === 0) return css.slice(open + 1, i);
  }
  throw new Error('Bloc @supports iOS non fermé');
}

describe('zoom automatique d’iOS au focus d’un champ (0.1.4 point 1)', () => {
  const block = iosBlock();

  it('input, select et textarea ont un texte d’au moins 16 px, imposé malgré les styles de composant', () => {
    for (const tag of ['input', 'select', 'textarea']) expect(block).toMatch(new RegExp(String.raw`\b${tag}\b`));
    expect(block).toMatch(/font-size:\s*max\(16px,\s*1em\)\s*!important/);
  });

  it('le zoom de l’utilisateur n’est pas bloqué (ni maximum-scale ni user-scalable=no)', () => {
    const viewport = /<meta name="viewport" content="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(viewport).not.toMatch(/maximum-scale/);
    expect(viewport).not.toMatch(/user-scalable/);
  });
});
