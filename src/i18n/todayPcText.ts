import { todayPcFr } from './fr.todayPc';

/** Textes d'Aujourd'hui PC (tableau de la séance, colonne droite) ; importé seulement par des blocs chargés à la demande. */
export type TodayPcTextKey = keyof typeof todayPcFr;

export function tTodayPc(key: TodayPcTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = todayPcFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
