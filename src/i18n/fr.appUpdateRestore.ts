/**
 * Restauration de la sauvegarde d'avant la mise à jour depuis l'écran d'échec du démarrage (I-06, ADR 0007 avenant I-06 point 7). À part
 * du catalogue principal : chargée avec l'action (bundle de départ, PRD 8) ; même forme en anglais (`appUpdateRestoreText.test.ts`).
 */
export const appUpdateRestoreFr = {
  restore: 'Restaurer la sauvegarde d’avant la mise à jour',
  restoreConfirmTitle: 'Restaurer la sauvegarde d’avant la mise à jour ?',
  restoreConfirmBody: 'Tes données reviennent à leur état d’avant la mise à jour. Cette version retentera la mise à jour au prochain démarrage ; si l’erreur revient, installe la version corrigée.',
  restoreConfirm: 'Restaurer',
  restoring: 'Restauration en cours…',
  restoreUnavailable: 'La restauration n’est pas disponible ici : copie le détail et installe la version corrigée.',
  /** Restauration faite, relance automatique impossible (revue I3). */
  restartManually: 'Données restaurées. Relance Spartiate : ferme l’app puis rouvre-la.',
  /** Échec de la restauration : raison de P-04, puis le code. */
  restoreFailed: 'La restauration n’a pas abouti. {reason}',
} as const;
