import { describe, expect, it } from 'vitest';
import { catalogText, type PlainCatalogKey } from './catalogText';
import { tPlural } from './plural';
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

  it('CLEAN-0296 : clés sans paramètre et pluriel par un traducteur typé (contrôlés par tsc)', () => {
    const plain: PlainCatalogKey<typeof sample> = 'plain';
    // @ts-expect-error `one` attend `{n}` : pas une clé sans paramètre
    const notPlain: PlainCatalogKey<typeof sample> = 'one';
    expect([tSample(plain), notPlain]).toEqual(['Bonjour', 'one']);
    const counts = catalogText({ one: '{n} jour', other: '{n} jours', of: '{n} sur {total}', ofs: '{n} sur {total}s' } as const);
    expect(tPlural(counts, 3, 'one', 'other')).toBe('3 jours');
    expect(tPlural(counts, 1, 'of', 'ofs', { total: 4 })).toBe('1 sur 4');
    // @ts-expect-error `{total}` manquant
    expect(tPlural(counts, 2, 'of', 'ofs')).toBe('2 sur {total}s');
    // @ts-expect-error `n` vient du compteur : interdit dans `params` (relecture à froid de CLEAN-0296)
    expect(tPlural(counts, 2, 'of', 'ofs', { total: 4, n: 5 })).toBe('2 sur 4s');
  });

  it('tRoutines lit le catalogue hérité sans passer par l’arbre `fr.ts` du départ', () => {
    expect(tRoutines('timesPerWeek', { count: 3 })).toBe('3 fois par semaine');
  });
});
