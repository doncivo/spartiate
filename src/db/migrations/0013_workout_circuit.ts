import type { Migration } from '../migrator';

/**
 * I6-03 : groupement de circuit (superset, triset, circuit ; PRD § 13.8) sur les séries d'une séance.
 *
 * - `workout_set.circuit_id` : identifiant du groupe (texte de 1 à 64 caractères) porté par chaque série des exercices du groupe, nul hors groupe.
 * - `workout_set.circuit_rest_sec` : repos entre deux exercices d'un même tour (0 à 3 600 s, 0 = aucun), nul hors groupe. Le repos de fin de tour est la
 *   cible de repos de la série (`target_rest_sec`, déjà publiée) ; le nombre de tours se déduit des séries (aucune colonne).
 *
 * Schéma additif, deux colonnes PUBLIÉES avec la séance close (le rejeu et l'historique d'un autre appareil en ont besoin ; catalogue de synchro,
 * export, vecteur). AUCUN déclencheur ajouté : les colonnes ne s'écrivent que sur une séance OUVERTE, jamais capturée (D-27), et la clôture met la
 * ligne entière en file (`sync_workout_au`, 0004), colonnes de groupe comprises ; aucune correction après clôture ne les touche, et elles sont MASQUÉES du journal des conflits (un « Rétablir » n'y serait pas capturé) (contrairement à
 * `difficulty`, 0006). Aucune contrainte croisée entre colonnes (leçon A1 d'I6-01) : le repos peut être nul sans identifiant, la cohérence du groupe
 * (au moins deux exercices) est tenue par le domaine et le dépôt, et un groupe incomplet reçu d'un autre appareil se lit comme des exercices libres.
 * Un appareil resté au schéma 12 garde ces deux champs dans `sync_unknown` (ADR 0011 § 7.2) et les réintègre après sa migration.
 */
export const migration0013WorkoutCircuit: Migration = {
  version: 13,
  name: 'workout_circuit',
  statements: [
    'ALTER TABLE workout_set ADD COLUMN circuit_id TEXT CHECK (circuit_id IS NULL OR length(circuit_id) BETWEEN 1 AND 64)',
    'ALTER TABLE workout_set ADD COLUMN circuit_rest_sec INTEGER CHECK (circuit_rest_sec IS NULL OR circuit_rest_sec BETWEEN 0 AND 3600)',
  ],
};
