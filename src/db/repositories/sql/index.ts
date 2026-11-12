import { SYNC_CATALOGUE, type SyncCatalogue } from '../../../domain/sync/syncTables';
import { notifyLocalImport, signalingWrites } from '../../localWrite';
import type { RepositoryFactory, RepositoryOptions } from '../dataAccess';
import { createChecklistItemRepository, createChecklistRepository } from './checklistRepository';
import { createGoalRepository } from './goalRepository';
import { createReminderRepository } from './reminderRepository';
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
export const createSqlRepositoriesFor = (catalogue: SyncCatalogue, options: RepositoryOptions = {}): RepositoryFactory => (executor, stamper) => ({
  spaces: createSpaceRepository(executor, stamper),
  projects: createProjectRepository(executor, stamper),
  tasks: createTaskRepository(executor, stamper),
  recurrences: createRecurrenceRepository(executor, stamper),
  routines: createRoutineRepository(executor, stamper),
  routineLogs: createRoutineLogRepository(executor, stamper),
  reminders: createReminderRepository(executor, stamper),
  goals: createGoalRepository(executor, stamper),
  settings: createSettingsRepository(executor, stamper),
  checklists: createChecklistRepository(executor, stamper),
  checklistItems: createChecklistItemRepository(executor, stamper),
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
  // I3-02 : cycles d'entraînement, à la demande ; chaque écriture est publiable et lève le signal de synchro.
  mesocycles: () => import('./mesocycleRepository').then((m) => signalingWrites(m.createMesocycleRepository(executor, stamper), ['start', 'save'])),
  // I4-02 : fiches, journal et cibles de nutrition, à la demande ; chaque écriture est publiable et lève le signal de synchro.
  foods: () =>
    import('./foodRepository').then((m) =>
      signalingWrites(m.createFoodRepository(executor, stamper), ['create', 'update', 'softDelete', 'cacheOff', 'expireOffCache', 'addPortion', 'updatePortion', 'removePortion']),
    ),
  mealEntries: () => import('./mealEntryRepository').then((m) => signalingWrites(m.createMealEntryRepository(executor, stamper), ['create', 'createMany', 'update', 'softDelete'])),
  nutritionTargets: () => import('./nutritionTargetRepository').then((m) => signalingWrites(m.createNutritionTargetRepository(executor, stamper), ['record'])),
  // I4-07 : journée déclarée et recettes, à la demande ; chaque écriture est publiable et lève le signal de synchro.
  dayCompleteness: () => import('./dayCompletenessRepository').then((m) => signalingWrites(m.createDayCompletenessRepository(executor, stamper), ['declare', 'clear'])),
  recipes: () => import('./recipeRepository').then((m) => signalingWrites(m.createRecipeRepository(executor, stamper), ['create', 'update', 'softDelete'])),
  // I5-01 : récupération, à la demande. Le résumé et les muscles sont publiables (signal de synchro) ; les échantillons importés sont locaux (aucun signal).
  // L'iPhone seul les écrit (`options.recoveryWriter`) ; sur un lecteur (PC), les écritures sont écartées, sans signal.
  recovery: () =>
    import('./recoveryRepository').then((m) => {
      const repository = m.createRecoveryRepository(executor, stamper, options);
      return options.recoveryWriter === true ? signalingWrites(repository, ['saveDay', 'deleteDay']) : repository;
    }),
  // FIX-0173 : l'état d'un import consigné lève le signal d'import local (pas celui de synchro : ces tables ne sont jamais publiées).
  recoverySamples: () => import('./recoverySampleRepository').then((m) => signalingWrites(m.createRecoverySampleRepository(executor), ['recordImport'], notifyLocalImport)),
  // I6-01 : journal de facteurs, à la demande ; publié, écrit par les deux appareils (aucune règle de lecteur).
  recoveryFactors: () => import('./recoveryFactorRepository').then((m) => signalingWrites(m.createRecoveryFactorRepository(executor, stamper), ['save', 'clear'])),
  // I6-02 : mensurations et photos de progression, à la demande ; publiées (fiche seulement), écrites par les deux appareils.
  measurements: () => import('./bodyProgressRepository').then((m) => signalingWrites(m.createMeasurementRepository(executor, stamper), ['save', 'remove'])),
  progressPhotos: () => import('./bodyProgressRepository').then((m) => signalingWrites(m.createProgressPhotoRepository(executor, stamper), ['add', 'remove'])),
  // FIX-0173 : présence de données (base vide), lecture seule, à la demande.
  userData: () => import('./userDataRepository').then((m) => m.createUserDataRepository(executor)),
  exportImport: () => import('./exportImportRepository').then((m) => m.createExportImportRepository(executor, stamper, catalogue, options)),
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

/** Fabrique par défaut : catalogue de production (D-67), appareil LECTEUR des résumés de récupération (`bootstrapApp` déclare l'iPhone écrivain). */
export const createSqlRepositories: RepositoryFactory = createSqlRepositoriesFor(SYNC_CATALOGUE);
