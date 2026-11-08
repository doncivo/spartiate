import type { WriteStamper } from '../../domain/hlc';
import type { SqlDriver, SqlExecutor } from '../driver';
import type { AppleReminderLinkRepository } from './appleReminderLinkRepository';
import type { CalendarAccountRepository, EventRepository, ExternalEventRepository } from './agendaRepository';
import type { ChecklistItemRepository, ChecklistRepository } from './checklistRepository';
import type { FocusSessionRepository } from './focusSessionRepository';
import type { GoalRepository } from './goalRepository';
import type { HolidayRepository } from './holidayRepository';
import type { SearchRepository } from './searchRepository';
import type { StatsRepository } from './statsRepository';
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
  readonly events: EventRepository;
  readonly holidays: HolidayRepository;
  readonly focusSessions: FocusSessionRepository;
  readonly search: SearchRepository;
  readonly stats: StatsRepository;
  readonly checklists: ChecklistRepository;
  readonly checklistItems: ChecklistItemRepository;
  readonly externalEvents: ExternalEventRepository;
  readonly calendarAccounts: CalendarAccountRepository;
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
  /** Export / import de Spartiate (SPA-005, D-57), chargé à la demande. */
  readonly exportImport: () => Promise<ExportImportRepository>;
  /** Liens locaux aux Rappels Apple (K-05, ADR 0008 §10.2) : table non publiée, vide sur le PC. */
  readonly appleLinks: AppleReminderLinkRepository;
  /** Tables de la synchronisation (ADR 0011, lot Y2). */
  readonly sync: SyncRepository;
}

/**
 * Fabrique des repositories SQL (implémentation : data-model, `src/db/repositories/sql/`).
 * Appelée une fois pour le driver, puis une fois par transaction avec le `tx` reçu.
 */
export type RepositoryFactory = (executor: SqlExecutor, stamper: WriteStamper) => Repositories;

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
