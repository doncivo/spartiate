/**
 * Textes des groupes dans l'éditeur de routine (I6-03b, § 13.8) : superset, triset et circuit sont un seul mécanisme, comme dans la séance (fr.circuit,
 * dont les libellés communs sont repris). Catalogue à part, chargé avec le bloc à la demande `RoutineCircuitUi` (jamais dans le départ).
 */
export const routineCircuitFr = {
  formHint: 'Coche les exercices du jour à enchaîner série par série : deux = superset, trois = triset, quatre ou plus = circuit. Le groupe est retrouvé dans chaque séance démarrée depuis ce jour.',
  roundsHint: 'Vide : le plus grand nombre de séries des exercices cochés. Chaque exercice du groupe reçoit ce nombre de séries.',
  restRoundHint: 'Vide : chaque exercice garde son repos.',
  pickNone: 'Il faut au moins deux exercices hors groupe dans ce jour pour former un groupe.',
  errorValues: 'Valeurs hors bornes : tours de 1 à 20, repos entre exercices de 0 à 3 600 s. Repos de fin de tour : de 0 à 900 s. Nombres entiers.',
  membersLabel: 'Exercices, dans l’ordre du tour :',
  saveHint: 'Le groupe sera écrit en enregistrant la routine.',
} as const;
