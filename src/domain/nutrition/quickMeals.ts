/**
 * Saisie rapide des repas (PRD § 15.3 ; REPAS-029a, D-410 : règles locales, aucune IA). Module pur.
 * Le modèle n'a pas de colonne « repas » : un repas = les entrées d'un même jour et d'un même moment de la journée (`mealMoment`).
 * Les favoris sont des recettes d'une portion (tables `recipe` et `recipe_ingredient` déjà publiées : aucune table nouvelle).
 * Une valeur inconnue reste `null`, jamais 0 (§ 15.1).
 */

import type { LocalDate, LocalTime } from '../types';
import { computeTotals, FOOD_GRAMS_MAX, type Per100g } from './food';
import { validateMealEntry, type MealEntryDraft } from './mealEntry';
import { validateRecipeDraft } from './recipe';
import { RECIPE_INGREDIENT_NAME_MAX, type IngredientSource, type Recipe, type RecipeDraft } from './recipeTypes';
import { isRenphoDayEntry } from './renphoDay';

export const MEAL_MOMENTS = ['morning', 'midday', 'afternoon', 'evening'] as const;
export type MealMoment = (typeof MEAL_MOMENTS)[number];

/** Matin avant 11:00, midi de 11:00 à 14:59, après-midi de 15:00 à 17:59, soir dès 18:00. */
export function mealMoment(time: LocalTime): MealMoment {
  const hour = Number(time.slice(0, 2));
  return hour < 11 ? 'morning' : hour < 15 ? 'midday' : hour < 18 ? 'afternoon' : 'evening';
}

/** Ligne d'un repas : une entrée sans sa date (la date est posée à l'écriture). */
export type MealLine = Omit<MealEntryDraft, 'date'>;

const toLine = (e: MealEntryDraft): MealLine => ({
  time: e.time, foodId: e.foodId, foodName: e.foodName, source: e.source, grams: e.grams, kcal: e.kcal, proteinG: e.proteinG, fatG: e.fatG, carbG: e.carbG, method: e.method, confidence: e.confidence,
});

/** Lignes copiables des entrées (le total du jour importé de Renpho n'est jamais un repas). */
export const mealLines = (entries: readonly MealEntryDraft[]): MealLine[] => entries.filter((e) => !isRenphoDayEntry(e)).map(toLine);

export const entriesOfMoment = <E extends { readonly time: LocalTime }>(entries: readonly E[], moment: MealMoment): E[] => entries.filter((e) => mealMoment(e.time) === moment);

const tenth = (n: number): number => Math.round(n * 10) / 10;

/** Même ligne pour d'autres grammes : valeurs au prorata. `null` si la ligne n'a pas de grammes ou si les grammes sont invalides. */
export function scaleLine(line: MealLine, grams: number): MealLine | null {
  if (line.grams === null || line.grams <= 0) return null;
  if (!Number.isFinite(grams) || grams <= 0 || grams > FOOD_GRAMS_MAX) return null;
  const ratio = grams / line.grams;
  const of = (v: number | null): number | null => (v === null ? null : tenth(v * ratio));
  return { ...line, grams, kcal: of(line.kcal), proteinG: of(line.proteinG), fatG: of(line.fatG), carbG: of(line.carbG) };
}

/** Entrées à écrire : toutes valides ou `null` (tout ou rien). `time` : heure imposée, ou `null` pour garder celle de chaque ligne. */
export function linesToDrafts(lines: readonly MealLine[], date: LocalDate, time: LocalTime | null): MealEntryDraft[] | null {
  if (lines.length === 0) return null;
  const drafts = lines.map((l): MealEntryDraft => ({ ...l, date, time: time ?? l.time }));
  return drafts.every((d) => validateMealEntry(d).length === 0) ? drafts : null;
}

export interface RecentMeal {
  readonly date: LocalDate;
  readonly moment: MealMoment;
  readonly lines: readonly MealLine[];
  /** Total ; `null` si une ligne ignore ses calories. */
  readonly kcal: number | null;
}

/** Repas des jours passés (jour d'aujourd'hui compris), du plus récent au plus ancien, `limit` au plus. */
export function recentMeals(entries: readonly MealEntryDraft[], today: LocalDate, limit: number): RecentMeal[] {
  const groups = new Map<string, MealEntryDraft[]>();
  for (const e of entries) {
    if (e.date > today || isRenphoDayEntry(e)) continue;
    const key = `${e.date}/${mealMoment(e.time)}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const [da = '', ma = ''] = a.split('/');
      const [db = '', mb = ''] = b.split('/');
      return da !== db ? (da < db ? 1 : -1) : MEAL_MOMENTS.indexOf(mb as MealMoment) - MEAL_MOMENTS.indexOf(ma as MealMoment);
    })
    .slice(0, Math.max(0, limit))
    .map(([key, list]) => {
      const [date = '', moment = ''] = key.split('/');
      const sorted = [...list].sort((x, y) => (x.time < y.time ? -1 : x.time > y.time ? 1 : 0));
      const kcals = sorted.map((e) => e.kcal);
      return { date: date as LocalDate, moment: moment as MealMoment, lines: sorted.map(toLine), kcal: kcals.some((k) => k === null) ? null : tenth(kcals.reduce<number>((s, k) => s + (k ?? 0), 0)) };
    });
}

const hundredth = (n: number): number => Math.round(n * 100) / 100;
const INGREDIENT_SOURCES: readonly string[] = ['custom', 'ciqual', 'off'];

function per100gOf(line: MealLine): Per100g | null {
  const g = line.grams;
  if (g === null || g <= 0) return null;
  const of = (v: number | null): number | null => (v === null ? null : hundredth((v / g) * 100));
  return { kcal: of(line.kcal), proteinG: of(line.proteinG), fatG: of(line.fatG), carbG: of(line.carbG), fiberG: null };
}

export interface FavoriteDraft {
  readonly draft: RecipeDraft;
  /** Lignes non enregistrées : sans aliment, sans grammes, estimation de photo ou valeurs hors bornes. */
  readonly skipped: number;
}

/** Favori = recette d'une portion. `null` : nom vide, aucune ligne enregistrable ou brouillon invalide. */
export function favoriteFromLines(name: string, lines: readonly MealLine[]): FavoriteDraft | null {
  const trimmed = name.trim();
  if (trimmed === '') return null;
  const ingredients: RecipeDraft['ingredients'][number][] = [];
  for (const line of lines) {
    const per100g = per100gOf(line);
    if (per100g === null || line.foodId === null || line.grams === null || !INGREDIENT_SOURCES.includes(line.source)) continue;
    const candidate = { name: line.foodName.slice(0, RECIPE_INGREDIENT_NAME_MAX), source: line.source as IngredientSource, foodRef: line.foodId, grams: line.grams, per100g };
    if (validateRecipeDraft({ name: trimmed, servings: 1, cookedWeightG: null, ingredients: [candidate] }).length === 0) ingredients.push(candidate);
  }
  if (ingredients.length === 0) return null;
  const draft: RecipeDraft = { name: trimmed, servings: 1, cookedWeightG: null, ingredients };
  if (validateRecipeDraft(draft).length > 0) return null;
  return { draft, skipped: lines.length - ingredients.length };
}

/** Lignes d'un favori (une par ingrédient, méthode « search ») à l'heure de référence `12:00`, remplacée à l'écriture. */
export function linesFromRecipe(recipe: Pick<Recipe, 'ingredients'>): MealLine[] {
  const out: MealLine[] = [];
  for (const ing of recipe.ingredients) {
    const totals = computeTotals(ing.per100g, ing.grams);
    if (totals === null || ing.foodRef === null) continue;
    out.push({ time: '12:00' as LocalTime, foodId: ing.foodRef, foodName: ing.name, source: ing.source, grams: ing.grams, ...totals, method: 'search', confidence: null });
  }
  return out;
}
