/**
 * Textes de la récupération dans l'entraînement (I5-02 point 2.2 ; § 16.4, § 16.7) : bandeau « journée rouge » et Recovery Split. Catalogue
 * chargé avec le bloc à la demande `RecoverySession` (src/features/training/session), jamais dans le départ. Aucun diagnostic.
 */
export const trainingRecoveryFr = {
  redDayRegion: 'Journée rouge',
  // Règle d'Ali du 12/11 (D-170, révise D-93) : charges × 0,95, arrondies au matériel vers le bas, jamais sous la charge minimale.
  redDayTitle: 'Journée rouge : charges allégées de 5 % proposées',
  redDayHint:
    'Recovery {score} aujourd’hui. Accepter : charges × 0,95 pendant cette séance, arrondies au matériel vers le bas, jamais sous la charge minimale ; séries et répétitions inchangées, aucune hausse. Ignorer : propositions habituelles. Estimation, pas un avis médical.',
  redDayAccept: 'Accepter l’allègement',
  redDayIgnore: 'Ignorer',
  redDayAccepted: 'Journée rouge : charges allégées de 5 % pour cette séance.',
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
