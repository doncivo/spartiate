import { trainingSessionFr } from './fr.trainingSession';

/** Textes des ajouts SESS-01 de la séance active ; importé seulement par des blocs chargés à la demande. */
export type TrainingSessionTextKey = keyof typeof trainingSessionFr;

export function tSession(key: TrainingSessionTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = trainingSessionFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
