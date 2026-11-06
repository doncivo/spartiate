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

/** Chrono de séance : 95 000 ms → « 1:35 », 3 725 000 ms → « 1:02:05 ». */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${String(h)}:${String(m).padStart(2, '0')}:${s}` : `${String(m)}:${s}`;
}

/** Jour d'une séance passée : « 26 octobre » (heure locale). */
export const formatDay = (iso: string): string => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/** Durée de repos : 150 → « 2 min 30 s », 90 → « 1 min 30 s », 120 → « 2 min », 45 → « 45 s ». */
export function formatRest(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return tTraining('seconds', { s });
  return s === 0 ? tTraining('minutes', { m }) : tTraining('minutesSeconds', { m, s });
}
