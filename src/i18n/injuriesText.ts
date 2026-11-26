import { catalogText } from './catalogText';
import { injuriesFr } from './fr.injuries';

/** Textes de « Blessures », importés seulement par des modules chargés à la demande. */
export type InjuriesTextKey = keyof typeof injuriesFr;

export const tInjuries = catalogText(injuriesFr);
