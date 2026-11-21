import { injuriesFr } from './fr.injuries';

/** Textes de « Blessures », importés seulement par des modules chargés à la demande. */
export type InjuriesTextKey = keyof typeof injuriesFr;

export function tInjuries(key: InjuriesTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = injuriesFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
