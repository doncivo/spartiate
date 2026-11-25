import { describe, expect, it } from 'vitest';
import { groupCountKey } from './groupCount';

/** SHELL-0294e (C-084) : en français, 0 et 1 sont au singulier (« 0 groupe », jamais « 0 groupes »). */
describe('groupCountKey (C-084)', () => {
  it('0 et 1 au singulier, 2 et plus au pluriel', () => {
    expect(groupCountKey(0)).toBe('groupOne');
    expect(groupCountKey(1)).toBe('groupOne');
    expect(groupCountKey(2)).toBe('groupMany');
    expect(groupCountKey(8)).toBe('groupMany');
  });
});
