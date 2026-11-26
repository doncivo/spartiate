import { catalogText, type PlainCatalogKey } from './catalogText';
import { recoveryFactorsFr } from './fr.recoveryFactors';

/** Textes du journal de facteurs et des valeurs inhabituelles, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type RecoveryFactorsTextKey = keyof typeof recoveryFactorsFr;
/** CLEAN-0296 (C-085) : clés sans paramètre `{x}`. */
export type RecoveryFactorsPlainKey = PlainCatalogKey<typeof recoveryFactorsFr>;

export const tRecoveryFactors = catalogText(recoveryFactorsFr);
