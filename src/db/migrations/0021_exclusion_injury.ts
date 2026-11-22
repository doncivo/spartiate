import type { Migration } from '../migrator';
import { captureTriggers } from './0018_cardio';

/**
 * SYNC-0291 (BL-109, D-447, D-463) : exercices écartés (« ne plus proposer ») communs au PC et à l'iPhone. TABLE NEUVE, publiée, écrite par les deux
 * appareils ; AUCUNE table existante n'est modifiée (schéma strictement additif, schéma 21).
 *
 * - `exercise_exclusion` : un écarté par exercice, identifiant naturel `exclusion|<exercice>` (CHECK, comme `food_favorite`) : le même exercice écarté
 *   sur les deux appareils donne UNE ligne. `exercise_id` = identifiant embarqué ou UUID d'un exercice personnalisé (référence logique, P-09), 1 à 118
 *   caractères sans `|`. Écarter = ligne vivante ; remettre = suppression logique (`deleted_at`).
 * - Aucune donnée migrée en SQL : la reprise du réglage local `training.excludedExercises` (D-377) se fait une fois par le dépôt, horodatée par
 *   l'horloge de synchro de l'appareil (`ExerciseExclusionRepository.importLocal`).
 *
 * Copie figée `CAPTURE_TABLES_V21` (jamais lue depuis le catalogue vivant), deux déclencheurs par table sur le gabarit de la 0018 (importé : aucune
 * instruction de la 0018 ne change). Aucune migration publiée n'est modifiée.
 */

/** Copie figée (version 21) des colonnes capturées : colonnes métier, `created_at` et `deleted_at` (ni `id`, ni `updated_at`, `device_id`, `hlc`). */
export const CAPTURE_TABLES_V21 = [['exercise_exclusion', ['exercise_id', 'created_at', 'deleted_at']]] as const;

const [[EXCLUSION, EXCLUSION_COLUMNS]] = CAPTURE_TABLES_V21;

export const migration0021ExclusionInjury: Migration = {
  version: 21,
  name: 'exclusion_injury',
  statements: [
    `CREATE TABLE exercise_exclusion (
      id TEXT PRIMARY KEY NOT NULL,
      exercise_id TEXT NOT NULL CHECK (length(exercise_id) BETWEEN 1 AND 118 AND instr(exercise_id, '|') = 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL,
      CHECK (id = 'exclusion|' || exercise_id)
    )`,
    ...captureTriggers(EXCLUSION, EXCLUSION_COLUMNS),
  ],
};
