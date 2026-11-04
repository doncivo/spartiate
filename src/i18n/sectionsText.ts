import { sectionsFr } from './fr.sections';

/** Textes des sections de la coquille I0, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type SectionsTextKey = keyof typeof sectionsFr;

export const tSections = (key: SectionsTextKey): string => sectionsFr[key];
