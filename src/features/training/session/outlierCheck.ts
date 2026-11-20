import { DEFAULT_PROGRESSION_CONFIG } from '../../../domain/training/config';
import { entryOutlier, type EntryOutlier } from '../../../domain/training/outlierEntry';
import type { SetEntry, SetKind, WorkoutSet } from '../../../domain/training/session';
import type { Exercise } from '../../../domain/training/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { logFailure } from '../../../platform/desktop/log';
import { bodyweightNow } from './prescriptionContext';

/** Question posée avant d'écrire une série aberrante (FIX-ABERR) ; `assisted` : la charge saisie est une assistance. */
export interface OutlierAsk extends EntryOutlier {
  readonly assisted: boolean;
}

/**
 * FIX-ABERR (C-005, § 11.5) : contrôle d'une série de travail saisie, avant son écriture. Chargé à la demande par la séance active (import
 * dynamique au premier contrôle). Historique : séances closes de l'exercice (`progression.history`, comme la prescription) ; poids de corps
 * lu seulement pour un exercice au poids du corps. Une lecture en échec ne bloque jamais la saisie : la série est écrite sans contrôle relatif
 * (bornes absolues seules) et l'échec est journalisé par un code fixe.
 */
export async function checkOutlier(access: DataAccess, exercise: Exercise | undefined, set: WorkoutSet, entry: SetEntry, kind: SetKind, sessionSets: readonly WorkoutSet[]): Promise<OutlierAsk | null> {
  if (kind !== 'work' || (exercise !== undefined && exercise.metric !== 'load-reps')) return null;
  const assisted = exercise?.equipment.includes('assisted-pull-up-machine') === true;
  // Charge déjà validée dans la séance pour cet exercice : la plus lourde (la plus faible assistance pour un assisté).
  const done = sessionSets.filter((s) => s.exerciseId === set.exerciseId && s.id !== set.id && s.done && s.setKind === 'work' && s.loadKg !== null).map((s) => s.loadKg as number);
  const doneInSessionKg = done.length === 0 ? null : assisted ? Math.min(...done) : Math.max(...done);
  try {
    const history = await (await access.repos.progression()).history(set.exerciseId);
    const fraction = exercise?.bodyweightFraction ?? null;
    const bodyweightKg = fraction !== null && fraction > 0 ? await bodyweightNow(access) : null;
    const found = entryOutlier(entry, kind, history, { config: DEFAULT_PROGRESSION_CONFIG, bodyweightKg, bodyweightFraction: fraction, assisted, doneInSessionKg });
    return found === null ? null : { ...found, assisted };
  } catch {
    logFailure('training', 'outlier-check-failed');
    return null;
  }
}
