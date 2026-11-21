import { describe, expect, it } from 'vitest';
import type { LocalDate, LocalTime } from '../types';
import type { SearchableFood } from './foodSearch';
import { addToPlate, plateEntries, plateTotals, removeFromPlate } from './plate';

/** NUTRI-c (§ 15.3, C-194) : l'assiette compose plusieurs aliments puis les écrit ensemble ; un nutriment inconnu reste inconnu, jamais 0. Valeurs synthétiques. */
const skyr: SearchableFood = { ref: 'ciqual:1', provenance: 'ciqual', name: 'Skyr', brand: null, barcode: null, per100g: { kcal: 60, proteinG: 11, fatG: 0.2, carbG: 4, fiberG: null } };
const honey: SearchableFood = { ref: '60000000-0000-4000-8000-0000000000b1', provenance: 'custom', name: 'Miel', brand: null, barcode: null, per100g: { kcal: 300, proteinG: null, fatG: 0, carbG: 80, fiberG: null } };
const AT = { date: '2026-11-20' as LocalDate, time: '12:30' as LocalTime };

describe('NUTRI-c : assiette', () => {
  it('ajoute des aliments ; le même aliment cumule ses grammes', () => {
    const plate = addToPlate(addToPlate(addToPlate([], skyr, 100), honey, 20), skyr, 50);
    expect(plate.map((i) => [i.food.ref, i.grams])).toEqual([['ciqual:1', 150], [honey.ref, 20]]);
  });
  it('grammes invalides (0, négatifs, NaN, > 10 000) : l’assiette ne change pas', () => {
    for (const g of [0, -5, Number.NaN, 10_001]) expect(addToPlate([], skyr, g)).toEqual([]);
  });
  it('totaux : 150 g de skyr + 20 g de miel = 90 + 60 = 150 kcal ; les protéines du miel inconnues rendent le total inconnu', () => {
    const t = plateTotals(addToPlate(addToPlate([], skyr, 150), honey, 20));
    expect(t.kcal).toBe(150);
    expect(t.carbG).toBe(22);
    expect(t.fatG).toBe(0.3);
    expect(t.proteinG).toBeNull();
  });
  it('assiette vide : tout est inconnu, jamais 0', () => {
    expect(plateTotals([])).toEqual({ kcal: null, proteinG: null, fatG: null, carbG: null });
  });
  it('retire un aliment par sa référence', () => {
    const plate = removeFromPlate(addToPlate(addToPlate([], skyr, 100), honey, 20), skyr.ref);
    expect(plate.map((i) => i.food.ref)).toEqual([honey.ref]);
  });
  it('entrées : une par aliment, même jour et même heure, méthode « search », provenance conservée', () => {
    const drafts = plateEntries(addToPlate(addToPlate([], skyr, 150), honey, 20), AT);
    expect(drafts).toHaveLength(2);
    expect(drafts?.map((d) => [d.foodId, d.source, d.method, d.grams, d.kcal, d.time])).toEqual([
      ['ciqual:1', 'ciqual', 'search', 150, 90, '12:30'],
      [honey.ref, 'custom', 'search', 20, 60, '12:30'],
    ]);
  });
  it('assiette vide : aucune entrée (null)', () => {
    expect(plateEntries([], AT)).toBeNull();
  });
});
