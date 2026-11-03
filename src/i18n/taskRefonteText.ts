
const fr = {
  more: "Plus d'options",
  moreHint: 'répétition, rappel, projet, icône',
  date: 'Date',
  time: 'Heure',
  noTime: "Pas d'heure",
  planned: 'Prévue',
  reminder: 'Rappels',
  quiet: 'Décalé par la plage silencieuse de {space}',
  inactive: 'Rappels conservés, inactifs',
  defineGoal: 'En définir un',
  noNote: 'Aucune note',
  scheduleDone: 'Terminé',
} as const;
/** Ce catalogue ne se charge qu'avec les feuilles de tâches. */
export function tTaskRefonte(key: keyof typeof fr, params?: { space: string }): string {
  const text = fr[key];
  return params ? text.replace('{space}', params.space) : text;
}
