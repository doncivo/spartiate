import { recoveryFactorsFr } from './fr.recoveryFactors';

/** Textes du journal de facteurs et des valeurs inhabituelles, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type RecoveryFactorsTextKey = keyof typeof recoveryFactorsFr;

export function tRecoveryFactors(key: RecoveryFactorsTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = recoveryFactorsFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
