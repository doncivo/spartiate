import { catalogText } from './catalogText';
import { progressTabsFr } from './fr.progressTabs';

/** PROG-0301a : textes des onglets de Progrès, à part du catalogue principal ; importé seulement par l'hôte des onglets, chargé à la demande. */
export type ProgressTabsTextKey = keyof typeof progressTabsFr;

export const tProgressTabs = catalogText(progressTabsFr);
