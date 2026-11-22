import type { Repositories } from '../../db/repositories/dataAccess';
import { legacyExclusionsComplete, parseExcludedExercises } from '../../domain/training/exclusions';
import { logFailure } from '../../platform/desktop/log';

type ExclusionDeps = Pick<Repositories, 'settings' | 'exerciseExclusions'>;

/**
 * Exercices écartés (SESS-01b ; SYNC-0291, BL-109, D-447, D-465) : table PUBLIÉE `exercise_exclusion`. Reprise UNIQUE de l'ancien réglage LOCAL
 * `training.excludedExercises` à la première lecture : ses identifiants sont insérés (jamais au-dessus d'une ligne existante), PUIS le réglage est
 * remis à null ; une reprise interrompue se rejoue sans doublon. Lecture ou écriture en échec : l'erreur remonte (l'écran garde « aucun écarté »
 * et n'écrit rien), rien n'est perdu.
 */
export async function loadExcludedExercises(repos: ExclusionDeps): Promise<readonly string[]> {
  const exclusions = await repos.exerciseExclusions();
  const legacy = await repos.settings.get('training.excludedExercises');
  if (legacy !== null && legacy !== undefined) {
    const { failed } = await exclusions.importLocal(parseExcludedExercises(legacy));
    // Relecture 1 (point 4) : le réglage n'est vidé que si TOUT ce qu'il portait est repris ; sinon il est gardé et un code est journalisé.
    if (failed === 0 && legacyExclusionsComplete(legacy)) await repos.settings.set('training.excludedExercises', null);
    else logFailure('training', 'exclusions-legacy-kept');
  }
  return exclusions.list();
}

/** Écarte ou remet un seul exercice (jamais la liste entière : l'autre appareil peut avoir écrit entre-temps). */
export async function writeExcluded(repos: Pick<Repositories, 'exerciseExclusions'>, exerciseId: string, excluded: boolean): Promise<void> {
  await (await repos.exerciseExclusions()).setExcluded(exerciseId, excluded);
}
