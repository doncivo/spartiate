
/** Textes propres à l'écran Événements iPhone (UI-REFONTE-07, Evenements-v2.html) : chargés avec l'écran, hors du bundle de départ. */
const fr = {
  hideHolidays: 'Masquer les fériés',
  showHolidays: 'Afficher les fériés',
  calendarView: 'Vue calendrier',
  addEvent: 'Événement',
} as const;
export function tEventsRefonte(key: keyof typeof fr): string {
  return fr[key];
}
