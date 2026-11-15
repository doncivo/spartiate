/**
 * Textes de la liste des raccourcis (P-08) et de la capture rapide globale (D-04), en français :
 * source de vérité ; `en.shortcuts.ts` suit la même forme.
 */
export const shortcutsUiFr = {
  title: 'Raccourcis clavier',
  filterLabel: 'Filtrer',
  filterPlaceholder: 'Filtrer',
  tableLabel: 'Raccourcis clavier',
  colKeys: 'Touches',
  colAction: 'Action',
  groupGlobal: 'Global',
  groupApp: 'Application',
  groupList: 'Listes',
  groupWeek: 'Semaine',
  empty: 'Aucun raccourci ne correspond.',
  inWeek: '(dans la Semaine)',
  inList: '(dans une liste)',
  comingSoon: '(bientôt)',
  openHelpLabel: 'Afficher les raccourcis clavier',
  spoken: {
    ctrl: 'Contrôle',
    alt: 'Alt',
    shift: 'Maj',
    space: 'Espace',
    escape: 'Échap',
    enter: 'Entrée',
    delete: 'Suppression',
    arrowUp: 'flèche haut',
    arrowDown: 'flèche bas',
    arrowLeft: 'flèche gauche',
    arrowRight: 'flèche droite',
    comma: 'virgule',
    slash: 'barre oblique',
    plus: 'plus',
  },
  settings: {
    section: 'CLAVIER',
    quickCapture: 'Capture rapide',
    reset: 'Rétablir {keys}',
    cancelled: 'Combinaison inchangée',
    saveError: 'Impossible d’enregistrer ce réglage.',
  },
} as const;
