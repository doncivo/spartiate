import type { MigrationEntry, MigrationPlan } from '../migrator';

/**
 * DATA-0292 : MANIFESTE des migrations (version, nom, somme de contrôle), seul élément du registre embarqué au DÉPART de l'app. Les instructions SQL
 * (`./index`, 0001 à la dernière) sont chargées à la demande par `load()`, seulement quand la base a des migrations à appliquer : une base à jour n'en
 * exécute aucune (le migrateur ne compare que les sommes de contrôle). `manifest.test.ts` exige l'égalité avec les migrations ; en cas d'ajout d'une
 * migration, ajouter son entrée ici (régénération : `UPDATE_MIGRATION_MANIFEST=1 npx vitest run --coverage.enabled=false src/db/migrations/manifest.test.ts`).
 */
export const migrationManifest: readonly MigrationEntry[] = [
  { version: 1, name: 'spartiate_init', checksum: '81695727' },
  { version: 2, name: 'training', checksum: '12669c57' },
  { version: 3, name: 'workout', checksum: '759ec6c6' },
  { version: 4, name: 'workout_sync', checksum: 'c419ad8a' },
  { version: 5, name: 'progression', checksum: '71b89f01' },
  { version: 6, name: 'progression_sync', checksum: '66dfbfd5' },
  { version: 7, name: 'mesocycle', checksum: '963756bb' },
  { version: 8, name: 'nutrition', checksum: '2661606b' },
  { version: 9, name: 'recipes', checksum: '77de36a7' },
  { version: 10, name: 'recovery', checksum: 'c291b7c6' },
  { version: 11, name: 'recovery_factor', checksum: '5705d384' },
  { version: 12, name: 'body_progress', checksum: '37445098' },
  { version: 13, name: 'workout_circuit', checksum: 'bfed425f' },
  { version: 14, name: 'routine_circuit', checksum: 'c1ac9724' },
  { version: 15, name: 'food_favorite', checksum: 'a6491f3b' },
  { version: 16, name: 'data_reset', checksum: '7a7ce479' },
  { version: 17, name: 'supplement', checksum: '10fe56ad' },
  { version: 18, name: 'cardio', checksum: '09487f34' },
  { version: 19, name: 'program_rest_day', checksum: '380c4bbc' },
  { version: 20, name: 'routine_weekday', checksum: 'd38cf091' },
  { version: 21, name: 'exclusion_injury', checksum: '31b8e8d1' },
  { version: 22, name: 'default_profile_rename', checksum: '5401e2c9' },
  { version: 23, name: 'data_0293', checksum: '4e7d2358' },
];

export const migrationPlan: MigrationPlan = {
  entries: migrationManifest,
  load: async () => (await import('./index')).migrations,
};
