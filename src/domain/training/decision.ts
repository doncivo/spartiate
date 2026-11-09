import type { IsoDateTime } from '../types';
import type { Prescription } from './types';

/**
 * Recalibrage « Facile » consigné à la clôture (I2-01, relecture de la #61, point B) : seulement si la séance est close et que la charge
 * retenue par Ali est au moins la charge recalée ; une séance abandonnée, un refus ou une charge plus basse ne consomment pas le délai de
 * 30 jours. Module pur.
 */
export function recalibrationKept(prescription: Prescription, chosenLoadKg: number | null): { readonly at: IsoDateTime; readonly estimated1rmKg: number } | null {
  const recal = prescription.recalibration;
  if (recal === null || chosenLoadKg === null || prescription.loadKg === null) return null;
  // I4-08 : une prescription tracée par la 0.9.0 pouvait recaler sans hausse de charge (+0 kg) : rien n'est consigné.
  if (prescription.reference !== null && prescription.loadKg <= prescription.reference.loadKg + 1e-9) return null;
  return chosenLoadKg >= prescription.loadKg ? recal : null;
}
