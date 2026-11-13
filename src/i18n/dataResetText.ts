import { dataResetFr } from './fr.dataReset';

/** Textes de « Repartir de zéro » (RESET-01), à part du catalogue principal ; importé seulement par l'écran, chargé à la demande. */
export type DataResetTextKey = keyof typeof dataResetFr;

export function tDataReset(key: DataResetTextKey): string {
  return dataResetFr[key];
}
