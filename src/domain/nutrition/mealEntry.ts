/**
 * Entrée du journal alimentaire (PRD § 15.3, § 20.2 ; I4-02). Module pur. `method` : comment la ligne est entrée ; `source` : d'où viennent
 * ses valeurs (provenance affichée). Les valeurs sont un INSTANTANÉ (nom et totaux) : supprimer une fiche ne change pas le journal.
 * Une valeur inconnue est `null`, jamais zéro (§ 15.1).
 */

import { isLocalDate, isLocalTime, type LocalDate, type LocalTime } from '../types';
import { ENTRY_NAME_MAX, ENTRY_SOURCES, FOOD_GRAMS_MAX, KCAL_PER_100G_MAX, parseFoodId, parseRecipeFoodId, type EntrySource } from './food';
import type { MealEntryInput } from './types';

export const ENTRY_METHODS = ['search', 'scan', 'photo', 'quickadd'] as const;
export type EntryMethod = (typeof ENTRY_METHODS)[number];

/** Plafond d'une ligne Quick Add, en kcal. */
export const QUICK_ADD_KCAL_MAX = 10_000;

export interface MealEntryDraft {
  readonly date: LocalDate;
  readonly time: LocalTime;
  /** `ciqual:<code>` ou UUID de fiche ; `null` pour un Quick Add ou une estimation sans aliment reconnu. */
  readonly foodId: string | null;
  /** Nom figé au moment de la saisie. */
  readonly foodName: string;
  readonly source: EntrySource;
  readonly grams: number | null;
  readonly kcal: number | null;
  readonly proteinG: number | null;
  readonly fatG: number | null;
  readonly carbG: number | null;
  readonly method: EntryMethod;
  /** 0 à 1 ; `null` quand sans objet (saisie exacte). Obligatoire pour une estimation de photo. */
  readonly confidence: number | null;
}

export type MealEntryIssue =
  | 'date-invalid'
  | 'time-invalid'
  | 'name-empty'
  | 'name-too-long'
  | 'method-invalid'
  | 'source-invalid'
  | 'source-method-mismatch'
  | 'source-food-mismatch'
  | 'food-required'
  | 'food-id-invalid'
  | 'grams-required'
  | 'grams-invalid'
  | 'value-invalid'
  | 'kcal-required'
  | 'energy-inconsistent'
  | 'macros-exceed-grams'
  | 'confidence-invalid'
  | 'confidence-required';

const SOURCES_BY_METHOD: Readonly<Record<EntryMethod, readonly EntrySource[]>> = {
  search: ['custom', 'ciqual', 'off'],
  scan: ['custom', 'off'],
  photo: ['estimate'],
  quickadd: ['manual'],
};

const known = (v: number | null): v is number => v !== null && Number.isFinite(v);

export function validateMealEntry(draft: MealEntryDraft): MealEntryIssue[] {
  const issues: MealEntryIssue[] = [];
  const add = (issue: MealEntryIssue): void => {
    if (!issues.includes(issue)) issues.push(issue);
  };
  if (!isLocalDate(draft.date)) add('date-invalid');
  if (!isLocalTime(draft.time)) add('time-invalid');
  const name = draft.foodName.trim();
  if (name.length === 0) add('name-empty');
  else if (name.length > ENTRY_NAME_MAX) add('name-too-long');

  const methodOk = (ENTRY_METHODS as readonly string[]).includes(draft.method);
  const sourceOk = (ENTRY_SOURCES as readonly string[]).includes(draft.source);
  if (!methodOk) add('method-invalid');
  if (!sourceOk) add('source-invalid');
  if (methodOk && sourceOk && !SOURCES_BY_METHOD[draft.method].includes(draft.source)) add('source-method-mismatch');

  const numbers = [draft.grams, draft.kcal, draft.proteinG, draft.fatG, draft.carbG];
  if (numbers.some((v) => v !== null && (!Number.isFinite(v) || v < 0))) add('value-invalid');
  if (draft.confidence !== null && (!Number.isFinite(draft.confidence) || draft.confidence < 0 || draft.confidence > 1)) add('confidence-invalid');

  // Aliment : obligatoire en recherche et en scan, absent en Quick Add, facultatif pour une estimation ; cohérent avec la provenance.
  const ref = draft.foodId === null ? null : parseFoodId(draft.foodId);
  // I4-07 (D-80) : une prise de recette cite `recipe:<UUID>` et n'a pas d'autre provenance que `custom`.
  const recipeRef = draft.foodId === null ? null : parseRecipeFoodId(draft.foodId);
  if (draft.foodId !== null && ref === null && recipeRef === null) add('food-id-invalid');
  if (recipeRef !== null && sourceOk && draft.source !== 'custom') add('source-food-mismatch');
  if (methodOk) {
    if ((draft.method === 'search' || draft.method === 'scan') && draft.foodId === null) add('food-required');
    if (draft.method === 'quickadd' && draft.foodId !== null) add('food-id-invalid');
  }
  if (ref !== null && sourceOk && ['custom', 'ciqual', 'off'].includes(draft.source)) {
    if ((draft.source === 'ciqual') !== (ref.kind === 'ciqual')) add('source-food-mismatch');
  }

  // Grammes : obligatoires partout sauf en Quick Add (où ils sont absents).
  if (draft.method === 'quickadd') {
    if (draft.grams !== null) add('grams-invalid');
    if (!known(draft.kcal)) add('kcal-required');
    else if (draft.kcal > QUICK_ADD_KCAL_MAX) add('value-invalid');
  } else if (draft.grams === null) add('grams-required');
  else if (!Number.isFinite(draft.grams) || draft.grams <= 0 || draft.grams > FOOD_GRAMS_MAX) add('grams-invalid');

  if (draft.method === 'photo' && draft.confidence === null) add('confidence-required');

  // Totaux cohérents avec la masse de la prise.
  if (known(draft.grams) && draft.grams > 0) {
    if (known(draft.kcal) && draft.kcal > (KCAL_PER_100G_MAX * draft.grams) / 100 + 0.5) add('energy-inconsistent');
    if (known(draft.proteinG) && known(draft.fatG) && known(draft.carbG) && draft.proteinG + draft.fatG + draft.carbG > draft.grams * 1.005 + 0.1) add('macros-exceed-grams');
  }
  return issues;
}

/** Entrée vue par le moteur (D-74 point 1 : la date civile enregistrée avec l'entrée, sans conversion). */
export function toMealEntryInput(draft: Pick<MealEntryDraft, 'date' | 'time' | 'kcal' | 'proteinG' | 'fatG' | 'carbG'>): MealEntryInput {
  return { date: draft.date, time: draft.time, kcal: draft.kcal, proteinG: draft.proteinG, fatG: draft.fatG, carbG: draft.carbG };
}
