import { catalogText } from './catalogText';
import { todayPcFr } from './fr.todayPc';

/** Textes d'Aujourd'hui PC (tableau de la séance, colonne droite) ; importé seulement par des blocs chargés à la demande. */
export type TodayPcTextKey = keyof typeof todayPcFr;

export const tTodayPc = catalogText(todayPcFr);
