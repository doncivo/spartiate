import { bodyProgressFr } from './fr.bodyProgress';

/** Textes de Progrès › Corps, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type BodyProgressTextKey = keyof typeof bodyProgressFr;

export function tBodyProgress(key: BodyProgressTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = bodyProgressFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/** Nombre à virgule décimale française (« 82,5 »). */
export const formatCm = (value: number): string => String(value).replace('.', ',');
