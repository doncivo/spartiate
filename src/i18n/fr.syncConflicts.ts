/**
 * Textes de `sync.conflicts` (Y-04), en français : source de vérité. Bloc « JOURNAL DES CONFLITS » de Réglages › Synchronisation ›
 * Détails (Synchro.html), restauration de la valeur écartée, refus et annulation (T-13). Jamais une valeur dans le journal technique.
 */
export const syncConflictsFr = {
  listLabel: 'Journal des conflits',
  /** Nom accessible d'une ligne de la liste (critère 14). */
  itemLabel: 'Conflit : {title}, {field}',
  /** « Heure prévue de « Envoyer la facture » » : champ (initiale en capitale) puis titre entre guillemets (UI-REFONTE-04). */
  heading: '{field} de {title}',
  deletedItem: 'Élément supprimé',
  side: '{device} · {time}',
  otherDevice: 'Autre appareil',
  appleReminders: 'Rappels Apple',
  restore: 'Rétablir',
  restoreLabel: 'Rétablir la valeur écartée : {title}, {field}',
  restoring: 'Rétablissement…',
  restoredOn: 'Rétablie le {date}',
  showMore: 'Afficher plus',
  /** Valeur texte entre guillemets (Synchro.html) ; `{text}` déjà tronqué. */
  quoted: '« {text} »',
  unreadableOne: '1 conflit du journal est illisible et n’est pas affiché',
  unreadableMany: '{count} conflits du journal sont illisibles et ne sont pas affichés',
  loadFailed: 'Le journal des conflits n’a pas pu être lu. Rouvre cet écran pour réessayer.',
  /** Message « Annuler » (T-13, 5 s). */
  undoLabel: 'Valeur rétablie',
  result: {
    restored: 'Valeur rétablie : {title}, {field}',
    already: 'Cette valeur est déjà en place : conflit marqué résolu',
    rowGone: 'Cet élément n’existe plus : la valeur ne peut pas être restaurée',
    parentGone: 'L’élément lié n’existe plus : la valeur ne peut pas être restaurée',
    invalid: 'Valeur invalide : elle ne peut pas être restaurée',
    failed: 'La restauration a échoué. Rien n’a été modifié : réessaie.',
  },
  values: {
    empty: '(vide)',
    yes: 'Oui',
    no: 'Non',
    deleted: 'supprimé',
    modified: 'modifié',
    present: 'présent',
    todo: 'à faire',
    done: 'terminée',
    noProject: 'Sans projet',
    /** Profil et poids (0.1.4) : libellés lisibles des valeurs qui ne sont pas déjà dans l'écran Profil et poids. */
    sourceManual: 'Saisie à la main',
    sourceHealth: 'Apple Santé',
    unitsMetric: 'Métrique',
    kg: '{value} kg',
    cm: '{value} cm',
  },
  /** Titres des conflits du profil et des pesées (0.1.4) : aucun « Élément de … » ni date brute. */
  profileHeading: 'Profil : {field}',
  weightHeading: 'Pesée du {date}',
  weightHeadingField: 'Pesée du {date} : {field}',
  weightGone: 'Pesée supprimée',
  /** Élément sans titre propre (répétition, réglage) ou dont la ligne visée n'a plus de titre. */
  kinds: {
    profile: 'Profil',
    recurrence: 'Répétition',
    settings: 'Réglage',
    other: 'Élément',
  },
} as const;
