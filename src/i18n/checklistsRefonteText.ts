
/**
 * Textes propres à l'écran Checklists iPhone (UI-REFONTE-06, Checklists-v2.html) : chargés avec l'écran, hors du bundle de départ.
 * Progression « 2 sur 3 », libellés du bas qui portent le compte. Le PC garde les textes de `fr.checklists.ts`.
 */
const fr = {
  progress: '{checked} sur {total}',
  clearNone: 'Supprimer les éléments cochés',
  clearOne: 'Supprimer l’élément coché',
  clearMany: 'Supprimer les {count} éléments cochés',
} as const;
export function tChecklistsRefonte(key: keyof typeof fr, params: Record<string, string | number> = {}): string {
  let text: string = fr[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

/** « Supprimer les 2 éléments cochés », « Supprimer l’élément coché », à zéro « Supprimer les éléments cochés » (inactif). */
export function clearCheckedLabel(count: number): string {
  if (count === 0) return tChecklistsRefonte('clearNone');
  if (count === 1) return tChecklistsRefonte('clearOne');
  return tChecklistsRefonte('clearMany', { count });
}
