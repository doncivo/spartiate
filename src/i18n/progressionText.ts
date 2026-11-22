import { progressionFr } from './fr.progression';

/** Textes de la prescription (I2-01) ; importé seulement par le composant à la demande `ExerciseProgression`. */
export type ProgressionTextKey = keyof typeof progressionFr;

export function tProgression(key: ProgressionTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = progressionFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/**
 * SEANCE-0291 revue (BL-106) : texte d'une note du moteur (`explanationNotes`), paramètre de charge `load` écrit à la française et en paire
 * d'haltères (« 2 × 22,5 kg ») quand l'exercice se fait avec deux haltères (`held` = 2) ; les autres paramètres tels quels.
 */
export function progressionNoteText(note: { readonly key: ProgressionTextKey; readonly params: Readonly<Record<string, number>> }, held: 1 | 2 | null): string {
  const params: Record<string, string | number> = { ...note.params };
  const load = note.params['load'];
  if (typeof load === 'number') params['load'] = tProgression(held === 2 ? 'loadPair' : 'loadSingle', { load: String(load).replace('.', ',') });
  return tProgression(note.key, params);
}
