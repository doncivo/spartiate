import { frFirst } from './format';
import { catalogText } from './catalogText';
import { trainingCycleFr } from './fr.trainingCycle';

/** Textes de la section Cycle (I3-02) ; importé seulement par le bloc à la demande `CycleView`. */
export type TrainingCycleTextKey = keyof typeof trainingCycleFr;

export const tCycle = catalogText(trainingCycleFr);

/** « 9 novembre » : date locale `AAAA-MM-JJ` en français, sans année. */
export function cycleDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return frFirst(new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))));
}
