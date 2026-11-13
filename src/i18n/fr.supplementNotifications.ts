/**
 * Textes des rappels de compléments (I6-05, D-212), à part du catalogue principal (bundle de départ) : chargés à la demande par le service au
 * moment de composer une notification. VISIBLES sur l'écran verrouillé : neutres, jamais le nom d'un complément ni une dose.
 */
export const supplementNotificationsFr = {
  title: 'Compléments',
  bodyOne: 'Une prise à cocher.',
  bodyMany: '{n} prises à cocher.',
  /** FIX-0221 (D-250) : bouton de la notification, visible sur l'écran verrouillé. */
  actionTaken: 'Pris',
  /** Texte d'iOS quand les aperçus sont masqués (écran verrouillé) : jamais un nom. */
  hiddenPlaceholder: 'Prise à cocher',
  /** Confirmation dans l'app (bandeau bref) quand l'action a été appliquée. */
  noticeTakenOne: 'Prise cochée depuis la notification.',
  noticeTakenMany: '{n} prises cochées depuis la notification.',
  noticeFailed: 'Une prise n’a pas pu être cochée depuis la notification : coche-la sur Aujourd’hui.',
  noticeLost: 'Une action « Pris » n’a pas pu être lue : vérifie tes prises sur Aujourd’hui.',
} as const;
