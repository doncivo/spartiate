import type { ProgressionConfig } from './config';
import type { RecoverySnapshot } from './types';

/**
 * Journée rouge au lancement d'une séance (I5-02 point 2.2 ; § 16.7 « Récupération en séance », § 11.3). Module pur.
 *
 * - Offre : Recovery du jour (lue dans `recovery_day`, même valeur sur l'iPhone et le PC) finie, dans [0, 100] et ≤ `lowRecovery` (33).
 *   Recovery nulle (abstention), absente ou illisible : aucune offre, jamais de faux positif.
 * - Choix d'Ali, jamais imposé : `accepted` alimente la contrainte Recovery existante du moteur (charges × 0,95 arrondies au matériel vers le
 *   bas, jamais sous la charge minimale, séries et répétitions inchangées, aucune hausse : D-93 révisée par Ali le 12/11, D-170 ;
 *   `constraints.ts`, `redDay`) avec la seule Recovery du jour ; `ignored` ou aucun choix : aucun snapshot, prescription inchangée.
 */

export type RedDayChoice = 'accepted' | 'ignored';

export function isRedDay(recovery: number | null | undefined, config: ProgressionConfig): boolean {
  return typeof recovery === 'number' && Number.isFinite(recovery) && recovery >= 0 && recovery <= config.lowRecovery;
}

/** Snapshot du moteur pour une journée rouge acceptée ; null sinon (aucune modulation). */
export function redDaySnapshot(recovery: number | null | undefined, choice: RedDayChoice | null, config: ProgressionConfig): RecoverySnapshot | null {
  if (choice !== 'accepted' || !isRedDay(recovery, config)) return null;
  return { recovery: recovery as number, sleepHours: null, restingHrDelta: null, redDay: true };
}
