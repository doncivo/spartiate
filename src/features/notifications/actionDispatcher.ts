import type { RawRestAction } from '../../domain/notificationActions';
import type { ActionDrain, ActionTypeSpec, NotificationActionSource } from '../../platform/notifications';
import type { SupplementActionProcessor, SupplementActionRun } from './supplementActions';

/**
 * Répartiteur unique des actions de notification (SHELL-0294b, § 13.3 b, D-541 (1), D-599). Le fichier natif du plugin `notification-actions`
 * n'a qu'un lecteur : ce répartiteur. Un passage :
 *   1. un seul `drain` ;
 *   2. les actions de repos (« +30 s », « Passer ») vont au gestionnaire du repos ;
 *   3. le processeur des compléments reçoit une VUE de la source : son `drain` rend le même tirage sans les actions de repos ;
 *   4. son `ack` (après l'écriture de sa file locale, comme avant) est le seul acquittement du fichier, et seulement si le gestionnaire du repos
 *      a tout réglé : sinon rien n'est acquitté et tout est rejoué au passage suivant (les compléments écartent leurs doublons par leurs clés
 *      appliquées, le repos par les siennes). Un acquittement impossible remonte au processeur des compléments (« ack-failed », état durable).
 * L'enregistrement des catégories se fait en UN appel (iOS remplace toutes les catégories à chaque enregistrement) : compléments, puis repos.
 * Les passages sont sérialisés. Rend l'interface du processeur des compléments, pour garder ses déclencheurs (`startSupplementActions`).
 */
export interface ActionDispatcherDeps {
  readonly source: NotificationActionSource;
  readonly supplement: (view: NotificationActionSource) => SupplementActionProcessor;
  /** Rend vrai si toutes les actions sont réglées (appliquées ou ignorées), faux s'il faut les rejouer. */
  readonly rest: (actions: readonly RawRestAction[]) => Promise<boolean>;
  readonly restTypes: readonly ActionTypeSpec[];
  readonly log: (code: string) => void;
}

export function createActionDispatcher(deps: ActionDispatcherDeps): SupplementActionProcessor {
  const { source } = deps;
  /** Tirage du passage en cours (null hors passage, ou tirage impossible). */
  let snapshot: ActionDrain | null = null;
  /** Le gestionnaire du repos a réglé toutes les actions de repos du tirage en cours. */
  let restSettled = true;
  let supplementTypes: readonly ActionTypeSpec[] = [];

  const view: NotificationActionSource = {
    registerActionTypes: async (types) => {
      supplementTypes = types;
    },
    drain: async () => {
      // Tirage impossible : le processeur des compléments le traite comme avant (« source-failed »). Erreur simple, sans la classe de la
      // plateforme : l'importer ajouterait un bloc aux listes de préchargement du départ (D-604).
      if (snapshot === null) throw new Error('notification-action-source-failed');
      return { entries: snapshot.entries, rest: [], lines: snapshot.lines, unreadable: snapshot.unreadable, writeFailures: snapshot.writeFailures };
    },
    ack: async (done) => {
      if (!restSettled) {
        deps.log('rest-action-retry');
        return;
      }
      await source.ack(done);
    },
    status: () => source.status(),
    onWake: (listener) => source.onWake(listener),
  };
  const supplement = deps.supplement(view);

  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = chain.then(task, task);
    chain = next.catch(() => undefined);
    return next;
  };

  async function pass(): Promise<SupplementActionRun> {
    snapshot = null;
    restSettled = true;
    try {
      snapshot = await source.drain();
    } catch {
      snapshot = null;
    }
    const restActions = snapshot?.rest ?? [];
    if (restActions.length > 0) {
      try {
        restSettled = await deps.rest(restActions);
      } catch {
        restSettled = false;
      }
    }
    try {
      return await supplement.run();
    } finally {
      snapshot = null;
      restSettled = true;
    }
  }

  return {
    register: async () => {
      await supplement.register();
      try {
        await source.registerActionTypes([...supplementTypes, ...deps.restTypes]);
        return true;
      } catch {
        deps.log('notification-action-register-failed');
        return false;
      }
    },
    run: () => serial(pass),
  };
}
