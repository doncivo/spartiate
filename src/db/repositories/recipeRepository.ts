import type { Recipe, RecipeDraft } from '../../domain/nutrition/recipeTypes';

/**
 * Recettes (tables `recipe` et `recipe_ingredient`, migration 0009 ; I4-07, § 15.3, § 20.2, D-80). Publiées (UUID).
 *
 * - Une recette porte l'instantané des valeurs pour 100 g de chaque ingrédient : aucune dépendance à `food` ni à Ciqual à la lecture.
 *   Valeur inconnue = `null`, jamais 0.
 * - La recette et ses ingrédients s'écrivent en UNE transaction (sur le driver, ouverte ici ; dans `DataAccess.transaction`, celle de l'appelant).
 * - `update` remplace la liste d'ingrédients PAR IDENTIFIANT : l'appelant (les écrans) repasse l'`id` de chaque ingrédient déjà enregistré ;
 *   la ligne est conservée (seuls les champs modifiés, rang compris, sont écrits donc publiés), un ingrédient sans `id` (ou d'`id` inconnu ou
 *   répété) est créé, les lignes non reprises sont supprimées logiquement. Rien n'est écrit si rien ne change. Jamais de réutilisation par
 *   rang : retirer l'ingrédient n°1 recopierait le suivant dans sa ligne et, avec une modification concurrente, fabriquerait un ingrédient hybride.
 * - Une prise d'une recette est une `meal_entry` ordinaire (`food_id` = `recipe:<UUID>`, source `custom`) : jamais modifiée par la recette.
 * - Entrée invalide (nom, portions, poids cuit, 1 à 60 ingrédients, grammes, bornes pour 100 g) : `RepositoryError('invalid')`, rien n'écrit.
 */
export interface RecipeRepository {
  /** Identifiant (UUID) fabriqué si omis ; collision (même supprimée) : `'conflict'`. */
  create(draft: RecipeDraft, options?: { readonly id?: string }): Promise<Recipe>;
  /** Remplace les champs et les ingrédients. Absente ou supprimée : `'not-found'`. */
  update(id: string, draft: RecipeDraft): Promise<Recipe>;
  /** Suppression logique de la recette et de ses ingrédients. Absente ou déjà supprimée : `'not-found'`. */
  softDelete(id: string): Promise<void>;
  /** Recette vivante avec ses ingrédients vivants (par rang), ou `null`. */
  get(id: string): Promise<Recipe | null>;
  /** Recettes vivantes triées par nom (sans tenir compte de la casse), avec leurs ingrédients. */
  list(): Promise<readonly Recipe[]>;
}
