import { trainingGenerationFr } from './fr.trainingGeneration';

/** Textes de la séance proposée (I3-01) ; importé seulement par le bloc à la demande `GeneratedSession`. */
export type TrainingGenerationTextKey = keyof typeof trainingGenerationFr;

export function tGeneration(key: TrainingGenerationTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = trainingGenerationFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
