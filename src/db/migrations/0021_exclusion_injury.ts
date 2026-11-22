import type { Migration } from '../migrator';
import { captureTriggers } from './0018_cardio';

/**
 * SYNC-0291 (BL-109, BL-120, D-447, D-463, D-464) : exercices écartés (« ne plus proposer ») et gênes déclarées communs au PC et à l'iPhone. DEUX
 * TABLES NEUVES, publiées, écrites par les deux appareils ; AUCUNE table existante n'est modifiée (schéma strictement additif, schéma 21).
 *
 * - `exercise_exclusion` : un écarté par exercice, identifiant naturel `exclusion|<exercice>` (CHECK, comme `food_favorite`) : le même exercice écarté
 *   sur les deux appareils donne UNE ligne. `exercise_id` = identifiant embarqué ou UUID d'un exercice personnalisé (référence logique, P-09), 1 à 118
 *   caractères sans `|`. Écarter = ligne vivante ; remettre = suppression logique (`deleted_at`).
 * - Aucune donnée migrée en SQL : la reprise du réglage local `training.excludedExercises` (D-377) se fait une fois par le dépôt, horodatée par
 *   l'horloge de synchro de l'appareil (`ExerciseExclusionRepository.importLocal`).
 *
 * - `injury` (BL-120, D-464) : une gêne déclarée, identifiant UUID. Muscle facultatif (1 à 64), motifs douloureux (JSON tableau), début (date locale),
 *   note facultative (1 à 140), statut `active` | `healed`, date de guérison facultative, réponses au check-in (JSON tableau). AUCUNE contrainte croisée
 *   entre colonnes (leçon d'I6-01 : fusion champ par champ) : la cohérence est relue par le domaine (`parseInjury`). La reprise du réglage local
 *   `training.injuries` se fait une fois par le dépôt (`InjuryRepository.importLocal`).
 *
 * Copie figée `CAPTURE_TABLES_V21` (jamais lue depuis le catalogue vivant), deux déclencheurs par table sur le gabarit de la 0018 (importé : aucune
 * instruction de la 0018 ne change). Aucune migration publiée n'est modifiée.
 */

/** Copie figée (version 21) des colonnes capturées : colonnes métier, `created_at` et `deleted_at` (ni `id`, ni `updated_at`, `device_id`, `hlc`). */
export const CAPTURE_TABLES_V21 = [
  ['exercise_exclusion', ['exercise_id', 'created_at', 'deleted_at']],
  ['injury', ['muscle_id', 'patterns', 'started_on', 'note', 'status', 'healed_on', 'checkins', 'created_at', 'deleted_at']],
] as const;

const [[EXCLUSION, EXCLUSION_COLUMNS], [INJURY, INJURY_COLUMNS]] = CAPTURE_TABLES_V21;
const DATE = "GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'";

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
    `CREATE TABLE injury (
      id TEXT PRIMARY KEY NOT NULL,
      muscle_id TEXT CHECK (muscle_id IS NULL OR length(muscle_id) BETWEEN 1 AND 64),
      patterns TEXT NOT NULL DEFAULT '[]' CHECK (length(patterns) <= 1024 AND json_valid(patterns) AND json_type(patterns) = 'array'),
      started_on TEXT NOT NULL CHECK (started_on ${DATE}),
      note TEXT CHECK (note IS NULL OR length(note) BETWEEN 1 AND 140),
      status TEXT NOT NULL CHECK (status IN ('active', 'healed')),
      healed_on TEXT CHECK (healed_on IS NULL OR healed_on ${DATE}),
      checkins TEXT NOT NULL DEFAULT '[]' CHECK (length(checkins) <= 65536 AND json_valid(checkins) AND json_type(checkins) = 'array'),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      device_id TEXT NOT NULL,
      hlc TEXT NOT NULL
    )`,
    ...captureTriggers(EXCLUSION, EXCLUSION_COLUMNS),
    ...captureTriggers(INJURY, INJURY_COLUMNS),
  ],
};
