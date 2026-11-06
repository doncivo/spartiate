/**
 * Textes du minuteur de test de 60 s (Plus › À propos et diagnostic, SPA-007), à part du catalogue principal (bundle de départ) : chargés avec
 * les écrans de Réglages. Tutoiement. Aucune promesse de notification ni de Live Activity que l'app ne peut pas tenir.
 */
export const timerFr = {
  row: 'Tester le minuteur (60 s)',
  rowHint: 'Éprouve la Live Activity (écran verrouillé, Dynamic Island) et la notification de fin.',
  start: 'Lancer',
  stop: 'Arrêter',
  remaining: 'Il reste {time}',
  finished: 'Le minuteur de test est terminé.',
  label: 'Minuteur de test',
  notificationTitle: 'Minuteur terminé',
  notificationBody: 'Les 60 secondes du minuteur de test sont écoulées.',
  notificationScheduled: 'Une notification sonnera à la fin.',
  notificationDenied: 'Les notifications sont refusées pour Spartiate : aucune notification ne sonnera. Autorise-les dans Réglages › Notifications › Spartiate.',
  notificationFailed: 'La notification n’a pas pu être programmée : aucune notification ne sonnera.',
  pcOnly: 'Sur PC, le minuteur reste dans l’app : aucune notification système.',
  /** État final affiché par la Live Activity elle-même à l'échéance. */
  liveFinished: 'Terminé',
  liveStarted: 'La Live Activity est affichée sur l’écran verrouillé et dans la Dynamic Island.',
  liveUnavailable: 'La Live Activity n’est pas disponible : le minuteur reste dans l’app.',
  liveReasonDisabled: 'Les Live Activities sont désactivées pour Spartiate, ou absentes de cette installation (Réglages › Spartiate › Live Activities).',
  liveReasonUnknown: 'Le système n’a pas dit pourquoi.',
  liveFailed: 'La Live Activity n’a pas pu démarrer : le minuteur reste dans l’app.',
  nativeError: 'Détail technique : {domain}, code {code}, {description}',
  failed: 'Le minuteur n’a pas pu être lu ou enregistré. Réessaie.',
  stopFailed: 'La Live Activity ne s’est pas fermée : rouvre l’app ou ferme-la depuis l’écran verrouillé.',
} as const;
