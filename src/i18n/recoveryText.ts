import { recoveryFr } from './fr.recovery';

/** Textes des cadrans de récupération, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type RecoveryTextKey = keyof typeof recoveryFr;

export function tRecovery(key: RecoveryTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = recoveryFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
