import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { STANDARD_PLATES_KG } from './config';
import { platesPerSide, standardPlates } from './plates';

/**
 * SESS-01c (§ 13.2 « calculateur de disques ») : disques par côté pour une charge totale, barre réglable, disques du profil (nombre par côté) ou
 * jeu standard. Recherche exacte (jamais un glouton qui manque une combinaison) : la plus grande charge atteignable sans dépasser la cible, à
 * égalité le moins de disques, puis les plus lourds d'abord. Le reste non atteignable est rendu, jamais caché.
 */

const one = (kgs: readonly number[]) => kgs.map((weightKg) => ({ weightKg, count: 1 }));

describe('jeu standard (config.ts)', () => {
  it('25, 20, 15, 10, 5, 2,5 et 1,25 kg, figé ; 10 de chaque par côté', () => {
    expect(STANDARD_PLATES_KG).toEqual([25, 20, 15, 10, 5, 2.5, 1.25]);
    expect(Object.isFrozen(STANDARD_PLATES_KG)).toBe(true);
    expect(standardPlates()).toEqual(STANDARD_PLATES_KG.map((weightKg) => ({ weightKg, count: 10 })));
  });
});

describe('platesPerSide', () => {
  it('jeu standard, barre de 20 kg : 100 kg → 25 + 15 par côté ; 82,5 kg → 25 + 5 + 1,25', () => {
    expect(platesPerSide(100, 20, standardPlates())).toEqual({ barKg: 20, perSide: [{ weightKg: 25, count: 1 }, { weightKg: 15, count: 1 }], loadedKg: 100, remainderKg: 0 });
    expect(platesPerSide(82.5, 20, standardPlates())?.perSide).toEqual([
      { weightKg: 25, count: 1 },
      { weightKg: 5, count: 1 },
      { weightKg: 1.25, count: 1 },
    ]);
  });

  it('disques du profil (un de chaque par côté, 1,25 à 30 kg) : 100 kg → 30 + 10 ; 140 kg → 30 + 25 + 5 (à égalité, les plus lourds d’abord)', () => {
    const gym = one([1.25, 2.5, 5, 10, 15, 20, 25, 30]);
    expect(platesPerSide(100, 20, gym)?.perSide).toEqual([
      { weightKg: 30, count: 1 },
      { weightKg: 10, count: 1 },
    ]);
    expect(platesPerSide(140, 20, gym)?.perSide).toEqual([
      { weightKg: 30, count: 1 },
      { weightKg: 25, count: 1 },
      { weightKg: 5, count: 1 },
    ]);
  });

  it('recherche exacte : 15 × 1 et 10 × 2 par côté, 60 kg sur 20 → 10 + 10 (un glouton dirait 15, reste 10)', () => {
    expect(platesPerSide(60, 20, [{ weightKg: 15, count: 1 }, { weightKg: 10, count: 2 }])).toEqual({ barKg: 20, perSide: [{ weightKg: 10, count: 2 }], loadedKg: 60, remainderKg: 0 });
  });

  it('charge non atteignable : la plus proche en dessous et le reste ; barre seule ; sous la barre ou valeur illisible : null', () => {
    expect(platesPerSide(35, 20, [{ weightKg: 2.5, count: 1 }, { weightKg: 10, count: 1 }])).toEqual({ barKg: 20, perSide: [{ weightKg: 2.5, count: 1 }], loadedKg: 25, remainderKg: 10 });
    expect(platesPerSide(21, 20, standardPlates())).toEqual({ barKg: 20, perSide: [], loadedKg: 20, remainderKg: 1 });
    expect(platesPerSide(20, 20, standardPlates())).toEqual({ barKg: 20, perSide: [], loadedKg: 20, remainderKg: 0 });
    expect(platesPerSide(15, 20, standardPlates())).toBeNull();
    for (const bad of [Number.NaN, -5, Number.POSITIVE_INFINITY]) expect(platesPerSide(bad, 20, standardPlates())).toBeNull();
    expect(platesPerSide(60, Number.NaN, standardPlates())).toBeNull();
  });

  it('barre réglable (8 kg) : 30,5 kg → 10 + 1,25 ; propriétés : jamais au-dessus de la cible, symétrique, déterministe', () => {
    expect(platesPerSide(30.5, 8, standardPlates())?.perSide).toEqual([
      { weightKg: 10, count: 1 },
      { weightKg: 1.25, count: 1 },
    ]);
    fc.assert(
      fc.property(fc.integer({ min: 80, max: 1200 }), (quarters) => {
        const total = quarters * 0.25;
        const r = platesPerSide(total, 20, standardPlates());
        if (r === null) return;
        const side = r.perSide.reduce((sum, p) => sum + p.weightKg * p.count, 0);
        expect(r.loadedKg).toBeCloseTo(20 + 2 * side, 9);
        expect(r.loadedKg).toBeLessThanOrEqual(total + 1e-9);
        expect(r.remainderKg).toBeCloseTo(total - r.loadedKg, 9);
        expect(platesPerSide(total, 20, standardPlates())).toEqual(r);
      }),
    );
  });
});
