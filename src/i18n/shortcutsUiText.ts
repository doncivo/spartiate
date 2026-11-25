import { shortcutsUiFr } from './fr.shortcuts';

/**
 * Textes de la liste des raccourcis (P-08) : catalogue à part, hors de `fr.ts` donc hors du bundle de départ (SHELL-0294a, D-596) ; importé seulement
 * par la fenêtre des raccourcis et la ligne de Réglages, blocs à la demande.
 */
type Leaves<T, P extends string = ''> = { [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`> }[keyof T & string];
export type ShortcutsUiKey = Leaves<typeof shortcutsUiFr>;

export function tShortcutsUi(key: ShortcutsUiKey): string {
  let value: unknown = shortcutsUiFr;
  for (const part of key.split('.')) value = (value as Record<string, unknown>)[part];
  return value as string;
}
