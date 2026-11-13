import { trainingMediaFr } from './fr.trainingMedia';

/** Textes des médias d'exercice (I6-07) ; importé seulement par le bloc à la demande `ExerciseMedia`. */
export type TrainingMediaTextKey = keyof typeof trainingMediaFr;

export function tTrainingMedia(key: TrainingMediaTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = trainingMediaFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
