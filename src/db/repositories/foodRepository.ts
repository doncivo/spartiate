import type { FoodDraft, FoodSource, OffCacheState, Per100g } from '../../domain/nutrition/food';
import type { DeviceId, Hlc, IsoDateTime } from '../../domain/types';

/**
 * Fiches alimentaires et portions (tables `food` et `food_portion`, migration 0008 ; I4-02, § 15.3–15.4, § 20.2). Publiées (UUID).
 *
 * - Fiches STOCKÉES seulement : `custom` (fiche personnelle, créée ou corrigée par Ali) et `off` (cache Open Food Facts, 90 jours). Ciqual
 *   n'a aucune ligne : il est lu du contenu embarqué (`src/features/nutrition/catalogue`).
 * - Les valeurs sont validées par le domaine (`validateFoodDraft`) : refus `'invalid'`, rien n'est écrit. Une valeur inconnue est `null`.
 * - Une fiche OFF n'est pas modifiable (la prochaine récupération l'écraserait) : la corriger = créer une fiche personnelle du même code,
 *   qui prime à la lecture par code-barres.
 * - Aucun index unique sur le code-barres (deux appareils hors ligne peuvent chacun créer une ligne) : `cacheOff` rafraîchit en place la
 *   ligne existante ; si plusieurs existent, la plus récemment récupérée est lue.
 * - `softDelete` d'une fiche supprime aussi ses portions (plusieurs écritures : à appeler dans `DataAccess.transaction`). Les entrées de
 *   journal qui la citent restent lisibles (nom figé).
 */

export interface FoodRecord {
  readonly id: string;
  readonly source: FoodSource;
  readonly barcode: string | null;
  readonly name: string;
  readonly brand: string | null;
  readonly per100g: Per100g;
  /** Date de récupération du produit OFF (cache) ; `null` pour une fiche personnelle. */
  readonly fetchedAt: IsoDateTime | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface PortionRecord {
  readonly id: string;
  readonly foodId: string;
  readonly label: string;
  readonly grams: number;
  readonly position: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface PortionInput {
  readonly label: string;
  readonly grams: number;
  /** Omise : à la suite des portions existantes. */
  readonly position?: number;
}

export type FoodPatch = Partial<Pick<FoodDraft, 'name' | 'brand' | 'barcode' | 'per100g'>>;

export interface FoodRepository {
  /** Fiche personnelle (`source custom`) ; identifiant (UUID) fabriqué si omis ; collision (même supprimée) : `'conflict'`. */
  create(draft: FoodDraft, options?: { readonly id?: string }): Promise<FoodRecord>;
  /** Champs fournis seulement, validés ensemble. Fiche OFF : `'invalid'`. Absente ou supprimée : `'not-found'`. */
  update(id: string, patch: FoodPatch): Promise<FoodRecord>;
  /** Suppression logique de la fiche et de ses portions. */
  softDelete(id: string): Promise<void>;
  get(id: string, options?: { readonly includeDeleted?: boolean }): Promise<FoodRecord | null>;
  /** Fiches non supprimées, triées par nom sans casse ; filtre de provenance facultatif. */
  list(options?: { readonly source?: FoodSource }): Promise<readonly FoodRecord[]>;
  /** Fiche personnelle portant ce code, sinon produit OFF le plus récemment récupéré, sinon `null` (code invalide ou inconnu). */
  findByBarcode(barcode: string): Promise<FoodRecord | null>;
  /** Dépose ou rafraîchit en place un produit OFF (`source off`, code-barres et `fetchedAt` obligatoires). */
  cacheOff(draft: FoodDraft, options?: { readonly id?: string }): Promise<FoodRecord>;
  /** Produit OFF de ce code et état de son cache à `now` ; `null` si aucun. */
  offCacheStateOf(barcode: string, now: IsoDateTime): Promise<{ readonly food: FoodRecord; readonly state: OffCacheState } | null>;
  /** Supprime (logiquement) les produits OFF de plus de 90 jours ou à date illisible ; jamais une fiche personnelle. Rend leur nombre. */
  expireOffCache(now: IsoDateTime): Promise<number>;
  addPortion(foodId: string, input: PortionInput, options?: { readonly id?: string }): Promise<PortionRecord>;
  updatePortion(id: string, patch: Partial<PortionInput>): Promise<PortionRecord>;
  removePortion(id: string): Promise<void>;
  listPortions(foodId: string): Promise<readonly PortionRecord[]>;
}
