/**
 * Corps › Mesures, rythme des mesures et rappel (CORPS-0301d, BL-180, D-713, D-714) : catalogue à part, chargé avec son composant (bloc à la
 * demande), jamais dans le départ.
 */
export const measurementRhythmFr = {
  title: 'Rythme des mesures',
  rhythm_7: 'Chaque semaine',
  rhythm_14: 'Toutes les 2 semaines',
  rhythm_28: 'Toutes les 4 semaines',
  none: 'Aucune séance de mesures',
  lastToday: 'Dernière séance de mesures aujourd’hui',
  lastOne: 'Dernière séance de mesures il y a {n} jour',
  lastMany: 'Dernière séance de mesures il y a {n} jours',
  nextToday: 'Prochaine conseillée aujourd’hui',
  nextOne: 'Prochaine conseillée dans {n} jour',
  nextMany: 'Prochaine conseillée dans {n} jours',
  reminderLabel: 'Rappel le matin du jour prévu',
  reminderHint: 'Notification à 09:00 sur cet iPhone, sans zone ni valeur.',
  reminderPc: 'Le rappel est émis sur l’iPhone.',
  reminderPermission: 'Notifications refusées : autorise Spartiate dans les Réglages de l’iPhone.',
  reminderFailed: 'Le rappel n’a pas pu être programmé.',
  saveFailed: 'Réglage non enregistré. Réessaie.',
} as const;
