/**
 * Assiette (PRD § 15.3, C-194) : composition d'un repas à plusieurs aliments avant écriture. Chaque aliment devient une entrée de
 * journal (provenance et valeurs figées comme une saisie par recherche) ; rien n'est écrit tant que l'assiette n'est pas confirmée.
 * Un nutriment inconnu d'un aliment rend le total correspondant inconnu : jamais 0. Module pur.
 */

import { computeTotals, FOOD_GRAMS_MAX, type Totals } from './food';
import type { SearchableFood } from './foodSearch';
import type { MealEntryDraft } from './mealEntry';
import type { LocalDate, LocalTime } from '../types';

export interface PlateItem {
  readonly food: SearchableFood;
  readonly grams: number;
  /** C-100 : « scan » quand l'aliment vient d'un code lu par la caméra ; « search » sinon. */
  readonly method?: 'search' | 'scan';
}

export type Plate = readonly PlateItem[];

const tenth = (n: number): number => Math.round(n * 10) / 10;

/** Ajoute un aliment ; le même aliment cumule ses grammes. Grammes invalides ou cumul au-delà du plafond : assiette inchangée. */
export function addToPlate(plate: Plate, food: SearchableFood, grams: number, method: 'search' | 'scan' = 'search'): Plate {
  if (computeTotals(food.per100g, grams) === null) return plate;
  const existing = plate.find((i) => i.food.ref === food.ref);
  if (existing === undefined) return [...plate, method === 'scan' ? { food, grams, method } : { food, grams }];
  const sum = tenth(existing.grams + grams);
  if (sum > FOOD_GRAMS_MAX) return plate;
  return plate.map((i) => (i === existing ? { ...i, grams: sum } : i));
}

export const removeFromPlate = (plate: Plate, ref: string): Plate => plate.filter((i) => i.food.ref !== ref);

/** Totaux de l'assiette ; `null` par nutriment si l'assiette est vide ou si un aliment l'ignore. */
export function plateTotals(plate: Plate): Totals {
  const sum = (pick: (t: Totals) => number | null): number | null => {
    if (plate.length === 0) return null;
    let total = 0;
    for (const item of plate) {
      const totals = computeTotals(item.food.per100g, item.grams);
      const v = totals === null ? null : pick(totals);
      if (v === null) return null;
      total += v;
    }
    return tenth(total);
  };
  return { kcal: sum((t) => t.kcal), proteinG: sum((t) => t.proteinG), fatG: sum((t) => t.fatG), carbG: sum((t) => t.carbG) };
}

/** Une entrée par aliment, même jour et même heure ; `null` si l'assiette est vide ou contient une quantité invalide. */
export function plateEntries(plate: Plate, at: { readonly date: LocalDate; readonly time: LocalTime }): MealEntryDraft[] | null {
  if (plate.length === 0) return null;
  const drafts: MealEntryDraft[] = [];
  for (const { food, grams, method } of plate) {
    const totals = computeTotals(food.per100g, grams);
    if (totals === null) return null;
    drafts.push({ date: at.date, time: at.time, foodId: food.ref, foodName: food.name.slice(0, 200), source: food.provenance, grams, ...totals, method: method ?? 'search', confidence: null });
  }
  return drafts;
}
