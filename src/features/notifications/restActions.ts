import { RepositoryError } from '../../db/repositories/common';
import { decideRestAction, REST_ACTION_EXTEND_SEC, REST_ACTION_TYPE_ID, restActionKey, type RawRestAction } from '../../domain/restNotificationActions';
import { restNotificationsFr as fr } from '../../i18n/fr.restNotifications';
import type { ActionTypeSpec } from '../../platform/notifications';
import type { RestTimerController } from '../training/session/restTimer';

/**
 * Actions « +30 s » et « Passer » de la notification de fin de repos (SHELL-0294b, § 13.3 b, BL-108, D-541 (4), D-599). Appelé par le
 * répartiteur des actions de notification, avec les actions de repos d'un tirage du fichier natif :
 * - la décision est celle de `decideRestAction` (repos annoncé seulement, cinq minutes au plus après l'échéance) ;
 * - « +30 s » passe par le contrôleur du minuteur de repos (`extend(30)`) : échéance persistée, notification et Live Activity republiées ;
 *   « Passer » par `skip` (repos annoncé encore persisté) ou `stop` (déjà effacé : fermeture de la Live Activity et de la notification) ;
 * - l'écran de séance ouvert est prévenu (`onChanged`) ; une action ignorée parce qu'elle arrive trop tard ou sans séance est dite par un
 *   bandeau bref, toutes sont journalisées par code ;
 * - une même action n'est appliquée qu'une fois (clé gardée en mémoire) ; une écriture en échec rend `false` (le répartiteur n'acquitte pas,
 *   l'action est rejouée), au troisième échec elle est abandonnée, dite et journalisée.
 */
export interface RestActionDeps {
  /** Échéance du repos persistée (ms), null sans repos ou sans séance ouverte. */
  readonly restEndMs: () => Promise<number | null>;
  /** Contrôleur du minuteur de repos (chargé à la demande). */
  readonly controller: () => Promise<Pick<RestTimerController, 'extend' | 'skip' | 'stop'>>;
  readonly nowMs: () => number;
  /** Le repos a changé : l'écran de séance relit l'échéance. */
  readonly onChanged: () => void;
  /** Bandeau bref (texte de `src/i18n`). */
  readonly notice: (text: string) => void;
  readonly log: (code: string) => void;
}

/** Nombre d'échecs d'écriture après lequel une action est abandonnée (dite et journalisée) pour que le fichier natif soit acquitté. */
const MAX_TRIES = 3;
/** Clés retenues en mémoire (les plus anciennes sortent d'abord). */
const MAX_KEYS = 50;

/** Catégorie `sp.rest` : « +30 s » et « Passer », au premier plan (l'app s'ouvre et applique aussitôt, D-599). */
export function restActionTypes(): readonly ActionTypeSpec[] {
  return [
    {
      id: REST_ACTION_TYPE_ID,
      actions: [
        { id: 'extend30', title: fr.actionExtend, foreground: true },
        { id: 'skip', title: fr.actionSkip, foreground: true },
      ],
    },
  ];
}

export function createRestActionHandler(deps: RestActionDeps): (actions: readonly RawRestAction[]) => Promise<boolean> {
  const settled: string[] = [];
  const tries = new Map<string, number>();
  const settle = (key: string): void => {
    tries.delete(key);
    settled.push(key);
    if (settled.length > MAX_KEYS) settled.splice(0, settled.length - MAX_KEYS);
  };

  async function apply(action: RawRestAction): Promise<boolean> {
    const key = restActionKey(action);
    if (settled.includes(key)) return true;
    try {
      const decision = decideRestAction(action, await deps.restEndMs(), deps.nowMs());
      if (decision.kind === 'ignore') {
        deps.log(`rest-action-ignored-${decision.reason}`);
        if (decision.reason === 'late') deps.notice(fr.noticeLate);
        settle(key);
        return true;
      }
      const controller = await deps.controller();
      if (decision.kind === 'extend') await controller.extend(REST_ACTION_EXTEND_SEC);
      else if (decision.running) await controller.skip();
      else await controller.stop();
      settle(key);
      deps.onChanged();
      return true;
    } catch (error) {
      if (error instanceof RepositoryError && error.code === 'not-found') {
        // Aucune séance ouverte : rien à prolonger.
        deps.log('rest-action-ignored-no-session');
        deps.notice(fr.noticeNoSession);
        settle(key);
        return true;
      }
      const count = (tries.get(key) ?? 0) + 1;
      if (count >= MAX_TRIES) {
        deps.log('rest-action-dropped');
        deps.notice(fr.noticeFailed);
        settle(key);
        return true;
      }
      tries.set(key, count);
      deps.log('rest-action-failed');
      return false;
    }
  }

  return async (actions) => {
    let ok = true;
    for (const action of actions) if (!(await apply(action))) ok = false;
    return ok;
  };
}
