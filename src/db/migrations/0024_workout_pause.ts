import type { Migration } from '../migrator';

/**
 * SESS-0302 (BL-110, D-658, § 13.2) : schéma 24, additif. Vraie pause de séance.
 *
 * - `workout.paused_at` : instant (ISO UTC) du début de la pause EN COURS ; nul hors pause. Une séance close n'en a jamais (la clôture ajoute la pause
 *   en cours au cumul).
 * - `workout.paused_ms` : cumul des pauses terminées, en millisecondes, entier >= 0 ; NUL vaut 0 (lignes existantes, séance jamais mise en pause,
 *   ancien export ou journal). Aucune valeur par défaut SQL : toute colonne publiée ajoutée à une table déjà publiée naît nulle (garde FIX-A009b,
 *   ADR 0011 avenant 39 : un champ gardé chez un appareil plus ancien est réintégré contre une colonne jamais écrite).
 *
 * Colonnes PUBLIÉES avec la séance close (modèle de la 0013) : AUCUN déclencheur, elles ne s'écrivent que sur une séance ouverte, jamais publiée
 * (D-27) ; la clôture met la ligne entière en file (« * », `sync_workout_au` de la 0004). Un appareil resté au schéma 23 garde ces champs dans
 * `sync_unknown` (ADR 0011 § 7.2) ; ses propres séances closes, sans ces champs, sont republiées entières après sa migration (`SCHEMA_REPUBLISH[24]`).
 */
export const migration0024WorkoutPause: Migration = {
  version: 24,
  name: 'workout_pause',
  statements: [
    'ALTER TABLE workout ADD COLUMN paused_at TEXT',
    'ALTER TABLE workout ADD COLUMN paused_ms INTEGER CHECK (paused_ms IS NULL OR paused_ms >= 0)',
  ],
};
