import { parseSyntheticTimer, SYNTHETIC_TIMER_MS, timerPhase, timerRemainingMs, type SyntheticTimerState, type TimerPhase } from '../../domain/syntheticTimer';
import type { LiveActivity, LiveActivityNativeError, LiveActivityReason } from '../../platform/liveActivity';

/**
 * Contrôleur du minuteur synthétique de 60 s (SPA-007). Sans React : l'écran n'en est que l'affichage.
 * - la date de fin est persistée (réglage local) ; le temps restant est recalculé depuis elle à chaque lecture ;
 * - une notification locale est programmée à l'échéance, avec un identifiant fixe (jamais de doublon après une reprise) ;
 * - sur iPhone, la Live Activity démarre si elle est disponible ; sinon le repli (minuteur dans l'app + notification) est expliqué ;
 * - l'arrêt et l'échéance ferment l'activité et effacent la date (aucune activité orpheline) ;
 * - sur PC : minuteur dans l'app seulement, aucune notification système.
 */

export type TimerNotifierPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** Notification de l'échéance (adaptateur iOS dans `platform/notifications/timerNotification.ts`, vide ailleurs). */
export interface TimerNotifier {
  permission(): Promise<TimerNotifierPermission>;
  requestPermission(): Promise<TimerNotifierPermission>;
  /** Vrai si la notification du minuteur est encore en attente dans iOS. */
  isPending(): Promise<boolean>;
  /** Programme (ou remplace) la notification à `endMs` ; faux = échec. */
  schedule(input: { readonly endMs: number; readonly title: string; readonly body: string }): Promise<boolean>;
  cancel(): Promise<void>;
}

export interface TimerStore {
  read(): Promise<unknown>;
  write(value: SyntheticTimerState | null): Promise<void>;
}

export interface SyntheticTimerDeps {
  readonly clock: { nowMs(): number };
  readonly store: TimerStore;
  readonly liveActivity: LiveActivity;
  readonly notifier: TimerNotifier;
  readonly os: 'ios' | 'other';
  readonly label: string;
  readonly notification: { readonly title: string; readonly body: string };
}

export type NotificationOutcome = 'scheduled' | 'denied' | 'unavailable' | 'failed';
export type LiveOutcome = 'started' | 'unavailable' | 'failed' | 'unsupported';

export interface TimerStartReport {
  readonly state: SyntheticTimerState;
  readonly notification: NotificationOutcome;
  readonly live: LiveOutcome;
  readonly liveReason?: LiveActivityReason | 'failed';
  readonly liveError?: LiveActivityNativeError | null;
}

export interface TimerResume {
  readonly phase: TimerPhase;
  readonly state: SyntheticTimerState | null;
  readonly remainingMs: number;
}

export interface TimerStopReport {
  readonly notificationCancelled: boolean;
  readonly liveEnded: boolean;
}

export interface SyntheticTimer {
  start(): Promise<TimerStartReport>;
  /** Relit la date persistée, rétablit la notification et la Live Activity si besoin, ou termine proprement après l'échéance. */
  resume(): Promise<TimerResume>;
  stop(): Promise<TimerStopReport>;
}

export function createSyntheticTimer(deps: SyntheticTimerDeps): SyntheticTimer {
  const { clock, store, liveActivity, notifier, os } = deps;

  const read = async (): Promise<SyntheticTimerState | null> => parseSyntheticTimer(await store.read());

  async function notify(state: SyntheticTimerState, onlyIfMissing: boolean): Promise<NotificationOutcome> {
    let permission = await notifier.permission();
    if (permission === 'undetermined') permission = await notifier.requestPermission();
    if (permission === 'unavailable') return 'unavailable';
    if (permission !== 'granted') return 'denied';
    if (onlyIfMissing && (await notifier.isPending())) return 'scheduled';
    return (await notifier.schedule({ endMs: state.endMs, title: deps.notification.title, body: deps.notification.body })) ? 'scheduled' : 'failed';
  }

  async function startLive(state: SyntheticTimerState): Promise<Pick<TimerStartReport, 'live' | 'liveReason' | 'liveError'>> {
    if (os !== 'ios') return { live: 'unsupported' };
    const availability = await liveActivity.isAvailable();
    if (!availability.available) return { live: 'unavailable', liveReason: availability.reason, liveError: availability.error };
    const started = await liveActivity.start({ endDateMs: state.endMs, label: state.label });
    return started.started ? { live: 'started' } : { live: 'failed', liveReason: started.reason, liveError: started.error };
  }

  return {
    async start() {
      // Déjà en cours : on reprend la même échéance, jamais une seconde.
      const running = await read();
      const existing = running !== null && timerPhase(running, clock.nowMs()) === 'running' ? running : null;
      const state = existing ?? { endMs: clock.nowMs() + SYNTHETIC_TIMER_MS, label: deps.label };
      if (existing === null) await store.write(state);
      const notification = await notify(state, existing !== null);
      const live = await startLive(state);
      return { state, notification, ...live };
    },

    async resume() {
      const state = await read();
      const now = clock.nowMs();
      const phase = timerPhase(state, now);
      if (state === null || phase === 'idle') return { phase: 'idle', state: null, remainingMs: 0 };
      if (phase === 'finished') {
        // Échéance passée pendant que l'app était fermée : l'activité est fermée ici (elle ne peut pas l'être sans l'app), la date effacée.
        if (os === 'ios') await liveActivity.end();
        await store.write(null);
        return { phase: 'finished', state: null, remainingMs: 0 };
      }
      await notify(state, true);
      if (os === 'ios') await startLive(state);
      return { phase: 'running', state, remainingMs: timerRemainingMs(state, now) };
    },

    async stop() {
      let notificationCancelled = true;
      let liveEnded = true;
      try {
        await notifier.cancel();
      } catch {
        notificationCancelled = false;
      }
      if (os === 'ios') liveEnded = (await liveActivity.end()).ended;
      await store.write(null);
      return { notificationCancelled, liveEnded };
    },
  };
}
