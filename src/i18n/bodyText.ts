import { catalogText, type PlainCatalogKey } from './catalogText';
import { bodyFr } from './fr.body';

/** Textes de « Profil et poids », à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type BodyTextKey = keyof typeof bodyFr;
/** CLEAN-0296 (C-085) : clés sans paramètre `{x}`. */
export type BodyPlainKey = PlainCatalogKey<typeof bodyFr>;

export const tBody = catalogText(bodyFr);

/** Nombre affiché avec la virgule française : 82.4 → « 82,4 ». */
export const formatKg = (kg: number): string => String(kg).replace('.', ',');
