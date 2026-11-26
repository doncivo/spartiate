import type { CatalogTranslator, PlainCatalogKey } from './catalogText';
import { utcToLocal } from '../domain/timeZone';
import { healthFr } from './fr.health';

/** Textes d'« Apple Santé », à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type HealthTextKey = keyof typeof healthFr;
/** CLEAN-0297 (C-085) : clés sans paramètre `{x}` (tables de libellés passées sans paramètre). */
export type HealthPlainKey = PlainCatalogKey<typeof healthFr>;

function translate(key: HealthTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = healthFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0297 (C-085) : paramètres typés comme par `catalogText` ; corps d'origine gardé ici (départ inchangé, import de type seul). */
export const tHealth: CatalogTranslator<typeof healthFr> = translate;

/** Heure 24 h dans le fuseau de la mesure : « 07:48 » (conversion du domaine, aucune option Intl d'heure). */
export function formatHealthTime(iso: string, timeZone: string): string {
  return utcToLocal(iso, timeZone).time;
}
