/**
 * Textes des circuits de la séance (I6-03, § 13.8) : superset, triset et circuit sont un seul mécanisme. Catalogue à part, chargé avec le bloc à la
 * demande des circuits (jamais dans le départ).
 */
export const circuitFr = {
  formTitle: 'Superset, triset ou circuit',
  formHint: 'Coche les exercices à enchaîner série par série : deux = superset, trois = triset, quatre ou plus = circuit. L’ordre est celui de la séance.',
  pickLegend: 'Exercices du groupe',
  roundsLabel: 'Nombre de tours',
  roundsHint: 'Vide : le plus grand nombre de séries des exercices cochés.',
  restBetweenLabel: 'Repos entre exercices (s)',
  restRoundLabel: 'Repos de fin de tour (s)',
  create: 'Créer le groupe',
  cancel: 'Annuler',
  errorFew: 'Coche au moins deux exercices.',
  errorValues: 'Valeurs hors bornes : tours de 1 à 20, repos de 0 à 3 600 s, en nombres entiers.',
  errorDone: 'Un exercice a plus de séries validées que de tours demandés : demande plus de tours.',
  errorWrite: 'Le groupe n’a pas pu être créé. Rien n’a été modifié.',
  region: 'Groupe : {kind}',
  superset: 'Superset',
  triset: 'Triset',
  circuit: 'Circuit',
  headline: '{kind} · {n} exercices · {rounds} tours',
  headlineOne: '{kind} · {n} exercices · 1 tour',
  rests: 'Repos entre exercices : {between} · repos de fin de tour : {round}',
  restNone: 'aucun',
  restOwn: 'celui de l’exercice',
  next: 'Suivant : {name} (tour {round} sur {rounds})',
  finished: 'Groupe terminé.',
  ungroup: 'Défaire le groupe',
  ungroupFailed: 'Le groupe n’a pas pu être défait. Rien n’a été modifié.',
} as const;
