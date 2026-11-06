import { restRemainingMs } from '../../../domain/training';
import type { RestTimer, WorkoutRepository } from '../../../db/repositories/workoutRepository';
import type { LiveActivity, LiveActivityNativeError, LiveActivityReason } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';

/**
 * Contrôleur du minuteur de repos de la séance active (I1-02, § 13.3, critère 4). Sans React : l'écran n'en est que l'affichage.
 * - l'échéance est la date de fin persistée par le repository (`workout.rest_timer_end_at`) ; le temps restant en est TOUJOURS recalculé ;
 * - iPhone : notification locale à l'échéance (identifiant fixe de `timerNotification`, jamais de doublon à la reprise) et Live Activity
 *   si elle est disponible ; sinon le repli (minuteur dans l'app + notification) est rapporté pour être expliqué ;
 * - « Passer », l'échéance et l'abandon ferment l'activité (aucune activité orpheline) ;
 * - PC : minuteur dans l'app seulement, aucune notification système ni demande d'autorisation.
 */

export type RestStore = Pick<WorkoutRepository, 'startRest' | 'extendRest' | 'skipRest' | 'getRest'>;

export interface RestTimerDeps {
  readonly clock: { nowMs(): number };
  readonly store: () => Promise<RestStore>;
  readonly liveActivity: LiveActivity;
  readonly notifier: TimerNotifier;
  readonly os: 'ios' | 'other';
  readonly texts: { readonly label: string; readonly finishedLabel: string; readonly notificationTitle: string; readonly notificationBody: string };
}

export type RestNotificationOutcome = 'scheduled' | 'denied' | 'unavailable' | 'failed';
export type RestLiveOutcome = 'started' | 'unavailable' | 'failed' | 'unsupported';

export interface RestReport extends RestTimer {
  readonly notification: RestNotificationOutcome;
  readonly live: RestLiveOutcome;
  readonly liveReason?: LiveActivityReason | 'failed';
  readonly liveError?: LiveActivityNativeError | null;
}

export type RestResume =
  | { readonly phase: 'idle' }
  | { readonly phase: 'finished' }
  | (RestReport & { readonly phase: 'running'; readonly remainingMs: number });

export interface RestTimerController {
  start(seconds: number): Promise<RestReport>;
  /** « +30 s » par défaut. */
  extend(seconds?: number): Promise<RestReport>;
  /** « Passer ». */
  skip(): Promise<void>;
  /** Relit l'échéance (montage, retour au premier plan, tic d'affichage) ; échue : repos terminé proprement. */
  resume(): Promise<RestResume>;
  /** Abandon de la séance : notification annulée, activité fermée (l'échéance est effacée par `discard`). */
  stop(): Promise<void>;
}

export function createRestTimer(deps: RestTimerDeps): RestTimerController {
  const { clock, store, liveActivity, notifier, os, texts } = deps;
  const ios = os === 'ios';

  async function notify(endMs: number, onlyIfMissing: boolean): Promise<RestNotificationOutcome> {
    if (!ios) return 'unavailable';
    let permission = await notifier.permission();
    if (permission === 'undetermined') permission = await notifier.requestPermission();
    if (permission === 'unavailable') return 'unavailable';
    if (permission !== 'granted') return 'denied';
    if (onlyIfMissing && (await notifier.isPending())) return 'scheduled';
    return (await notifier.schedule({ endMs, title: texts.notificationTitle, body: texts.notificationBody })) ? 'scheduled' : 'failed';
  }

  async function startLive(endMs: number): Promise<Pick<RestReport, 'live' | 'liveReason' | 'liveError'>> {
    if (!ios) return { live: 'unsupported' };
    const availability = await liveActivity.isAvailable();
    if (!availability.available) return { live: 'unavailable', liveReason: availability.reason, liveError: availability.error };
    const started = await liveActivity.start({ endDateMs: endMs, label: texts.label, finishedLabel: texts.finishedLabel });
    return started.started ? { live: 'started' } : { live: 'failed', liveReason: started.reason, liveError: started.error };
  }

  async function closeSystem(): Promise<void> {
    if (!ios) return;
    try {
      await notifier.cancel();
    } catch {
      // Annulation impossible : la notification sonnera peut-être pour rien ; rien d'autre à faire ici.
    }
    await liveActivity.end();
  }

  async function publish(rest: RestTimer, onlyIfMissing: boolean): Promise<RestReport> {
    const endMs = Date.parse(rest.endAt);
    const notification = await notify(endMs, onlyIfMissing);
    const live = await startLive(endMs);
    return { ...rest, notification, ...live };
  }

  return {
    async start(seconds) {
      const rest = await (await store()).startRest({ seconds });
      return publish(rest, false);
    },

    async extend(seconds) {
      const rest = await (await store()).extendRest(seconds);
      return publish(rest, false);
    },

    async skip() {
      await (await store()).skipRest();
      await closeSystem();
    },

    async resume() {
      const repo = await store();
      const rest = await repo.getRest();
      if (rest === null) return { phase: 'idle' };
      const remainingMs = restRemainingMs(rest.endAt, clock.nowMs());
      if (remainingMs === 0) {
        // Échéance passée (app fermée ou verrouillée) : l'activité est fermée ici, la date effacée ; la notification a déjà sonné.
        await repo.skipRest();
        if (ios) await liveActivity.end();
        return { phase: 'finished' };
      }
      return { ...(await publish(rest, true)), phase: 'running', remainingMs };
    },

    async stop() {
      await closeSystem();
    },
  };
}
