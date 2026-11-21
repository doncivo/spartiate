import { appleIntelligenceFr } from './fr.appleIntelligence';

/** Textes de l'essai Apple Intelligence, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type AppleIntelligenceTextKey = keyof typeof appleIntelligenceFr;

export function tAppleIntelligence(key: AppleIntelligenceTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = appleIntelligenceFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
