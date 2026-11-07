import { progressionFr } from './fr.progression';

/** Textes de la prescription (I2-01) ; importé seulement par le composant à la demande `ExerciseProgression`. */
export type ProgressionTextKey = keyof typeof progressionFr;

export function tProgression(key: ProgressionTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = progressionFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
