import type { Migration } from '../migrator';
import { CURRENT_DEFAULT_PROFILE_ID, LEGACY_DEFAULT_PROFILE_ID_SQL } from '../../domain/training/legacyProfile';

/**
 * DATA-0292 (BL-138, D-489) : le profil de matériel embarqué par défaut change d'identifiant (« salle-complete »). Migration ADDITIVE (schéma 22) :
 * aucun objet créé ni modifié, aucune table publiée touchée, rien mis en file de synchro. Seules trois valeurs de `settings`, LOCALES, jamais publiées
 * ni exportées, sont réécrites quand elles portent l'ancien identifiant : `training.activeEquipmentProfile` (texte), `onboarding.draft` et
 * `onboarding.answers` (objets, champ `equipmentProfileId`). Les lignes de `equipment_profile` (UUID) ne le portent jamais. La lecture reste aussi
 * tolérante (`canonicalEquipmentProfileId`) pour une valeur qui arriverait par un autre chemin. L'identifiant est une constante historique figée.
 */
const OLD = LEGACY_DEFAULT_PROFILE_ID_SQL;
const NEW = `'${CURRENT_DEFAULT_PROFILE_ID}'`;
const OBJECT_KEYS = "('onboarding.draft', 'onboarding.answers')";

export const migration0022DefaultProfileRename: Migration = {
  version: 22,
  name: 'default_profile_rename',
  statements: [
    `UPDATE settings SET value = json_quote(${NEW}) WHERE key = 'training.activeEquipmentProfile' AND json_valid(value) AND value = json_quote(${OLD})`,
    `UPDATE settings SET value = json_set(value, '$.equipmentProfileId', ${NEW}) WHERE key IN ${OBJECT_KEYS} AND json_valid(value) AND json_type(value) = 'object' AND json_extract(value, '$.equipmentProfileId') = ${OLD}`,
  ],
};
