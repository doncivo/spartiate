import { describe, expect, it } from 'vitest';
import { parseNumber } from './shared';

/** Revue à froid de FIX-SAISIE-NUTRI (suggestion 2, D-344) : saisie française des nombres. */
describe('parseNumber : nombres saisis en français', () => {
  it.each([
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['1 200', 1200],
    ['1 200', 1200],
    ['1 200,5', 1200.5],
    [' 42 ', 42],
    ['0', 0],
  ])('« %s » -> %s', (text, value) => {
    expect(parseNumber(text)).toBe(value);
  });

  it('vide : inconnu (null)', () => {
    expect(parseNumber('   ')).toBeNull();
  });

  it.each(['abc', '-3', '1e3', '0x10', '12,5,1', '1.2.3', 'Infinity', ',5'])('« %s » : refusé (undefined)', (text) => {
    expect(parseNumber(text)).toBeUndefined();
  });
});
