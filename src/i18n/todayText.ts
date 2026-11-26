import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { frFirst } from './format';
import { todayFr } from './fr.today';

/** Textes de l'écran Aujourd'hui, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type TodayTextKey = keyof typeof todayFr;
/** CLEAN-0297 (C-085) : clés sans paramètre `{x}` (tables de libellés passées sans paramètre). */
export type TodayPlainKey = PlainCatalogKey<typeof todayFr>;

function translate(key: TodayTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = todayFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tToday: CatalogTranslator<typeof todayFr> = translate;

/** Date de la planche iPhone (« mercredi 4 novembre ») pour un jour civil `AAAA-MM-JJ`. */
export function formatTodayEyebrow(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return frFirst(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))));
}
