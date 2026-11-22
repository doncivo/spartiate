import type { Repositories } from '../../db/repositories/dataAccess';
import { legacyExclusionsResidue, parseExcludedExercises } from '../../domain/training/exclusions';
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
    const { failedIds } = await exclusions.importLocal(parseExcludedExercises(legacy));
    // Contre-relecture (D-469) : le réglage ne garde que les éléments NON repris (vidé si tout l'est) ; code journalisé une fois, à l'écriture du reste.
    const rest = legacyExclusionsResidue(legacy, failedIds);
    if (JSON.stringify(rest) !== JSON.stringify(legacy)) {
      await repos.settings.set('training.excludedExercises', rest);
      if (rest !== null) logFailure('training', 'exclusions-legacy-kept');
    }
  }
  return exclusions.list();
}

/** Écarte ou remet un seul exercice (jamais la liste entière : l'autre appareil peut avoir écrit entre-temps). */
export async function writeExcluded(repos: Pick<Repositories, 'exerciseExclusions'>, exerciseId: string, excluded: boolean): Promise<void> {
  await (await repos.exerciseExclusions()).setExcluded(exerciseId, excluded);
}
