import type { Repositories } from '../../../db/repositories/dataAccess';
import { parseInjuries, type InjuriesValue } from '../../../domain/training/injuries';

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
    await injuries.importLocal(parseInjuries(legacy).items);
    await repos.settings.set('training.injuries', null);
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
  for (const injury of after.items) if (previous.get(injury.id) !== injury) await repo.save(injury);
}
