import { SYNC_CATALOGUE, type SyncCatalogue } from '../../../domain/sync/syncTables';
import { signalingWrites } from '../../localWrite';
import type { RepositoryFactory } from '../dataAccess';
import { createAppleReminderLinkRepository } from './appleReminderLinks';
import { createCalendarAccountRepository, createEventRepository, createExternalEventRepository } from './agendaRepository';
import { createChecklistItemRepository, createChecklistRepository } from './checklistRepository';
import { createFocusSessionRepository } from './focusSessionRepository';
import { createGoalRepository } from './goalRepository';
import { createHolidayRepository } from './holidayRepository';
import { createReminderRepository } from './reminderRepository';
import { createSearchRepository } from './searchRepository';
import { createStatsRepository } from './statsRepository';
import { createRoutineLogRepository, createRoutineRepository } from './routineRepository';
import { createSettingsRepository, createSyncMetaRepository } from './settingsRepository';
import { createProjectRepository, createSpaceRepository } from './spaceRepository';
// Y-04 (début)
import { createSyncConflictRepository } from './syncConflicts';
// Y-04 (fin)
import { createSyncRepository } from './syncRepository';
// Y-07 (début)
export { reintegrateUnknownFields } from './syncUnknown';
// Y-07 (fin)
import { createRecurrenceRepository, createTaskRepository } from './taskRepository';

/**
 * Fabrique SQL des repositories (data-model, ADR 0004) : une implémentation par
 * agrégat, branchée sur l'exécuteur et le tampon d'écriture reçus (driver ou
 * transaction). Fabrique par défaut de `bootstrapApp`.
 */
export const createSqlRepositoriesFor = (catalogue: SyncCatalogue): RepositoryFactory => (executor, stamper) => ({
  spaces: createSpaceRepository(executor, stamper),
  projects: createProjectRepository(executor, stamper),
  tasks: createTaskRepository(executor, stamper),
  recurrences: createRecurrenceRepository(executor, stamper),
  routines: createRoutineRepository(executor, stamper),
  routineLogs: createRoutineLogRepository(executor, stamper),
  reminders: createReminderRepository(executor, stamper),
  goals: createGoalRepository(executor, stamper),
  settings: createSettingsRepository(executor, stamper),
  events: createEventRepository(executor, stamper),
  holidays: createHolidayRepository(executor, stamper),
  focusSessions: createFocusSessionRepository(executor, stamper),
  search: createSearchRepository(executor),
  stats: createStatsRepository(executor),
  checklists: createChecklistRepository(executor, stamper),
  checklistItems: createChecklistItemRepository(executor, stamper),
  externalEvents: createExternalEventRepository(executor),
  calendarAccounts: createCalendarAccountRepository(executor, stamper),
  syncMeta: createSyncMetaRepository(executor, catalogue),
  // D-65 : profil et poids, implémentation chargée à la demande (hors du JavaScript de départ).
  profile: () => import('./bodyRepositories').then((m) => signalingWrites(m.createProfileRepository(executor, stamper), ['save'])),
  bodyWeights: () => import('./bodyRepositories').then((m) => signalingWrites(m.createBodyWeightRepository(executor, stamper), ['saveManual', 'saveHealth', 'softDelete'])),
  // I1-01 : bibliothèque (exercices personnalisés), matériel et routines d'entraînement, à la demande. Chaque écriture lève le signal de synchro.
  exercises: () => import('./exerciseRepository').then((m) => signalingWrites(m.createExerciseRepository(executor, stamper), ['create', 'update', 'softDelete', 'restore'])),
  equipmentProfiles: () => import('./equipmentProfileRepository').then((m) => signalingWrites(m.createEquipmentProfileRepository(executor, stamper), ['create', 'update', 'softDelete'])),
  trainingRoutines: () =>
    import('./trainingRoutineRepository').then((m) =>
      signalingWrites(m.createTrainingRoutineRepository(executor, stamper), ['create', 'update', 'softDelete', 'addDay', 'updateDay', 'removeDay', 'addExercise', 'updateExercise', 'removeExercise']),
    ),
  // I1-02 / I1-03 : séance, à la demande. Signal de synchro seulement pour ce qui devient publiable (clôture, correction, suppression d'une
  // séance close, mise à jour de la routine) : une séance ouverte n'est jamais publiée (D-27).
  workouts: () =>
    import('./workoutRepository').then((m) => signalingWrites(m.createWorkoutRepository(executor, stamper), ['close', 'correctSet', 'deleteClosed', 'applyRoutineUpdate'])),
  // I2-01 : moteur de prescription, à la demande. Tables locales en 0.3.0 (aucune capture) : pas de signal de synchro.
  progression: () => import('./progressionRepository').then((m) => m.createProgressionRepository(executor, stamper)),
  exportImport: () => import('./exportImportRepository').then((m) => m.createExportImportRepository(executor, stamper, catalogue)),
  appleLinks: createAppleReminderLinkRepository(executor),
  // Y-04 (début)
  syncConflicts: createSyncConflictRepository(executor, stamper, catalogue),
  // Y-04 (fin)
  sync: createSyncRepository(executor, stamper, catalogue),
  // Y-TECH-05 : comptes rendus du report d'époque, implémentation chargée à la demande (hors du JavaScript de départ).
  carryReports: () => import('./epochCarryReports').then((m) => m.createEpochCarryReportRepository(executor)),
  // T-TECH-01 : doublons d'occurrences de série, implémentation chargée à la demande.
  occurrenceDedup: () => import('./occurrenceDedup').then((m) => m.createOccurrenceDedupRepository(executor)),
  // Y-07 (début)
  // Y-07 (fin)
});

/** Fabrique de production : catalogue I0 (D-67). Le banc de test injecte l'ancien catalogue par `createSqlRepositoriesFor`. */
export const createSqlRepositories: RepositoryFactory = createSqlRepositoriesFor(SYNC_CATALOGUE);
