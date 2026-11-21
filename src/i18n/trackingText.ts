import { trackingFr } from './fr.tracking';

/** SUIVIS-029 : textes des suivis, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type TrackingTextKey = keyof typeof trackingFr;

export function tTracking(key: TrackingTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = trackingFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/** Nombre entier à la française (espace insécable fine des milliers). */
export const formatCount = (n: number): string => n.toLocaleString('fr-FR');
