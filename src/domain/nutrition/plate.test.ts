import { describe, expect, it } from 'vitest';
import type { LocalDate, LocalTime } from '../types';
import type { SearchableFood } from './foodSearch';
import { addToPlate, plateEntries, plateToRecipeDraft, plateTotals, removeFromPlate, setPlateGrams, setPlateTime } from './plate';

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

describe('BL-117 : assiette modifiable', () => {
  it('grammes modifiables ; valeur invalide : assiette inchangée ; autre aliment inchangé', () => {
    const plate = addToPlate(addToPlate([], skyr, 100), honey, 20);
    expect(setPlateGrams(plate, 'ciqual:1', 250).map((i) => i.grams)).toEqual([250, 20]);
    expect(setPlateGrams(plate, 'ciqual:1', 0)).toBe(plate);
    expect(setPlateGrams(plate, 'ciqual:1', 10_001)).toBe(plate);
    expect(setPlateGrams(plate, 'absent', 5)).toBe(plate);
  });

  it('heure propre à un aliment : l’entrée écrite la porte ; sans heure propre, celle de l’assiette ; heure invalide refusée', () => {
    const plate = setPlateTime(addToPlate(addToPlate([], skyr, 100), honey, 20), honey.ref, '08:15' as LocalTime);
    expect(plateEntries(plate, AT)?.map((e) => e.time)).toEqual(['12:30', '08:15']);
    expect(setPlateTime(plate, honey.ref, '25:00' as LocalTime)).toBe(plate);
    expect(plateEntries(setPlateTime(plate, honey.ref, null), AT)?.map((e) => e.time)).toEqual(['12:30', '12:30']);
  });

  it('enregistrable en recette : une portion, un ingrédient par aliment (valeurs figées pour 100 g) ; nom vide ou assiette vide : null', () => {
    const plate = addToPlate(addToPlate([], skyr, 150), honey, 20);
    const draft = plateToRecipeDraft(plate, '  Petit-déj  ');
    expect(draft).toMatchObject({ name: 'Petit-déj', servings: 1, cookedWeightG: null });
    expect(draft?.ingredients.map((i) => [i.name, i.grams, i.source, i.foodRef])).toEqual([['Skyr', 150, 'ciqual', 'ciqual:1'], ['Miel', 20, 'custom', honey.ref]]);
    expect(draft?.ingredients[1]?.per100g.proteinG).toBeNull();
    expect(plateToRecipeDraft(plate, '   ')).toBeNull();
    expect(plateToRecipeDraft([], 'Vide')).toBeNull();
  });
});
