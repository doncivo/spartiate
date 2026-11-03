
/** Textes de la seconde colonne d'Aujourd'hui sur PC (UI-REFONTE-08, PC-Jour.html) : chargés avec le bloc, hors du bundle de départ. */
const fr = {
  tomorrow: 'Demain',
  thisWeek: 'Cette semaine',
  shortcuts: 'Raccourcis',
  nothing: 'Rien de prévu',
  hintNew: 'nouvelle tâche',
  hintSearch: 'rechercher',
  hintAll: 'tous les raccourcis',
  regionLabel: 'Ce qui arrive',
} as const;
export function tTodaySide(key: keyof typeof fr): string {
  return fr[key];
}
