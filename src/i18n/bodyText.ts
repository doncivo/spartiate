import { bodyFr } from './fr.body';

/** Textes de « Profil et poids », à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type BodyTextKey = keyof typeof bodyFr;

export function tBody(key: BodyTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = bodyFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/** Nombre affiché avec la virgule française : 82.4 → « 82,4 ». */
export const formatKg = (kg: number): string => String(kg).replace('.', ',');
