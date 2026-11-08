import { describe, expect, it } from 'vitest';
import { addFavorite, FAVORITES_MAX, isFavorite, parseFavorites, removeFavorite, resolveFavorites, serializeFavorites, toggleFavorite, type Favorite } from './favorites';

const ID1 = '10000000-0000-4000-8000-000000000001';
const ID2 = '10000000-0000-4000-8000-000000000002';
const cq = (code: string): Favorite => ({ source: 'ciqual', ref: `ciqual:${code}` });
const custom = (id: string): Favorite => ({ source: 'custom', ref: id });

describe('I4-06 : favoris, lecture tolérante', () => {
  it('valeur absente, corrompue ou d’une autre forme : liste vide, jamais d’exception', () => {
    for (const raw of [undefined, null, 3, 'x', [], {}, { v: 2, items: [cq('1')] }, { v: 1 }, { v: 1, items: 'x' }]) {
      expect(parseFavorites(raw)).toEqual([]);
    }
  });

  it('écarte les éléments illisibles et garde les autres, dans l’ordre', () => {
    const raw = { v: 1, items: [cq('2'), null, 4, { source: 'zzz', ref: ID1 }, { source: 'ciqual', ref: ID1 }, { source: 'custom', ref: 'ciqual:3' }, { source: 'custom', ref: 'pas-un-id' }, custom(ID1), { source: 'off', ref: ID2 }] };
    expect(parseFavorites(raw)).toEqual([cq('2'), custom(ID1), { source: 'off', ref: ID2 }]);
  });

  it('dédoublonne par référence (la première occurrence gagne) et borne à 200', () => {
    expect(parseFavorites({ v: 1, items: [cq('2'), cq('2'), cq('3')] })).toEqual([cq('2'), cq('3')]);
    const many = Array.from({ length: 300 }, (_, i) => cq(String(i + 1)));
    const parsed = parseFavorites({ v: 1, items: many });
    expect(parsed).toHaveLength(FAVORITES_MAX);
    expect(parsed[0]).toEqual(cq('1'));
  });

  it('sérialise en { v: 1, items } et se relit à l’identique', () => {
    const list = [cq('2'), custom(ID1)];
    expect(serializeFavorites(list)).toEqual({ v: 1, items: list });
    expect(parseFavorites(serializeFavorites(list))).toEqual(list);
  });
});

describe('I4-06 : favoris, ajout, retrait, bascule', () => {
  it('ajoute en tête sans doublon, retire, bascule', () => {
    expect(addFavorite([cq('1')], cq('2'))).toEqual([cq('2'), cq('1')]);
    expect(addFavorite([cq('1')], cq('1'))).toEqual([cq('1')]);
    expect(removeFavorite([cq('1'), cq('2')], 'ciqual:1')).toEqual([cq('2')]);
    expect(removeFavorite([cq('1')], 'ciqual:9')).toEqual([cq('1')]);
    expect(toggleFavorite([cq('1')], cq('2'))).toEqual([cq('2'), cq('1')]);
    expect(toggleFavorite([cq('2'), cq('1')], cq('2'))).toEqual([cq('1')]);
    expect(isFavorite([cq('1')], 'ciqual:1')).toBe(true);
    expect(isFavorite([cq('1')], 'ciqual:2')).toBe(false);
  });

  it('au-delà de 200, le plus ancien sort', () => {
    const full = Array.from({ length: FAVORITES_MAX }, (_, i) => cq(String(i + 1)));
    const next = addFavorite(full, cq('999'));
    expect(next).toHaveLength(FAVORITES_MAX);
    expect(next[0]).toEqual(cq('999'));
    expect(isFavorite(next, 'ciqual:200')).toBe(false);
  });

  it('ne modifie pas la liste d’origine', () => {
    const list = [cq('1')];
    toggleFavorite(list, cq('2'));
    expect(list).toEqual([cq('1')]);
  });
});

describe('I4-06 : favoris, résolution', () => {
  it('un favori dont l’aliment n’existe plus disparaît sans erreur et sort de la liste conservée', async () => {
    const out = await resolveFavorites([cq('1'), custom(ID1), cq('3')], async (ref) => (ref === 'ciqual:1' ? { ref } : null));
    expect(out.foods).toEqual([{ ref: 'ciqual:1' }]);
    expect(out.kept).toEqual([cq('1')]);
    expect(out.changed).toBe(true);
  });

  it('une résolution en échec (lecture impossible) n’affiche pas le favori mais ne l’efface pas', async () => {
    const out = await resolveFavorites([cq('1'), custom(ID1)], async (ref) => {
      if (ref === ID1) throw new Error('base illisible');
      return { ref };
    });
    expect(out.foods).toEqual([{ ref: 'ciqual:1' }]);
    expect(out.kept).toEqual([cq('1'), custom(ID1)]);
    expect(out.changed).toBe(false);
  });

  it('tout résolu : liste inchangée, changed faux', async () => {
    const out = await resolveFavorites([cq('1')], async (ref) => ({ ref }));
    expect(out.kept).toEqual([cq('1')]);
    expect(out.changed).toBe(false);
  });
});
