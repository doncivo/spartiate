import { describe, expect, it } from 'vitest';
import { catalogText } from './catalogText';
import { tRoutines } from './formatRoutine';

/** SHELL-0295 (C-085, D-638) : traducteur d'un catalogue à part, paramètres `{x}` typés comme ceux de `t()`. */
const sample = { plain: 'Bonjour', one: '{n} jour', two: '{a} sur {b}' } as const;
const tSample = catalogText(sample);

describe('catalogText : paramètres typés', () => {
  it('texte sans paramètre, puis avec un et deux paramètres', () => {
    expect(tSample('plain')).toBe('Bonjour');
    expect(tSample('one', { n: 3 })).toBe('3 jour');
    expect(tSample('two', { a: 1, b: '2' })).toBe('1 sur 2');
  });

  it('le typage refuse un paramètre manquant ou inconnu (contrôlé par tsc)', () => {
    // @ts-expect-error paramètre `n` manquant
    expect(tSample('one')).toBe('{n} jour');
    // @ts-expect-error paramètre `x` inconnu du texte
    expect(tSample('one', { n: 1, x: 2 })).toBe('1 jour');
  });

  it('tRoutines lit le catalogue hérité sans passer par l’arbre `fr.ts` du départ', () => {
    expect(tRoutines('timesPerWeek', { count: 3 })).toBe('3 fois par semaine');
  });
});
