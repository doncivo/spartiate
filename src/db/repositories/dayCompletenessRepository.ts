import type { DayDeclaration } from '../../domain/nutrition/types';
import type { DeviceId, Hlc, IsoDateTime, LocalDate } from '../../domain/types';

/**
 * Journée déclarée « complète » ou « incomplète » (table `day_completeness`, migration 0009 ; I4-07, D-74 point 2, D-81). Publiée.
 *
 * - Une ligne par date locale, identifiant naturel `day|AAAA-MM-JJ` : les deux appareils écrivent la même ligne. « Non déclarée » = aucune ligne
 *   ou ligne supprimée logiquement (`clear`) : `get` rend `null`, `listBetween` ne contient pas la date. Jamais une valeur par défaut.
 * - Conflit : fusion champ par champ par HLC, dernière écriture gagne (règle du catalogue de synchro).
 * - La déclaration prime sur l'inférence ; ce dépôt ne calcule rien (règle dans `src/domain/nutrition/dayTotals.ts`).
 */

export interface DayDeclarationRecord {
  /** `day|AAAA-MM-JJ`. */
  readonly id: string;
  readonly date: LocalDate;
  readonly state: DayDeclaration;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface DayCompletenessRepository {
  /**
   * Déclare la journée (crée la ligne, change l'état, ou rétablit une déclaration effacée). Même état déjà déclaré : aucune écriture.
   * Date ou état invalides : `'invalid'`, rien n'est écrit.
   */
  declare(date: LocalDate, state: DayDeclaration): Promise<DayDeclarationRecord>;
  /** Efface la déclaration (suppression logique) ; sans effet si la date n'est pas déclarée. */
  clear(date: LocalDate): Promise<void>;
  /** Déclaration vivante de cette date, ou `null`. */
  get(date: LocalDate): Promise<DayDeclarationRecord | null>;
  /** Déclarations vivantes de `from` à `to` inclus, par date : directement utilisable par `aggregateDay`. */
  listBetween(from: LocalDate, to: LocalDate): Promise<ReadonlyMap<LocalDate, DayDeclaration>>;
}
