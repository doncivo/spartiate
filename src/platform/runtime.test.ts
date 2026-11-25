import { describe, expect, it } from 'vitest';
import { detectOs } from './runtime';

/** SHELL-0294e (C-163) : un agent utilisateur inconnu ne masque plus, sans trace, la synchro et les sauvegardes. */
describe('detectOs (C-163)', () => {
  it('reconnaît Windows et l’iPhone par l’agent utilisateur', () => {
    expect(detectOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/130.0')).toBe('windows');
    expect(detectOs('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios');
  });

  it('retombe sur la plateforme déclarée quand l’agent utilisateur est inconnu', () => {
    expect(detectOs('', 'Win32')).toBe('windows');
    expect(detectOs('Mozilla/5.0 (X11)', 'iPhone')).toBe('ios');
    expect(detectOs('Mozilla/5.0 (X11)', 'iPad')).toBe('ios');
  });

  it('reste « other » quand ni l’agent ni la plateforme ne disent rien de sûr', () => {
    expect(detectOs('', '')).toBe('other');
    expect(detectOs('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64')).toBe('other');
  });
});
