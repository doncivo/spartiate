import { circuitFr } from './fr.circuit';

/** Textes des circuits de la séance, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type CircuitTextKey = keyof typeof circuitFr;

export function tCircuit(key: CircuitTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = circuitFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
