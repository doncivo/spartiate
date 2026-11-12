import { workoutReplayFr } from './fr.workoutReplay';

/** Textes du déroulé série par série, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type WorkoutReplayTextKey = keyof typeof workoutReplayFr;

export function tReplay(key: WorkoutReplayTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = workoutReplayFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/** Heure de validation sur 24 h, à la seconde (heure locale) : « 18:42:05 ». */
export const formatReplayTime = (iso: string): string => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
