import { ACTIONS_BY_CATEGORY, EMPTY_ACTION_QUEUE, parseActionQueue, type NotificationActionQueueV1 } from '../../domain/notificationActions';
import { intakesToTake, receiveSupplementActions, settleSupplementAction, SUPPLEMENT_ACTION_TYPE_ID, supplementActionTodo } from '../../domain/supplementNotificationActions';
import type { SettingsRepository } from '../../db/repositories/settingsRepository';
import type { SupplementRepository } from '../../db/repositories/supplementRepository';
import type { NotificationActionSource } from '../../platform/notifications';

/**
 * Action « Pris » de la notification de complément sur l'iPhone (FIX-0221, D-250 à D-253, révise D-213 ; ADR 0012 avenant N-03).
 *
 * Mode retenu : ARRIÈRE-PLAN. L'action est enregistrée sans premier plan : iOS réveille l'app sans l'ouvrir, le plugin Swift `notification-actions`
 * écrit l'action dans son fichier durable (app tuée comprise) puis réveille la WebView si elle tourne. L'app applique l'action au passage suivant :
 * réveil du plugin, ouverture, retour au premier plan. Un passage :
 *   1. `drain` (le fichier n'est pas vidé) ;
 *   2. inscription dans la file LOCALE `notifications.actionQueue` (clé = identifiant de la notification, action, échéance livrée : une ligne relue
 *      ou une deuxième action sur la même notification n'est jamais inscrite deux fois) ;
 *   3. pour chaque entrée : les prises dues à ce jour et à cette heure, encore à cocher, sont cochées par `SupplementRepository.setTaken` — le
 *      MÊME chemin que la carte d'Aujourd'hui (tampon HLC, capture de synchro, publication) ; l'identifiant naturel de la prise écarte un doublon ;
 *   4. file enregistrée, PUIS `ack` : une coupure avant `ack` rejoue la ligne, écartée par la clé appliquée.
 * Aucune méthode ne rejette ; un échec est signalé (`onTrouble` : bandeau bref) et journalisé par code, jamais par un nom de complément.
 */
export interface SupplementActionDeps {
  readonly source: NotificationActionSource;
  readonly settings: Pick<SettingsRepository, 'get' | 'set'>;
  readonly supplements: () => Promise<Pick<SupplementRepository, 'list' | 'intakes' | 'setTaken'>>;
  readonly nowMs: () => number;
  /** Titre du bouton et texte d'écran verrouillé (`src/i18n/fr.supplementNotifications.ts`). */
  readonly texts: { readonly action: string; readonly placeholder: string };
  /** Prises cochées par ce passage (au moins une) : confirmation visible, relecture des écrans, replanification. */
  readonly onTaken: (count: number) => void;
  /** `failed` : une action n'a pas pu être appliquée (rejouée au passage suivant) ; `lost` : lignes illisibles ou non écrites par le natif. */
  readonly onTrouble: (kind: 'failed' | 'lost') => void;
  readonly log: (code: string) => void;
}

export type SupplementActionStatus = 'done' | 'source-failed' | 'queue-failed' | 'ack-failed';

export interface SupplementActionRun {
  readonly status: SupplementActionStatus;
  /** Prises cochées. */
  readonly taken: number;
  /** Actions appliquées (une action peut ne rien cocher : tout était déjà coché). */
  readonly applied: number;
  readonly duplicates: number;
  readonly failed: number;
}

export interface SupplementActionProcessor {
  /** Enregistre la catégorie « complément » (à chaque démarrage, avant le premier tirage). */
  register(): Promise<boolean>;
  run(): Promise<SupplementActionRun>;
}

const QUEUE_KEY = 'notifications.actionQueue';

export function createSupplementActionProcessor(deps: SupplementActionDeps): SupplementActionProcessor {
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = chain.then(task, task);
    chain = next.catch(() => undefined);
    return next;
  };

  async function readQueue(): Promise<NotificationActionQueueV1> {
    const read = parseActionQueue(await deps.settings.get(QUEUE_KEY));
    if (read.state === 'valid') return read.queue;
    // File illisible : repartie de zéro (signalé) ; l'identifiant naturel de la prise écarte tout doublon en base.
    deps.log('supplement-action-queue-unreadable');
    return EMPTY_ACTION_QUEUE;
  }

  async function pass(): Promise<SupplementActionRun> {
    const result = { taken: 0, applied: 0, duplicates: 0, failed: 0 };
    let drained;
    try {
      drained = await deps.source.drain();
    } catch {
      deps.log('supplement-action-source-failed');
      return { status: 'source-failed', ...result };
    }
    let queue: NotificationActionQueueV1;
    try {
      queue = await readQueue();
    } catch {
      deps.log('supplement-action-queue-failed');
      return { status: 'queue-failed', ...result };
    }
    const lostBefore = queue.lost;
    const received = receiveSupplementActions(queue, drained.entries, drained.unreadable + drained.writeFailures, deps.nowMs());
    queue = received.queue;
    result.duplicates = received.duplicates;
    if (received.ignored > 0) deps.log('supplement-action-ignored');

    for (const { entry, day, moment } of supplementActionTodo(queue)) {
      try {
        const repo = await deps.supplements();
        const [supplements, intakes] = await Promise.all([repo.list(), repo.intakes(day, day)]);
        for (const id of intakesToTake(supplements, intakes, day, moment)) {
          await repo.setTaken(id, day, moment, true);
          result.taken += 1;
        }
        queue = settleSupplementAction(queue, entry.key, 'applied', deps.nowMs());
        result.applied += 1;
      } catch {
        queue = settleSupplementAction(queue, entry.key, 'apply-failed', deps.nowMs());
        result.failed += 1;
        deps.log('supplement-action-apply-failed');
      }
    }
    const lost = queue.lost > lostBefore;
    // Les pertes sont dites une fois (bandeau) ; le compteur n'est pas gardé au-delà.
    if (lost) queue = { ...queue, lost: 0 };

    try {
      await deps.settings.set(QUEUE_KEY, queue);
    } catch {
      deps.log('supplement-action-queue-failed');
      if (result.taken > 0) deps.onTaken(result.taken);
      return { status: 'queue-failed', ...result };
    }
    let status: SupplementActionStatus = 'done';
    if (drained.lines > 0 || drained.writeFailures > 0) {
      try {
        await deps.source.ack({ lines: drained.lines, writeFailures: drained.writeFailures });
      } catch {
        deps.log('supplement-action-ack-failed');
        status = 'ack-failed';
      }
    }
    if (result.taken > 0) deps.onTaken(result.taken);
    if (result.failed > 0) deps.onTrouble('failed');
    if (lost) {
      deps.log('supplement-action-lost');
      deps.onTrouble('lost');
    }
    return { status, ...result };
  }

  return {
    register: async () => {
      try {
        await deps.source.registerActionTypes([
          {
            id: SUPPLEMENT_ACTION_TYPE_ID,
            actions: ACTIONS_BY_CATEGORY.supplement.map((id) => ({ id, title: deps.texts.action, foreground: false })),
            hiddenPreviewsBodyPlaceholder: deps.texts.placeholder,
          },
        ]);
        return true;
      } catch {
        deps.log('supplement-action-register-failed');
        return false;
      }
    },
    run: () => serial(pass),
  };
}

export interface SupplementActionWakeEnv {
  readonly document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  /** Source du plugin ; `null` hors iPhone (le PC n'a ni notification ni action). */
  readonly source: NotificationActionSource | null;
  readonly makeProcessor: (source: NotificationActionSource) => SupplementActionProcessor;
}

/**
 * Déclencheurs : enregistrement de la catégorie puis tirage à l'ouverture, à chaque retour au premier plan et à chaque réveil du plugin (une action
 * vient d'être écrite). Hors iPhone : rien. Rend la fonction d'arrêt.
 */
export function startSupplementActions(env: SupplementActionWakeEnv): () => void {
  const { source } = env;
  if (source === null) return () => undefined;
  const processor = env.makeProcessor(source);
  let stopped = false;
  let offWake: (() => void) | null = null;
  const run = (): void => {
    if (!stopped) void processor.run().catch(() => undefined);
  };
  const onVisible = (): void => {
    if (env.document.visibilityState !== 'hidden') run();
  };
  env.document.addEventListener('visibilitychange', onVisible);
  void processor
    .register()
    .catch(() => false)
    .then(run);
  void source.onWake(run).then(
    (off) => {
      if (stopped) off();
      else offWake = off;
    },
    () => undefined,
  );
  return () => {
    stopped = true;
    env.document.removeEventListener('visibilitychange', onVisible);
    offWake?.();
  };
}
