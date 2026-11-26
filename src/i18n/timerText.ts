import type { CatalogTranslator } from './catalogText';
import { timerFr } from './fr.timer';

/** Textes du minuteur de test, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type TimerTextKey = keyof typeof timerFr;

function translate(key: TimerTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = timerFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
/** CLEAN-0296 (C-085, D-644) : paramètres typés comme par `catalogText` ; corps gardé ici, l'écran ne précharge aucun bloc de plus. */
export const tTimer: CatalogTranslator<typeof timerFr> = translate;
