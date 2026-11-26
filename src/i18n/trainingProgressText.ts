import { catalogText } from './catalogText';
import { trainingProgressFr } from './fr.trainingProgress';

/** Textes de Progrès › Entraînement, à part du catalogue principal ; importé seulement par les blocs chargés à la demande (PROGRES). */
export type TrainingProgressTextKey = keyof typeof trainingProgressFr;

export const tTrainingProgress = catalogText(trainingProgressFr);

/** Nombre au dixième, virgule décimale (« 1,5 », « 3 »). */
export const formatTenth = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');

/** « 16/11 » d'une date locale AAAA-MM-JJ. */
export const formatDayMonth = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
