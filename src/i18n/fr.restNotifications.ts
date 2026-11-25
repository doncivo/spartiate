/**
 * Textes des actions de la notification de fin de repos (SHELL-0294b, § 13.3 b, BL-108), à part du catalogue principal (bundle de départ) :
 * chargés avec le répartiteur des actions de notification (bloc à la demande). Les titres des boutons sont visibles sur l'écran verrouillé.
 */
export const restNotificationsFr = {
  /** Boutons de la notification de fin de repos (catégorie `sp.rest`). */
  actionExtend: '+30 s',
  actionSkip: 'Passer',
  /** Bandeaux brefs dans l'app quand l'action n'a pas pu être appliquée. */
  noticeLate: '« +30 s » est arrivé plus de cinq minutes après la fin du repos : rien n’a été ajouté.',
  noticeNoSession: '« +30 s » ignoré : aucune séance n’est en cours.',
  noticeFailed: 'L’action de la notification de repos n’a pas pu être appliquée : règle le repos dans la séance.',
} as const;
