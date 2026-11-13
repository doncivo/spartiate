import type { WriteStamper } from '../../domain/hlc';
import type { SqlDriver, SqlExecutor } from '../driver';
import type { ChecklistItemRepository, ChecklistRepository } from './checklistRepository';
import type { GoalRepository } from './goalRepository';
import type { ReminderRepository } from './reminderRepository';
import type { RoutineLogRepository, RoutineRepository } from './routineRepository';
import type { SettingsRepository, SyncMetaRepository } from './settingsRepository';
import type { SyncRepository } from './syncRepository';
import type { BodyWeightRepository, ProfileRepository } from './bodyRepositories';
import type { ExportImportRepository } from './exportImportRepository';
import type { EquipmentProfileRepository } from './equipmentProfileRepository';
import type { ExerciseRepository } from './exerciseRepository';
import type { TrainingRoutineRepository } from './trainingRoutineRepository';
import type { WorkoutRepository } from './workoutRepository';
import type { ProgressionRepository } from './progressionRepository';
import type { MesocycleRepository } from './mesocycleRepository';
import type { FoodRepository } from './foodRepository';
import type { MealEntryRepository } from './mealEntryRepository';
import type { NutritionTargetRepository } from './nutritionTargetRepository';
import type { DayCompletenessRepository } from './dayCompletenessRepository';
import type { RecipeRepository } from './recipeRepository';
import type { RecoveryRepository } from './recoveryRepository';
import type { RecoverySampleRepository } from './recoverySampleRepository';
import type { RecoveryFactorRepository } from './recoveryFactorRepository';
import type { FoodFavoriteRepository } from './foodFavoriteRepository';
import type { DataResetRepository } from './dataResetRepository';
import type { SupplementRepository } from './supplementRepository';
import type { CardioRepository } from './cardioRepository';
import type { MeasurementRepository, ProgressPhotoRepository } from './bodyProgressRepository';
import type { UserDataRepository } from './userDataRepository';
import type { ProjectRepository, SpaceRepository } from './spaceRepository';
import type { RecurrenceRepository, TaskRepository } from './taskRepository';

/** Ensemble des repositories liés à un même exécuteur (driver ou transaction). */
export interface Repositories {
  readonly spaces: SpaceRepository;
  readonly projects: ProjectRepository;
  readonly tasks: TaskRepository;
  readonly recurrences: RecurrenceRepository;
  readonly routines: RoutineRepository;
  readonly routineLogs: RoutineLogRepository;
  readonly reminders: ReminderRepository;
  readonly goals: GoalRepository;
  readonly settings: SettingsRepository;
  readonly checklists: ChecklistRepository;
  readonly checklistItems: ChecklistItemRepository;
  readonly syncMeta: SyncMetaRepository;
  /** Base neuve (D-65) : profil (ligne unique `profile|singleton`) et pesées. */
  /** Chargés à la demande (hors du JavaScript de départ, BUNDLE-01) : `await repos.profile()`. */
  readonly profile: () => Promise<ProfileRepository>;
  readonly bodyWeights: () => Promise<BodyWeightRepository>;
  /**
   * I1-01 : exercices personnalisés, profils de matériel et routines d'entraînement, chargés à la demande (hors du JavaScript de départ).
   * `trainingRoutines` est distinct de `routines` (ancien modèle de calendrier).
   */
  readonly exercises: () => Promise<ExerciseRepository>;
  readonly equipmentProfiles: () => Promise<EquipmentProfileRepository>;
  readonly trainingRoutines: () => Promise<TrainingRoutineRepository>;
  /** I1-02 : séance active locale (jamais publiée avant clôture, D-27), chargée à la demande : `await repos.workouts()`. */
  readonly workouts: () => Promise<WorkoutRepository>;
  /** I2-01 : historique d'un exercice, profil de progression et décisions (publiés depuis la 0.3.1), chargé à la demande. */
  readonly progression: () => Promise<ProgressionRepository>;
  /** I3-02 : cycles d'entraînement (publiés), chargés à la demande. */
  readonly mesocycles: () => Promise<MesocycleRepository>;
  /** I4-02 : fiches alimentaires et portions (publiées), chargées à la demande. */
  readonly foods: () => Promise<FoodRepository>;
  /** I4-02 : journal alimentaire (publié), chargé à la demande. */
  readonly mealEntries: () => Promise<MealEntryRepository>;
  /** I4-02 : cibles nutritionnelles (publiées, une ligne par décision), chargées à la demande. */
  readonly nutritionTargets: () => Promise<NutritionTargetRepository>;
  /** I4-07 : journée déclarée complète ou incomplète (publiée, une ligne par date), chargée à la demande. */
  readonly dayCompleteness: () => Promise<DayCompletenessRepository>;
  /** I4-07 : recettes et leurs ingrédients (publiés), chargés à la demande. */
  readonly recipes: () => Promise<RecipeRepository>;
  /** I5-01 : résumés de récupération du jour et par muscle (publiés, iPhone vers PC), chargés à la demande. */
  readonly recovery: () => Promise<RecoveryRepository>;
  /** I5-01 : échantillons importés des fichiers Raccourcis et état du dernier import (LOCAUX, jamais publiés), chargés à la demande. */
  readonly recoverySamples: () => Promise<RecoverySampleRepository>;
  /** I6-01 : journal de facteurs de la veille (publié, écrit par les deux appareils), chargé à la demande. */
  readonly recoveryFactors: () => Promise<RecoveryFactorRepository>;
  /** FIX-0181 (D-171) : favoris de la recherche d'aliments (publiés, écrits par les deux appareils), chargés à la demande. */
  readonly foodFavorites: () => Promise<FoodFavoriteRepository>;
  /** I6-05 (D-210) : compléments et prises (publiés, écrits par les deux appareils), chargés à la demande. */
  readonly supplements: () => Promise<SupplementRepository>;
  /** I6-02 : mensurations (publiées, écrites par les deux appareils), chargées à la demande. */
  readonly measurements: () => Promise<MeasurementRepository>;
  /** I6-02 : photos de progression : fiche publiée, fichier LOCAL (jamais publié ni exporté), chargées à la demande. */
  readonly progressPhotos: () => Promise<ProgressPhotoRepository>;
  /** FIX-0173 : présence de données de l'utilisateur (base vide au premier lancement), requêtes d'existence bornées, chargée à la demande. */
  readonly userData: () => Promise<UserDataRepository>;
  /** RESET-01 : remises à zéro des données (table publiée `data_reset`) et effacement local, chargées à la demande. */
  readonly dataReset: () => Promise<DataResetRepository>;
  /** I6-06 : séances cardio (publiées, écrites par les deux appareils) et tracés GPS (LOCAUX, jamais publiés ni exportés), chargés à la demande. */
  readonly cardio: () => Promise<CardioRepository>;
  /** Export / import de Spartiate (SPA-005, D-57), chargé à la demande. */
  readonly exportImport: () => Promise<ExportImportRepository>;
  /** Tables de la synchronisation (ADR 0011, lot Y2). */
  readonly sync: SyncRepository;
}

/**
 * Fabrique des repositories SQL (implémentation : data-model, `src/db/repositories/sql/`).
 * Appelée une fois pour le driver, puis une fois par transaction avec le `tx` reçu.
 */
export type RepositoryFactory = (executor: SqlExecutor, stamper: WriteStamper) => Repositories;

/** Événement fixe d'une écriture locale écartée par un appareil lecteur : jamais une valeur, un identifiant de ligne ni une date. */
export type IgnoredWriteEvent = 'recovery-write-ignored';

/**
 * Règles propres à l'appareil, fixées à la création des repositories par la couche qui connaît la plateforme (`bootstrapApp`), jamais lues
 * d'une valeur reçue (I5-01, § 9.1, § 16.4).
 */
export interface RepositoryOptions {
  /**
   * Vrai sur l'iPhone seul : il écrit `recovery_day` et `muscle_recovery` ; le PC les lit (reçues par la synchro) et ne les écrit jamais.
   * Absent ou faux : LECTEUR (valeur sûre, un oubli de câblage ne fait jamais écrire le PC). Sur un lecteur, `saveDay` et `deleteDay`
   * n'écrivent rien et l'import d'archive n'écrit ni ne supprime ces tables.
   */
  readonly recoveryWriter?: boolean;
  /** Écriture locale écartée par un lecteur (journal technique de l'appareil). */
  readonly onIgnoredWrite?: (event: IgnoredWriteEvent) => void;
}

/**
 * Point d'entrée unique des features vers la base (via le conteneur, ADR 0004).
 * - `repos` : lectures et écritures simples ;
 * - `transaction(work)` : écritures multiples atomiques d'un cas d'usage. Dans `work`,
 *   utiliser uniquement les repositories reçus en paramètre : appeler `repos` du
 *   DataAccess depuis une transaction bloquerait la file (DbError
 *   'transaction-wait-timeout', ADR 0002).
 */
export interface DataAccess {
  readonly repos: Repositories;
  transaction<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}

export function createDataAccess(driver: SqlDriver, stamper: WriteStamper, factory: RepositoryFactory): DataAccess {
  return {
    repos: factory(driver, stamper),
    transaction: (work) => driver.transaction((tx) => work(factory(tx, stamper))),
  };
}
