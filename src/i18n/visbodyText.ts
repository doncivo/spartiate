import { visbodyFr } from './fr.visbody';

/** SUIVIS-029d : textes des bilans VISBODY, à part du catalogue principal ; importé seulement par le bloc Corps, chargé à la demande. */
export type VisbodyTextKey = keyof typeof visbodyFr;

export function tVisbody(key: VisbodyTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = visbodyFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
