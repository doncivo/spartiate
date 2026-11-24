/**
 * DATA-0292 (BL-138, D-489) : le profil de matériel embarqué par défaut s'appelle « salle-complete ». Son ancien identifiant portait le nom d'un lieu
 * réel : il n'est plus écrit en clair dans le dépôt (garde `scripts/release/privacy.test.ts`). Il ne subsiste que pour LIRE les valeurs d'avant
 * (réglage local du profil actif, brouillon d'onboarding) : il est reconstruit à l'exécution à partir de codes de caractères (seule forme utilisable de
 * façon synchrone par le domaine ET par la migration 0022, en SQL avec `char()` ; une empreinte SHA-256 n'est pas comparable en SQL ni sans
 * `crypto.subtle` asynchrone).
 */
export const CURRENT_DEFAULT_PROFILE_ID = 'salle-complete';

const LEGACY_PLACE_CODES = [97, 110, 116, 111, 110, 121] as const;

export const LEGACY_DEFAULT_PROFILE_ID = `fitness-park-${String.fromCharCode(...LEGACY_PLACE_CODES)}`;

/** Le même identifiant comme expression SQL (la migration figée ne porte jamais le texte, ni le jeu de migrations exporté vers Rust). */
export const LEGACY_DEFAULT_PROFILE_ID_SQL = `('fitness-park-' || char(${LEGACY_PLACE_CODES.join(', ')}))`;

/** L'ancien identifiant du profil par défaut est rattaché au nouveau ; toute autre valeur est rendue telle quelle. */
export function canonicalEquipmentProfileId<T extends string | null>(id: T): T | typeof CURRENT_DEFAULT_PROFILE_ID {
  return id === LEGACY_DEFAULT_PROFILE_ID ? CURRENT_DEFAULT_PROFILE_ID : id;
}
