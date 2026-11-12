import type { LocalDate, LocalTime } from '../types';
import type { MealEntryDraft } from './mealEntry';

/**
 * Nutrition importée de Santé (balance et app Renpho → Santé → Raccourcis ; I6-04, D-113). Règle « les deux selon les jours » :
 * - si Ali a saisi des repas dans le journal Spartiate pour un jour, le journal FAIT FOI : l'import n'écrit rien pour ce jour ;
 * - sinon UNE entrée « Renpho — total du jour » (jamais deux) porte les totaux importés ; un réimport met à jour la même entrée ;
 * - si Ali saisit ensuite un repas ce jour-là, l'entrée Renpho est REMPLACÉE (supprimée) par le journal ;
 * - une entrée Renpho supprimée par Ali ne revient pas.
 * L'entrée est un Quick Add manuel (aucune colonne nouvelle, aucune migration) reconnu par son nom figé. Module pur. Valeur inconnue : `null`, jamais 0.
 */

export const RENPHO_DAY_ENTRY_NAME = 'Renpho — total du jour';
/** Heure de l'entrée : le total couvre toute la journée, il est rangé en tête. */
const RENPHO_DAY_TIME = '00:00' as LocalTime;

export function isRenphoDayEntry(entry: Pick<MealEntryDraft, 'foodName' | 'method' | 'source' | 'foodId'>): boolean {
  return entry.foodName.trim() === RENPHO_DAY_ENTRY_NAME && entry.method === 'quickadd' && entry.source === 'manual' && entry.foodId === null;
}

export interface RenphoDayTotals {
  readonly kcal: number | null;
  readonly proteinG: number | null;
  readonly fatG: number | null;
  readonly carbG: number | null;
  readonly fiberG: number | null;
}

/** Brouillon de l'entrée du jour (Quick Add : énergie obligatoire, jamais de grammes ni d'aliment). */
export function renphoDayDraft(day: LocalDate, totals: RenphoDayTotals): MealEntryDraft {
  return {
    date: day,
    time: RENPHO_DAY_TIME,
    foodId: null,
    foodName: RENPHO_DAY_ENTRY_NAME,
    source: 'manual',
    grams: null,
    kcal: totals.kcal,
    proteinG: totals.proteinG,
    fatG: totals.fatG,
    carbG: totals.carbG,
    method: 'quickadd',
    confidence: null,
  };
}

export interface RenphoDayInput {
  readonly day: LocalDate;
  readonly totals: RenphoDayTotals;
  /** Au moins une entrée vivante du journal qui n'est pas une entrée Renpho. */
  readonly journalHasMeals: boolean;
  readonly renpho: {
    readonly live: { readonly id: string; readonly kcal: number | null; readonly proteinG: number | null; readonly fatG: number | null; readonly carbG: number | null } | null;
    /** Une entrée Renpho de ce jour existe, supprimée. */
    readonly deleted: boolean;
  };
}

export type RenphoDayPlan =
  | { readonly action: 'create'; readonly fiber: 'save' | 'none' }
  | { readonly action: 'update' | 'unchanged'; readonly id: string; readonly fiber: 'save' | 'none' }
  | { readonly action: 'supersede'; readonly id: string; readonly fiber: 'remove' }
  | { readonly action: 'skip'; readonly reason: 'journal' | 'deleted' | 'no-energy'; readonly fiber: 'none' };

/** Décide quoi faire d'un jour d'import (aucune écriture ici). */
export function planRenphoDay(input: RenphoDayInput): RenphoDayPlan {
  const { totals, renpho } = input;
  if (input.journalHasMeals) return renpho.live === null ? { action: 'skip', reason: 'journal', fiber: 'none' } : { action: 'supersede', id: renpho.live.id, fiber: 'remove' };
  if (totals.kcal === null) return { action: 'skip', reason: 'no-energy', fiber: 'none' };
  const fiber = totals.fiberG === null ? 'none' : 'save';
  if (renpho.live !== null) {
    const same = renpho.live.kcal === totals.kcal && renpho.live.proteinG === totals.proteinG && renpho.live.fatG === totals.fatG && renpho.live.carbG === totals.carbG;
    return { action: same ? 'unchanged' : 'update', id: renpho.live.id, fiber };
  }
  if (renpho.deleted) return { action: 'skip', reason: 'deleted', fiber: 'none' };
  return { action: 'create', fiber };
}
