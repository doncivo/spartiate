/**
 * Textes du module Routines (M4, R-01 à R-07), en français : fusionnés dans `fr.routines` (fr.ts). Fichier séparé pour garder
 * fr.ts lisible ; les mêmes clés existent dans en.routines.ts (le typage l'impose).
 */
export const routinesFr = {
  title: 'Routines',
  add: 'Ajouter une routine',
  empty: 'Aucune routine pour l’instant.',
  loadError: 'Impossible de charger les routines.',
  saveError: 'Impossible d’enregistrer la routine.',
  listLabel: 'Liste des routines',
  edit: 'Modifier',
  everyDay: 'tous les jours',
  timesPerWeek: '{count} fois par semaine',
  everyNDays: 'tous les {count} jours',
  everyNWeeksOn: 'toutes les {count} semaines : {days}',
  report: {
    openLabel: 'Rapport de la routine {title}',
    close: 'Fermer',
    rateLabel: 'Taux sur {days} jours : {value}',
    pause: 'Mettre en pause',
    resume: 'Reprendre',
    modify: 'Modifier',
  },
  monthReport: {
    open: 'Rapport du mois',
    section: 'ROUTINES — JOURS COMPLÉTÉS',
    empty: 'Aucune routine à afficher pour ce mois.',
  },
  paused: 'En pause',
  archived: {
    listLabel: 'Routines archivées',
    restore: 'Restaurer',
    restoreLabel: 'Restaurer la routine {title}',
  },
  streak: {
    daysOne: '{count} jour',
    daysOther: '{count} jours',
    weeksOne: '{count} semaine',
    weeksOther: '{count} semaines',
    sessionsOne: '{count} séance',
    sessionsOther: '{count} séances',
    info: 'série {value}',
  },
  undo: {
    paused: '« {title} » mise en pause',
    resumed: '« {title} » reprise',
    restored: '« {title} » restaurée',
  },
  form: {
    editTitle: 'Modifier la routine',
    nameLabel: 'Nom de la routine',
    close: 'Fermer',
    daily: 'Tous les jours',
    weekdays: 'Jours choisis',
    space: 'Espace',
    pause: 'Mettre en pause',
    pauseHint: 'Aucune occurrence tant que la pause dure',
    save: 'Enregistrer',
  },
} as const;
