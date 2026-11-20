import { DEFAULT_PROGRESSION_CONFIG } from '../../../domain/training/config';
import { entryImplausible, entryOutlier, plausibilityClass, type EntryImplausible, type EntryOutlier } from '../../../domain/training/outlierEntry';
import type { SetEntry, SetKind, WorkoutSet } from '../../../domain/training/session';
import type { Exercise } from '../../../domain/training/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { logFailure } from '../../../platform/desktop/log';
import { bodyweightNow } from './prescriptionContext';

/**
 * Question posée avant d'écrire une série (FIX-ABERR) : `relative`, charge > 150 % de l'habituelle (`assisted` : la charge saisie est une
 * assistance) ; `plausible`, première séance de l'exercice, charge au-delà du plafond de son type (décision d'Ali du 20/11).
 */
export type OutlierAsk = (EntryOutlier & { readonly check: 'relative'; readonly assisted: boolean }) | (EntryImplausible & { readonly check: 'plausible' });

/** Métriques dont la série porte une charge saisie (lest ou assistance pour le poids du corps). */
const LOADED_METRICS: ReadonlySet<string> = new Set(['load-reps', 'bodyweight-reps']);

/**
 * FIX-ABERR (C-005, § 11.5) : contrôle d'une série de travail saisie, avant son écriture. Chargé à la demande par la séance active (import
 * dynamique au premier contrôle). Historique : séances closes de l'exercice (`progression.history`, comme la prescription). Avec un
 * historique : contrôle relatif ; sans : vraisemblance par type d'exercice et poids de corps (`perDumbbell` : charge saisie par haltère).
 * Une lecture en échec ne bloque jamais la saisie : la série est écrite sans contrôle (bornes absolues seules) et l'échec est journalisé
 * par un code fixe.
 */
export async function checkOutlier(access: DataAccess, exercise: Exercise | undefined, set: WorkoutSet, entry: SetEntry, kind: SetKind, sessionSets: readonly WorkoutSet[], perDumbbell = false): Promise<OutlierAsk | null> {
  if (kind !== 'work' || (exercise !== undefined && !LOADED_METRICS.has(exercise.metric))) return null;
  const assisted = exercise?.equipment.includes('assisted-pull-up-machine') === true;
  // Charges déjà validées dans la séance pour cet exercice (une question par charge).
  const done = sessionSets.filter((s) => s.exerciseId === set.exerciseId && s.id !== set.id && s.done && s.setKind === 'work' && s.loadKg !== null).map((s) => s.loadKg as number);
  // Relatif : la plus lourde (la plus faible assistance pour un assisté) ; vraisemblance : la plus forte saisie (assistance comprise).
  const doneInSessionKg = done.length === 0 ? null : assisted ? Math.min(...done) : Math.max(...done);
  const doneMaxKg = done.length === 0 ? null : Math.max(...done);
  try {
    const history = await (await access.repos.progression()).history(set.exerciseId);
    const fraction = exercise?.bodyweightFraction ?? null;
    const bodyweightKg = await bodyweightNow(access);
    const found = entryOutlier(entry, kind, history, { config: DEFAULT_PROGRESSION_CONFIG, bodyweightKg, bodyweightFraction: fraction, assisted, doneInSessionKg });
    if (found !== null) return { ...found, check: 'relative', assisted };
    if (exercise === undefined) return null;
    const implausible = entryImplausible(entry, kind, history, { exerciseClass: plausibilityClass(exercise), bodyweightKg, bodyweightFraction: fraction, perDumbbell, doneInSessionKg: doneMaxKg });
    return implausible === null ? null : { ...implausible, check: 'plausible' };
  } catch {
    logFailure('training', 'outlier-check-failed');
    return null;
  }
}
