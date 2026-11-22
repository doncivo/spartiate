/**
 * Textes des notifications de rappel (N-01, ADR 0012 avenant N1.3) et de l'état des rappels (Réglages > Rappels, bandeau), en français :
 * source de vérité ; `en.notifications.ts` suit la même forme. Le journal technique ne reçoit jamais ces textes (codes et nombres seulement).
 */
export const notificationsFr = {
  untitled: 'Sans titre',
  recap: {
    more: 'et {n} autres',
    generic: 'Ouvre Spartiate pour voir ta journée',
  },
  focusEnd: {
    title: 'Session terminée · {duration}',
  },
  // N-03 : boutons de la notification (titres passés au plugin, aucun texte en dur côté Swift).
  action: {
    done: 'Fait',
    snooze: '+15 min',
  },
} as const;

/** `reminders.status` : état des rappels (Réglages > Rappels, bandeau de l'app). */
export const remindersStatusFr = {
  sectionTitle: 'État des rappels',
  pcInfo: 'Les rappels sont envoyés par l’iPhone',
  allow: 'Autoriser',
  allowLabel: 'Autoriser les notifications',
  allowExplain: 'Spartiate envoie tes rappels et tes récapitulatifs par des notifications sur cet iPhone.',
  permissionDenied: 'Les notifications sont refusées : les rappels ne sonneront pas. Autorise-les dans Réglages > Notifications > Spartiate sur l’iPhone.',
  unavailable: 'Les notifications ne sont pas disponibles sur cet iPhone',
  // N-07 : avertissement du PC (le PC n'envoie aucune notification, il avertit seulement).
  reason: {
    'duplicate-id': 'Identifiant en double',
    'over-limit': 'Plus de 64 notifications',
    'invalid-request': 'Notification invalide',
    'unavailable': 'Notifications indisponibles',
    'permission-denied': 'Autorisation refusée',
    'schedule-failed': 'Envoi refusé par iOS',
    'verify-failed': 'Notification absente après l’envoi',
    'ledger-failed': 'Registre non enregistré',
    'zone-unknown': 'Fuseau illisible',
  },
  // N-03 : actions « Fait » et « +15 min » des notifications.
  actionsReason: {
    'delegate-lost': 'gestionnaire des notifications repris',
    'delegate-late': 'gestionnaire posé après le lancement : action à froid perdue possible',
    'register-failed': 'boutons non enregistrés',
    'source-failed': 'fichier des actions illisible',
    'queue-write-failed': 'actions reçues non enregistrées',
  },
} as const;
