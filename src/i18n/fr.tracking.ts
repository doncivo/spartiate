/**
 * SUIVIS-029 (lot 0.29.0, PROG-02) : textes des suivis complémentaires (carte « Suivis du jour » d'Aujourd'hui, Progrès › Suivis), à part du catalogue
 * principal : chargés avec ces blocs, à la demande. Aucune formulation médicale : des repères personnels, jamais un avis.
 */
export const trackingFr = {
  missing: '—',
  todayTitle: 'Suivis du jour',
  stepsGoalTitle: 'Objectif de pas',
  stepsProgress: '{steps} / {goal} pas ({percent} %)',
  stepsReached: 'Objectif atteint',
  stepsReason_on_pc: 'Les pas restent sur l’iPhone (pas.csv) : ils ne sont pas publiés vers le PC.',
  stepsReason_never_read: 'Aucun pas.csv lu : fichier absent ou illisible (Plus → Apple Santé → Raccourcis).',
  stepsReason_no_today: 'Le dernier pas.csv lu ne donne pas de total pour aujourd’hui.',
  stepsReason_read_failed: 'Lecture des pas impossible pour l’instant.',
  loading: 'Chargement des suivis…',
  loadFailed: 'Lecture impossible des suivis.',
  retry: 'Réessayer',

  progressTitle: 'Suivis',
  progressHint: 'Repères personnels calculés sur l’appareil, jamais envoyés à un service.',
  goalsTitle: 'Objectifs',
  goalSteps: 'Pas par jour',
  goalZone2: 'Minutes en zone 2 par semaine',
  goalHrMax: 'FC max saisie (bpm, vide : 220 − âge)',
  goalsSave: 'Enregistrer les objectifs',
  goalsSaved: 'Objectifs enregistrés.',
  goalsSaveFailed: 'Enregistrement impossible. Réessaie.',
  issue_empty: 'Valeur attendue.',
  issue_format: 'Nombre entier attendu.',
  issue_range: 'Entre {min} et {max}.',
  stepsWeeksTitle: 'Pas par semaine',
  weekOf: 'Semaine du {date}',
  stepsWeekLine: 'moyenne {avg} pas · {n} j connus · {g} j à l’objectif',
} as const;
