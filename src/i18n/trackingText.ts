import { catalogText } from './catalogText';
import { trackingFr } from './fr.tracking';

/** SUIVIS-029 : textes des suivis, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type TrackingTextKey = keyof typeof trackingFr;

export const tTracking = catalogText(trackingFr);

/** Nombre entier à la française (espace insécable fine des milliers). */
export const formatCount = (n: number): string => n.toLocaleString('fr-FR');
