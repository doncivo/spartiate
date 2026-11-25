/**
 * Textes de fréquence et de série hérités du module Routines de CircleTasks (M4, R-01 à R-07), lus seulement par `formatRoutine.ts`
 * (`tRoutines`). SHELL-0295 (C-085, D-638) : hors de l'arbre `fr.ts`, donc hors du départ ; les clés sans appelant sont retirées.
 */
export const routinesFr = {
  everyDay: 'tous les jours',
  timesPerWeek: '{count} fois par semaine',
  everyNDays: 'tous les {count} jours',
  everyNWeeksOn: 'toutes les {count} semaines : {days}',
  streakDaysOne: '{count} jour',
  streakDaysOther: '{count} jours',
  streakWeeksOne: '{count} semaine',
  streakWeeksOther: '{count} semaines',
  streakSessionsOne: '{count} séance',
  streakSessionsOther: '{count} séances',
} as const;
