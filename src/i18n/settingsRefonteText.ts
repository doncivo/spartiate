import type { CatalogTranslator } from './catalogText';

/**
 * Textes propres à la refonte de Réglages sur PC (UI-REFONTE-09, PC-Reglages.html) : chargés avec l'écran Réglages, hors du bundle de
 * départ. L'iPhone garde les textes de `fr.ts` (titres en capitales, « Thème · semaine · heure », « (automatique) »).
 */
const fr = {
  theme: 'Thème',
  firstWeekday: 'Début de semaine',
  timeFormat: 'Format de l’heure',
  timeZoneHint: 'Suit celui de Windows',
  launchHint: 'Spartiate s’ouvre réduit dans la zone de notification',
  allShortcuts: 'Tous les raccourcis',
} as const;
export type SettingsRefonteKey = keyof typeof fr;

function translate(key: SettingsRefonteKey, params: Readonly<Record<string, string | number>> = {}): string {
  let text: string = fr[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tSettingsRefonte: CatalogTranslator<typeof fr> = translate;
