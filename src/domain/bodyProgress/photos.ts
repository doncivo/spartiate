/**
 * Photos de progression : ce que chaque appareil peut faire d'une fiche (FIX-0171, décision d'Ali du 12/11/2026, D-121). Règles pures.
 *
 * - Le FICHIER d'une photo ne se supprime que sur l'appareil qui le détient, après confirmation (suppression du fichier et de la fiche).
 * - Un appareil SANS le fichier (le PC, en pratique) ne supprime rien : il peut seulement MASQUER la fiche chez lui (réglage local, jamais publié).
 * - Une suppression reçue (synchro, import) n'efface jamais le fichier local : la fiche est « supprimée ailleurs » et le fichier reste jusqu'à une
 *   suppression locale confirmée.
 */

export interface PhotoActions {
  /** Supprimer (avec confirmation) : seulement là où est le fichier. */
  readonly canDelete: boolean;
  /** Masquer sur cet appareil : seulement là où le fichier n'est pas. */
  readonly canHide: boolean;
  /** La fiche a été supprimée ailleurs (synchro, import) alors que le fichier est encore ici. */
  readonly deletedElsewhere: boolean;
}

export function photoActions(input: { readonly hasFile: boolean; readonly deletedElsewhere: boolean }): PhotoActions {
  return { canDelete: input.hasFile, canHide: !input.hasFile, deletedElsewhere: input.deletedElsewhere };
}

/** Longueur maximale d'un identifiant de fiche masquée (comme l'identifiant de la fiche, 64 au plus). */
const HIDDEN_ID_MAX = 64;

/** Fiches masquées sur cet appareil (réglage local `bodyProgress.hiddenPhotos`) : valeur brute lue sans jamais lever ; illisible = aucune. */
export function parseHiddenPhotoIds(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= HIDDEN_ID_MAX);
  return [...new Set(ids)].sort();
}

/** Ajoute une fiche aux fiches masquées (une seule fois). */
export function hidePhotoId(hidden: readonly string[], id: string): readonly string[] {
  return parseHiddenPhotoIds([...hidden, id]);
}

/** « Réafficher les photos masquées » : plus aucune fiche masquée. */
export function showAllPhotos(): readonly string[] {
  return [];
}
