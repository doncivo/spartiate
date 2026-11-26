import { catalogText, type PlainCatalogKey } from './catalogText';
import { appleIntelligenceFr } from './fr.appleIntelligence';

/** Textes de l'essai Apple Intelligence, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type AppleIntelligenceTextKey = keyof typeof appleIntelligenceFr;
/** CLEAN-0296 (C-085) : clés sans paramètre `{x}`. */
export type AppleIntelligencePlainKey = PlainCatalogKey<typeof appleIntelligenceFr>;

export const tAppleIntelligence = catalogText(appleIntelligenceFr);
