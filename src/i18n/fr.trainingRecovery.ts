/**
 * Textes de la récupération dans l'entraînement (I5-02 point 2.2 ; § 16.4, § 16.7) : bandeau « journée rouge » et Recovery Split. Catalogue
 * chargé avec le bloc à la demande `RecoverySession` (src/features/training/session), jamais dans le départ. Aucun diagnostic.
 */
export const trainingRecoveryFr = {
  redDayRegion: 'Journée rouge',
  redDayTitle: 'Journée rouge : maintien des charges proposé',
  redDayHint:
    'Recovery {score} aujourd’hui. Accepter : aucune hausse de charge pendant cette séance (le moteur peut alléger un peu et retirer une série aux exercices d’isolation). Ignorer : propositions habituelles. Estimation, pas un avis médical.',
  redDayAccept: 'Accepter le maintien',
  redDayIgnore: 'Ignorer',
  redDayAccepted: 'Journée rouge : maintien des charges accepté pour cette séance.',
  redDayIgnored: 'Journée rouge ignorée : propositions habituelles pour cette séance.',
  redDayWriteError: 'Choix non enregistré. Réessaie.',
  splitTitle: 'Récupération par muscle',
  splitReady: '{muscle} : {percent} % · prêt',
  splitSpare: '{muscle} : {percent} % · à ménager',
  splitUnknown: '{muscle} : inconnu',
  splitSuggestion: 'À ménager aujourd’hui : {muscles} (moins de {threshold} %). La séance n’est pas modifiée.',
  splitNote: 'Approximation tirée de tes séances : estimation, pas un avis médical.',
  splitError: 'Récupération par muscle illisible pour l’instant.',
  listJoin: ', ',
} as const;
