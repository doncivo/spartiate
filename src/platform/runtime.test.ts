import { describe, expect, it } from 'vitest';
import { detectOs } from './runtime';

/** SHELL-0294e (C-163, D-616) : le système se lit dans l'agent utilisateur ; inconnu : « other » (noté au journal par `openLogJournal`, osUnknown.test.ts). */
describe('detectOs (C-163)', () => {
  it('reconnaît Windows et l’iPhone par l’agent utilisateur', () => {
    expect(detectOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/130.0')).toBe('windows');
    expect(detectOs('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios');
  });

  it('un agent utilisateur inconnu ou vide donne « other »', () => {
    expect(detectOs('')).toBe('other');
    expect(detectOs('Mozilla/5.0 (X11; Linux x86_64)')).toBe('other');
  });
});
