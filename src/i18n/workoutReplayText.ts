import { formatTime } from './format';
import { workoutReplayFr } from './fr.workoutReplay';

/** Textes du déroulé série par série, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type WorkoutReplayTextKey = keyof typeof workoutReplayFr;

export function tReplay(key: WorkoutReplayTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = workoutReplayFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Heure de validation (heure locale) par le formateur d'heure unique (P-03) : « 18:42 » sur 24 h. */
export const formatReplayTime = (iso: string): string => {
  const date = new Date(iso);
  return formatTime(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`);
};
