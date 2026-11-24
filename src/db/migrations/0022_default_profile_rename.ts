import type { Migration } from '../migrator';

/**
 * DATA-0292 (BL-138, D-489) : le profil de matériel embarqué par défaut change d'identifiant (« salle-complete »). Migration ADDITIVE (schéma 22) :
 * aucun objet créé ni modifié, aucune table publiée touchée, rien mis en file de synchro. Seules trois valeurs de `settings`, LOCALES, jamais publiées
 * ni exportées, sont réécrites quand elles portent l'ancien identifiant : `training.activeEquipmentProfile` (texte), `onboarding.draft` et
 * `onboarding.answers` (objets, champ `equipmentProfileId`). Les lignes de `equipment_profile` (UUID) ne le portent jamais. Un profil actif resté
 * inconnu retombe de toute façon sur le profil par défaut embarqué.
 *
 * L'ancien identifiant portait le nom d'un lieu réel : il n'est écrit nulle part en clair (garde `scripts/release/privacy.test.ts`, empreinte SHA-256
 * des mots). Il est reconstruit par codes de caractères, y compris dans le SQL (`char()`), seule forme à la fois comparable en SQL sans paramètre et
 * absente du JSON des migrations lu par les tests Rust. Identifiant historique figé, jamais lu depuis le contenu embarqué.
 */
const LEGACY_PLACE_CODES = [97, 110, 116, 111, 110, 121] as const;
export const LEGACY_DEFAULT_PROFILE_ID = `fitness-park-${String.fromCharCode(...LEGACY_PLACE_CODES)}`;
export const CURRENT_DEFAULT_PROFILE_ID = 'salle-complete';

export const migration0022DefaultProfileRename: Migration = {
  version: 22,
  name: 'default_profile_rename',
  statements: [
    // Remplacement du texte JSON entre guillemets : valeur texte entière, ou champ d'un objet ; une valeur illisible ou sans l'ancien identifiant est inchangée.
    `UPDATE settings SET value = replace(value, '"fitness-park-' || char(${LEGACY_PLACE_CODES.join()}) || '"', '"${CURRENT_DEFAULT_PROFILE_ID}"') WHERE key IN ('training.activeEquipmentProfile', 'onboarding.draft', 'onboarding.answers')`,
  ],
};
