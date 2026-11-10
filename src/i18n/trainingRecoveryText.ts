import { trainingRecoveryFr } from './fr.trainingRecovery';

/** Textes de la récupération en séance (I5-02 point 2.2) ; importé seulement par le bloc à la demande `RecoverySession`. */
export type TrainingRecoveryTextKey = keyof typeof trainingRecoveryFr;

export function tTrainingRecovery(key: TrainingRecoveryTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = trainingRecoveryFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
