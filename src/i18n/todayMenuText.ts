
/** Catalogue du menu « Plus d’options » d'Aujourd'hui (UI-REFONTE-02) : chargé avec le menu, hors du départ. */
const fr = {
  goals: 'Objectif de la semaine',
  report: 'Rapport mensuel',
  compact: 'Vue compacte',
  edit: 'Mode édition',
} as const;
export function tTodayMenu(key: keyof typeof fr): string {
  return fr[key];
}
