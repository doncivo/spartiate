import { utcToLocal } from '../domain/timeZone';
import { healthFr } from './fr.health';

/** Textes d'« Apple Santé », à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type HealthTextKey = keyof typeof healthFr;

export function tHealth(key: HealthTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = healthFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/** Heure 24 h dans le fuseau de la mesure : « 07:48 » (conversion du domaine, aucune option Intl d'heure). */
export function formatHealthTime(iso: string, timeZone: string): string {
  return utcToLocal(iso, timeZone).time;
}
