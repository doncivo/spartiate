/** PROGRES : textes de Progrès › Entraînement (volume, constance, adhérence), catalogue chargé à la demande avec le bloc, jamais dans le départ. */
export const trainingProgressFr = {
  loading: 'Chargement des indicateurs d’entraînement…',
  loadFailed: 'Les indicateurs d’entraînement n’ont pas pu être lus.',
  retry: 'Réessayer',
  volumeTitle: 'Volume par muscle',
  volumeSubtitle: 'Séries de travail validées par semaine (semaines glissantes : {weeks}) ; un muscle secondaire compte pour sa part (par exemple 0,5 série).',
  volumeEmpty: 'Aucune série de travail validée sur la période.',
  volumeLine: 'Cette semaine : {n} · moyenne par semaine : {mean}',
  volumeChart: '{muscle}, séries par semaine : {values}',
  volumeWeek: 'semaine du {date} : {n}',
  volumeUnknownOne: '{n} série d’un exercice absent de la bibliothèque n’est pas comptée.',
  volumeUnknown: '{n} séries d’exercices absents de la bibliothèque ne sont pas comptées.',
  volumeNoRange: 'Aucune plage cible n’est encore fixée par muscle : le volume est affiché sans jugement.',
} as const;
