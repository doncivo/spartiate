import type { Migration } from '../migrator';

/**
 * DATA-0292 (BL-138, D-489) : le profil de matériel embarqué par défaut change d'identifiant (« salle-complete »). Migration ADDITIVE (schéma 22) :
 * aucun objet créé ni modifié, aucune table publiée touchée, rien mis en file de synchro. Seules trois valeurs de `settings`, LOCALES, jamais publiées
 * ni exportées, sont réécrites quand elles portent l'ancien identifiant : `training.activeEquipmentProfile` (texte), `onboarding.draft` et
 * `onboarding.answers` (objets, champ `equipmentProfileId`). Les lignes de `equipment_profile` (UUID) ne le portent jamais. Un profil actif resté
 * inconnu retombe de toute façon sur le profil par défaut embarqué.
 *
 * L'ancien identifiant portait le nom d'un lieu réel : il n'est écrit nulle part (garde `scripts/release/privacy.test.ts`, empreinte SHA-256 des mots).
 * Il est reconnu par sa FORME : « fitness-park- » suivi d'un suffixe, seul identifiant de cette forme jamais produit (les autres profils embarqués
 * sont « salle-commerciale », « maison… », « poids-du-corps », les profils personnels des UUID). Aucune valeur n'est lue du contenu embarqué.
 */
export const CURRENT_DEFAULT_PROFILE_ID = 'salle-complete';
const LEGACY_SHAPE = "'fitness-park-%'";

export const migration0022DefaultProfileRename: Migration = {
  version: 22,
  name: 'default_profile_rename',
  statements: [
    // Texte entier (profil actif) ou champ d'un objet (brouillon, réponses) ; une valeur illisible, d'un autre type ou d'un autre profil est inchangée.
    `UPDATE settings SET value = CASE WHEN key = 'training.activeEquipmentProfile' THEN json_quote('${CURRENT_DEFAULT_PROFILE_ID}') ELSE json_set(value, '$.equipmentProfileId', '${CURRENT_DEFAULT_PROFILE_ID}') END WHERE key IN ('training.activeEquipmentProfile', 'onboarding.draft', 'onboarding.answers') AND json_valid(value) AND coalesce(json_extract(value, '$.equipmentProfileId'), json_extract(value, '$')) LIKE ${LEGACY_SHAPE}`,
  ],
};
