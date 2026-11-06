import { describe, expect, it } from 'vitest';
import { createManualClock } from '../../domain/clock';
import type { SyntheticTimerState } from '../../domain/syntheticTimer';
import type { LiveActivity, LiveActivityAvailability, LiveActivityEnd, LiveActivityStart } from '../../platform/liveActivity';
import { createSyntheticTimer, type TimerNotifier, type TimerNotifierPermission } from './syntheticTimer';

/**
 * SPA-007 lot D : minuteur synthétique de 60 s (Plus › À propos et diagnostic). Date de fin persistée ; temps restant recalculé depuis elle ;
 * notification locale à l'échéance sans doublon après une reprise ; Live Activity si disponible, sinon repli expliqué ; arrêt sans orpheline.
 * Horloge contrôlée, aucune minuterie réelle.
 */
const T0 = '2026-11-06T10:00:00.000Z';
const NOW = Date.parse(T0);

interface RigOptions {
  os?: 'ios' | 'other';
  permission?: TimerNotifierPermission;
  afterRequest?: TimerNotifierPermission;
  live?: Partial<LiveActivity>;
  availability?: LiveActivityAvailability;
  pending?: boolean;
  scheduleOk?: boolean;
}

function rig(options: RigOptions = {}) {
  const clock = createManualClock(T0);
  let saved: unknown = null;
  const log: string[] = [];
  const scheduled: { endMs: number; title: string }[] = [];
  let permission: TimerNotifierPermission = options.permission ?? 'granted';
  const notifier: TimerNotifier = {
    permission: async () => permission,
    requestPermission: async () => {
      log.push('request-permission');
      permission = options.afterRequest ?? 'granted';
      return permission;
    },
    isPending: async () => options.pending ?? false,
    schedule: async ({ endMs, title }) => {
      scheduled.push({ endMs, title });
      return options.scheduleOk ?? true;
    },
    cancel: async () => void log.push('cancel-notification'),
  };
  const liveCalls: string[] = [];
  const liveStarts: { endDateMs: number; label: string; finishedLabel?: string }[] = [];
  const liveActivity: LiveActivity = {
    isAvailable: async () => {
      liveCalls.push('isAvailable');
      return options.availability ?? { available: true };
    },
    start: async (input): Promise<LiveActivityStart> => {
      liveCalls.push('start');
      liveStarts.push(input);
      return { started: true };
    },
    end: async (): Promise<LiveActivityEnd> => {
      liveCalls.push('end');
      return { ended: true, count: 1 };
    },
    ...options.live,
  };
  const make = () =>
    createSyntheticTimer({
      clock,
      store: { read: async () => saved, write: async (value) => void (saved = value) },
      liveActivity,
      notifier,
      os: options.os ?? 'ios',
      label: 'Minuteur de test',
      finishedLabel: 'Terminé',
      notification: { title: 'Minuteur terminé', body: 'Les 60 secondes sont écoulées.' },
    });
  return { clock, make, notifier, log, scheduled, liveCalls, liveStarts, saved: () => saved as SyntheticTimerState | null };
}

describe('démarrage', () => {
  it('persiste la date de fin (maintenant + 60 s), programme UNE notification à l’échéance et démarre la Live Activity', async () => {
    const r = rig();
    const report = await r.make().start();
    expect(r.saved()).toEqual({ endMs: NOW + 60_000, label: 'Minuteur de test' });
    expect(r.scheduled).toEqual([{ endMs: NOW + 60_000, title: 'Minuteur terminé' }]);
    expect(r.liveStarts).toEqual([{ endDateMs: NOW + 60_000, label: 'Minuteur de test', finishedLabel: 'Terminé' }]);
    expect(report).toMatchObject({ notification: 'scheduled', live: 'started' });
  });

  it('démarrer deux fois de suite ne crée ni deuxième date ni deuxième échéance', async () => {
    const r = rig();
    const timer = r.make();
    await timer.start();
    r.clock.advance(10_000);
    await timer.start();
    expect(r.saved()?.endMs).toBe(NOW + 60_000);
    expect(new Set(r.scheduled.map((s) => s.endMs)).size).toBe(1);
    expect(new Set(r.liveStarts.map((s) => s.endDateMs)).size).toBe(1);
  });
});

describe('reprise après une fermeture ou un passage en arrière-plan', () => {
  it('le temps restant vient de la date persistée, pas d’un compteur : 30 s plus tard, nouvelle instance, il reste 30 s', async () => {
    const r = rig();
    await r.make().start();
    r.clock.advance(30_000);
    const resumed = await r.make().resume();
    expect(resumed.phase).toBe('running');
    expect(resumed.state?.endMs).toBe(NOW + 60_000);
    expect(resumed.remainingMs).toBe(30_000);
  });

  it('notification plus en attente (iOS l’a perdue) : reprogrammée à la MÊME échéance ; encore en attente : rien de plus', async () => {
    const lost = rig({ pending: false });
    await lost.make().start();
    lost.clock.advance(20_000);
    await lost.make().resume();
    expect(lost.scheduled.map((s) => s.endMs)).toEqual([NOW + 60_000, NOW + 60_000]);

    const kept = rig({ pending: true });
    await kept.make().start();
    kept.clock.advance(20_000);
    await kept.make().resume();
    await kept.make().resume();
    expect(kept.scheduled).toHaveLength(1);
  });

  it('la Live Activity est redemandée avec la même date de fin (le plugin garde celle qui existe)', async () => {
    const r = rig();
    await r.make().start();
    r.clock.advance(15_000);
    await r.make().resume();
    expect(new Set(r.liveStarts.map((s) => s.endDateMs))).toEqual(new Set([NOW + 60_000]));
  });

  it('après l’échéance : l’activité est fermée, la date effacée, phase « finished » ; rien n’est reprogrammé', async () => {
    const r = rig();
    await r.make().start();
    r.liveCalls.length = 0;
    r.clock.advance(61_000);
    const resumed = await r.make().resume();
    expect(resumed.phase).toBe('finished');
    expect(r.liveCalls).toContain('end');
    expect(r.saved()).toBeNull();
    expect(r.scheduled).toHaveLength(1);
    expect((await r.make().resume()).phase).toBe('idle');
  });

  it('sans minuteur : idle, aucun appel', async () => {
    const r = rig();
    expect((await r.make().resume()).phase).toBe('idle');
    expect(r.liveCalls).toEqual([]);
    expect(r.scheduled).toEqual([]);
  });
});

describe('arrêt', () => {
  it('annule la notification, ferme la Live Activity (immédiatement) et efface la date', async () => {
    const r = rig();
    const timer = r.make();
    await timer.start();
    r.liveCalls.length = 0;
    const report = await timer.stop();
    expect(r.log).toContain('cancel-notification');
    expect(r.liveCalls).toEqual(['end']);
    expect(r.saved()).toBeNull();
    expect(report).toEqual({ notificationCancelled: true, liveEnded: true });
    expect((await timer.resume()).phase).toBe('idle');
  });

  it('un échec de fermeture est dit, la date est tout de même effacée', async () => {
    const r = rig({ live: { end: async () => ({ ended: false, error: null }) } });
    const timer = r.make();
    await timer.start();
    const report = await timer.stop();
    expect(report.liveEnded).toBe(false);
    expect(r.saved()).toBeNull();
  });
});

describe('notifications refusées ou indisponibles', () => {
  it('refusées : le minuteur tourne, aucune notification n’est programmée ni promise', async () => {
    const r = rig({ permission: 'denied' });
    const report = await r.make().start();
    expect(report.notification).toBe('denied');
    expect(r.scheduled).toEqual([]);
    expect(r.log).not.toContain('request-permission');
    expect(r.saved()).not.toBeNull();
  });

  it('non encore décidées : la permission est demandée ; refusée à la demande : « denied »', async () => {
    const r = rig({ permission: 'undetermined', afterRequest: 'denied' });
    const report = await r.make().start();
    expect(r.log).toContain('request-permission');
    expect(report.notification).toBe('denied');
    expect(r.scheduled).toEqual([]);
  });

  it('accordées à la demande : programmées', async () => {
    const r = rig({ permission: 'undetermined', afterRequest: 'granted' });
    expect((await r.make().start()).notification).toBe('scheduled');
  });

  it('programmation en échec : « failed », dit, jamais « scheduled »', async () => {
    const r = rig({ scheduleOk: false });
    expect((await r.make().start()).notification).toBe('failed');
  });
});

describe('Live Activity indisponible : repli', () => {
  it('désactivée : motif rendu, la notification et le minuteur dans l’app restent', async () => {
    const r = rig({ availability: { available: false, reason: 'disabled', error: null } });
    const report = await r.make().start();
    expect(report).toMatchObject({ live: 'unavailable', liveReason: 'disabled', notification: 'scheduled' });
    expect(r.liveStarts).toEqual([]);
  });

  it('démarrage en échec : l’erreur native d’ActivityKit est rendue telle quelle', async () => {
    const native = { domain: 'com.apple.ActivityKit.ActivityInput', code: 4, description: 'Target does not include NSSupportsLiveActivities plist key' };
    const r = rig({ live: { start: async () => ({ started: false, reason: 'failed', error: native }) } });
    expect(await r.make().start()).toMatchObject({ live: 'failed', liveError: native });
  });
});

describe('PC', () => {
  it('minuteur dans l’app seulement : aucun appel à la Live Activity, notification indisponible sans erreur', async () => {
    const r = rig({ os: 'other', permission: 'unavailable' });
    const report = await r.make().start();
    expect(r.liveCalls).toEqual([]);
    expect(report).toMatchObject({ live: 'unsupported', notification: 'unavailable' });
    expect(r.scheduled).toEqual([]);
    expect(r.saved()).not.toBeNull();
  });
});
