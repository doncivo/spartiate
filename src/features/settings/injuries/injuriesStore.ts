import type { Repositories } from '../../../db/repositories/dataAccess';
import { legacyInjuriesResidue, parseInjuries, type InjuriesValue } from '../../../domain/training/injuries';
import { logFailure } from '../../../platform/desktop/log';

type InjuryDeps = Pick<Repositories, 'settings' | 'injuries'>;

/**
 * Gênes déclarées (BLESSURES ; SYNC-0291, BL-120, D-447, D-465) : table PUBLIÉE `injury`. Reprise UNIQUE de l'ancien réglage LOCAL `training.injuries` à
 * la première lecture : ses gênes sont insérées (jamais au-dessus d'une ligne existante), PUIS le réglage est remis à null ; une reprise interrompue se
 * rejoue sans doublon. Lecture ou écriture en échec : l'erreur remonte (l'écran garde son état et n'écrit rien), rien n'est perdu.
 */
export async function loadInjuries(repos: InjuryDeps): Promise<InjuriesValue> {
  const injuries = await repos.injuries();
  const legacy = await repos.settings.get('training.injuries');
  if (legacy !== null && legacy !== undefined) {
    const { failedIds } = await injuries.importLocal(parseInjuries(legacy).items);
    // Contre-relecture (D-469) : le réglage ne garde que les gênes NON reprises (vidé si tout l'est) ; code journalisé une fois, à l'écriture du reste.
    const rest = legacyInjuriesResidue(legacy, failedIds);
    if (JSON.stringify(rest) !== JSON.stringify(legacy)) {
      await repos.settings.set('training.injuries', rest);
      if (rest !== null) logFailure('injuries', 'injuries-legacy-kept');
    }
  }
  return injuries.read();
}

/**
 * Écrit les seules gênes changées entre deux valeurs (règles pures du domaine : `declareInjury`, `markHealed`, `recordCheckin` rendent une valeur neuve
 * et gardent la même référence pour une gêne inchangée) ; jamais la liste entière : l'autre appareil peut avoir écrit entre-temps.
 */
export async function saveInjuries(repos: Pick<Repositories, 'injuries'>, before: InjuriesValue, after: InjuriesValue): Promise<void> {
  const repo = await repos.injuries();
  const previous = new Map(before.items.map((i) => [i.id, i]));
  // Relecture 1 (point 1, D-468) : chaque gêne est écrite depuis la valeur montrée (`before`), jamais depuis la ligne en base.
  for (const injury of after.items) {
    const seen = previous.get(injury.id);
    if (seen !== injury) await repo.save(injury, seen);
  }
}
