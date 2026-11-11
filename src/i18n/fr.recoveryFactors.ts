/**
 * Textes de la carte « valeurs inhabituelles », du journal de facteurs de la veille et de Progrès › Récupération (I6-01, § 16.7), à part du
 * catalogue principal : chargés avec les écrans de récupération, à la demande. Aucune formulation de diagnostic ni d'hypothèse médicale : on
 * décrit un écart à la base personnelle et une association observée, jamais une cause.
 */
export const recoveryFactorsFr = {
  unusualTitle: 'Valeurs inhabituelles : repos conseillé',
  unusualLead: 'Deux nuits de suite, une de tes mesures s’écarte nettement de ta base personnelle :',
  unusualHrvLow: 'HRV basse (au moins 2 σ sous ta base).',
  unusualRhrHigh: 'Fréquence cardiaque au repos élevée (au moins 2 σ au-dessus de ta base).',
  unusualAdvice: 'Un repos est conseillé aujourd’hui : allège ta journée si tu le peux.',
  unusualDisclaimer: 'Estimation à partir de tes données, pas un avis médical.',

  journalLegend: 'Hier ({date}) : qu’est-ce qui a compté ?',
  journalHint: 'Facultatif, modifiable toute la journée. Ces cases restent sur tes appareils et nulle part ailleurs.',
  statusUnset: 'Non renseigné',
  statusNone: 'Rien de particulier noté',
  statusSome: 'Noté : {list}',
  saveFailed: 'Enregistrement impossible. Réessaie.',
  none: 'Rien de particulier',
  factor_alcohol: 'Alcool',
  factor_caffeine_late: 'Caféine après 16 h',
  factor_late_meal: 'Repas tardif',
  factor_stress: 'Stress',
  factor_soreness: 'Courbatures',
  factor_illness: 'Maladie',
  factor_travel: 'Voyage',
  factor_late_training: 'Entraînement tardif',

  progressTitle: 'Récupération : ce qui change ta Recovery',
  loading: 'Chargement du journal de facteurs…',
  loadFailed: 'Lecture impossible du journal de facteurs.',
  retry: 'Réessayer',
  progressEmpty: 'Aucun jour renseigné pour l’instant : coche ton journal de facteurs le matin, sur Aujourd’hui.',
  progressNotEnough: 'Journal renseigné : {n} jours sur {min}. Les comparaisons apparaissent à partir de {min} jours renseignés.',
  progressNoPair: 'Assez de jours renseignés, mais aucun facteur n’a au moins {occ} jours avec et {without} jours sans : rien à comparer pour l’instant.',
  progressDaysWith: '{n} jours avec : Recovery moyenne du lendemain {mean}',
  progressDaysWithout: '{n} jours sans : Recovery moyenne du lendemain {mean}',
  progressLower: '{d} points plus bas le lendemain en moyenne avec ce facteur',
  progressLowerOne: '1 point plus bas le lendemain en moyenne avec ce facteur',
  progressHigher: '{d} points plus haut le lendemain en moyenne avec ce facteur',
  progressHigherOne: '1 point plus haut le lendemain en moyenne avec ce facteur',
  progressSame: 'Aucun écart le lendemain en moyenne',
  progressNote: 'Association observée, pas une cause : d’autres éléments ont pu jouer. Le facteur d’un jour est rapproché de la Recovery du lendemain.',
} as const;
