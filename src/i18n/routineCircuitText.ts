import { routineCircuitFr } from './fr.routineCircuit';

/** Textes des groupes de l'éditeur de routine, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type RoutineCircuitTextKey = keyof typeof routineCircuitFr;

export function tRoutineCircuit(key: RoutineCircuitTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = routineCircuitFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
