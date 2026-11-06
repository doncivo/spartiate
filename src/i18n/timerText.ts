import { timerFr } from './fr.timer';

/** Textes du minuteur de test, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type TimerTextKey = keyof typeof timerFr;

export function tTimer(key: TimerTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = timerFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
