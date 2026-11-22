import type { Repositories } from '../../../db/repositories/dataAccess';
import { legacyInjuriesComplete, parseInjuries, type InjuriesValue } from '../../../domain/training/injuries';
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
    const { failed } = await injuries.importLocal(parseInjuries(legacy).items);
    // Relecture 1 (point 4) : le réglage n'est vidé que si TOUT ce qu'il portait est repris ; sinon il est gardé et un code est journalisé.
    if (failed === 0 && legacyInjuriesComplete(legacy)) await repos.settings.set('training.injuries', null);
    else logFailure('injuries', 'injuries-legacy-kept');
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
