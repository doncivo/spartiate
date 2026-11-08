import { trainingCycleFr } from './fr.trainingCycle';

/** Textes de la section Cycle (I3-02) ; importé seulement par le bloc à la demande `CycleView`. */
export type TrainingCycleTextKey = keyof typeof trainingCycleFr;

export function tCycle(key: TrainingCycleTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = trainingCycleFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/** « 9 novembre » : date locale `AAAA-MM-JJ` en français, sans année. */
export function cycleDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}
