import { catalogText } from './catalogText';
import { timerFr } from './fr.timer';

/** Textes du minuteur de test, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type TimerTextKey = keyof typeof timerFr;

export const tTimer = catalogText(timerFr);
