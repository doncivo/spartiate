import type { FoodRepository } from '../../../db/repositories/foodRepository';
import { parseFoodId } from '../../../domain/nutrition/food';
import type { SearchableFood } from '../../../domain/nutrition/foodSearch';
import { loadCiqual } from '../catalogue/ciqualCatalogue';
import { toSearchable } from './catalogueSearch';

/**
 * Retrouve l'aliment d'une référence de journal (`ciqual:<code>` ou UUID de fiche) pour recalculer une prise : `null` si la fiche a été
 * supprimée ou la référence inconnue ; une lecture impossible (Ciqual illisible, base) LÈVE l'erreur. L'entrée de journal garde son instantané dans tous les cas.
 */
export async function resolveFood(foods: FoodRepository, id: string): Promise<SearchableFood | null> {
  const ref = parseFoodId(id);
  if (ref === null) return null;
  if (ref.kind === 'ciqual') {
    // Un catalogue illisible est une ERREUR (exception propagée), pas « aliment absent » : l'appelant ne doit pas effacer de favori.
    const catalogue = await loadCiqual();
    const found = catalogue.foods.find((f) => f.code === ref.code);
    return found ? { ref: id, provenance: 'ciqual', name: found.nameFr, brand: null, barcode: null, per100g: found.per100g } : null;
  }
  const record = await foods.get(ref.id);
  return record ? toSearchable(record) : null;
}
