import { trainingFr } from './fr.training';

/** Textes de l'Entraînement, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type TrainingTextKey = keyof typeof trainingFr;

export function tTraining(key: TrainingTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = trainingFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/** Nombre affiché avec la virgule française : 2.5 → « 2,5 ». */
export const formatNumber = (n: number): string => String(n).replace('.', ',');

/** Lecture d'un nombre saisi (virgule ou point) ; vide ou illisible → null. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '' || !/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** Durée de repos : 150 → « 2 min 30 s », 90 → « 1 min 30 s », 120 → « 2 min », 45 → « 45 s ». */
export function formatRest(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return tTraining('seconds', { s });
  return s === 0 ? tTraining('minutes', { m }) : tTraining('minutesSeconds', { m, s });
}
