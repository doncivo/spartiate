/**
 * Repositories : seul point d'accès à la base pour les features (CLAUDE.md).
 * Contrats : ADR 0004 et src/db/repositories/common.ts (règles communes).
 * Implémentations SQL : agent data-model, dans src/db/repositories/sql/, exposées par
 * une `RepositoryFactory` nommée `createSqlRepositories`.
 */
export * from './common';
export * from './dataAccess';
export * from './observeWrites';
export type * from './bodyRepositories';
export type * from './spaceRepository';
export type * from './taskRepository';
export type * from './routineRepository';
export type * from './reminderRepository';
export type * from './goalRepository';
export type * from './settingsRepository';
export type * from './checklistRepository';
export type * from './syncRepository';
// Y-04 (début)
export type * from './syncConflictRepository';
// Y-04 (fin)
export * from './sql';
export * from './storage';
// Y-07 (début)
export type * from './syncUnknownRepository';
// Y-07 (fin)
// Y-TECH-05
export type * from './epochCarryReportRepository';
// (fin Y-TECH-05)
export type * from './occurrenceDedupRepository';
export type * from './progressionRepository';
export type * from './mesocycleRepository';
export type * from './foodRepository';
export type * from './mealEntryRepository';
export type * from './nutritionTargetRepository';
export type * from './dayCompletenessRepository';
export type * from './recipeRepository';
export type * from './recoveryRepository';
export type * from './recoverySampleRepository';
export type * from './recoveryFactorRepository';
export type * from './bodyProgressRepository';
export type * from './foodFavoriteRepository';
export type * from './dataResetRepository';
export type * from './supplementRepository';
