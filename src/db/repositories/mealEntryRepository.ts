import type { EntrySource } from '../../domain/nutrition/food';
import type { EntryMethod, MealEntryDraft } from '../../domain/nutrition/mealEntry';
import type { DeviceId, Hlc, IsoDateTime, LocalDate, LocalTime } from '../../domain/types';

/**
 * Journal alimentaire (table `meal_entry`, migration 0008 ; I4-02, § 15.3, § 20.2). Publié (UUID).
 *
 * - Les valeurs sont validées par le domaine (`validateMealEntry`) : refus `'invalid'`, rien n'est écrit. Kcal et macros sont un instantané
 *   NULLABLE (inconnu = `null`, jamais 0) ; `foodName` fige le nom ; `foodId` est une référence logique (`ciqual:<code>` ou UUID).
 * - Une ligne issue d'une photo (`method photo`, `source estimate`) reste corrigeable avant et après enregistrement (`update`).
 * - I6-04 (D-113) : toute entrée écrite pour un jour (création, modification) SUPPRIME l'entrée « Renpho — total du jour » vivante de ce jour : le journal
 *   Spartiate fait foi (`supersedeRenpho`). Écrire l'entrée Renpho elle-même ne supprime rien.
 * - `createMany` valide TOUTES les entrées avant d'écrire la première ; à appeler dans `DataAccess.transaction` pour l'atomicité.
 */

export interface MealEntryRecord extends MealEntryDraft {
  readonly id: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface RecentFood {
  readonly foodId: string;
  readonly foodName: string;
  readonly source: EntrySource;
  readonly lastGrams: number;
  readonly lastDate: LocalDate;
  readonly lastTime: LocalTime;
  readonly lastMethod: EntryMethod;
}

export interface MealEntryRepository {
  create(draft: MealEntryDraft, options?: { readonly id?: string }): Promise<MealEntryRecord>;
  createMany(drafts: readonly MealEntryDraft[]): Promise<readonly MealEntryRecord[]>;
  /** Champs fournis seulement, validés ensemble. Absente ou supprimée : `'not-found'`. */
  update(id: string, patch: Partial<MealEntryDraft>): Promise<MealEntryRecord>;
  softDelete(id: string): Promise<void>;
  get(id: string, options?: { readonly includeDeleted?: boolean }): Promise<MealEntryRecord | null>;
  /** Entrées d'une date, par heure puis création. */
  listByDate(date: LocalDate): Promise<readonly MealEntryRecord[]>;
  /** Entrées de `from` à `to` inclus, par date, heure puis création ; `includeDeleted` : les entrées supprimées aussi (l'import respecte une suppression). */
  listBetween(from: LocalDate, to: LocalDate, options?: { readonly includeDeleted?: boolean }): Promise<readonly MealEntryRecord[]>;
  /** Aliments distincts (hors Quick Add), du plus récent au plus ancien, avec la dernière prise. */
  recentFoods(limit: number): Promise<readonly RecentFood[]>;
}
