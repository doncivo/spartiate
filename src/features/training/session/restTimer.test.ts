import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity, LiveActivityAvailability, LiveActivityStartInput } from '../../../platform/liveActivity';
import type { TimerNotifier, TimerNotifierPermission } from '../../../platform/notifications/timerNotification';
import { createRestTimer } from './restTimer';

/**
 * I1-02 (critère 4) : contrôleur du minuteur de repos, horloge contrôlée, base SQLite réelle. L'échéance est celle du repository (date de
 * fin persistée dans `workout`) ; le temps restant en est toujours recalculé ; notification locale à identifiant fixe (aucun doublon à la
 * reprise) ; Live Activity sur iPhone, fermée à « Passer », à l'échéance et à l'arrêt ; PC : rien de système.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000d4' as DeviceId;
const TEXTS = { label: 'Repos', finishedLabel: 'Terminé', notificationTitle: 'Repos terminé', notificationBody: 'Passe à la série suivante.' };
let db: TestDb;

function fakes(options: { permission?: TimerNotifierPermission; availability?: LiveActivityAvailability; pending?: boolean } = {}) {
  const scheduled: { endMs: number; title: string }[] = [];
  const calls = { permission: 0, cancel: 0, starts: [] as LiveActivityStartInput[], ends: 0 };
  const notifier: TimerNotifier = {
    permission: async () => (calls.permission++, options.permission ?? 'granted'),
    requestPermission: async () => options.permission ?? 'granted',
    isPending: async () => options.pending ?? scheduled.length > 0,
    schedule: async ({ endMs, title }) => (scheduled.push({ endMs, title }), true),
    cancel: async () => void calls.cancel++,
  };
  const liveActivity: LiveActivity = {
    isAvailable: async () => options.availability ?? { available: true },
    start: async (input) => (calls.starts.push(input), { started: true }),
    end: async () => (calls.ends++, { ended: true, count: 1 }),
  };
  return { notifier, liveActivity, scheduled, calls };
}

const timer = (f: ReturnType<typeof fakes>, os: 'ios' | 'other' = 'ios') =>
  createRestTimer({ clock: db.clock, store: () => db.data.repos.workouts(), liveActivity: f.liveActivity, notifier: f.notifier, os, texts: TEXTS });

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await db.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'empty' }));
});
afterEach(async () => db.close());

describe('minuteur de repos', () => {
  it('start : échéance persistée, notification « Repos terminé » à l’échéance, Live Activity « Repos »', async () => {
    const f = fakes();
    const report = await timer(f).start(150);
    const endMs = Date.parse('2026-11-09T17:02:30.000Z');
    expect(Date.parse(report.endAt)).toBe(endMs);
    expect(report).toMatchObject({ notification: 'scheduled', live: 'started' });
    expect((await (await db.data.repos.workouts()).getRest())?.endAt).toBe(report.endAt);
    expect(f.scheduled).toEqual([{ endMs, title: 'Repos terminé' }]);
    expect(f.calls.starts).toEqual([{ endDateMs: endMs, label: 'Repos', finishedLabel: 'Terminé' }]);
  });

  it('resume après « verrouillage » : reste recalculé depuis la date de fin, aucune seconde notification', async () => {
    const f = fakes();
    await timer(f).start(150);
    db.clock.advance(100_000);
    const resumed = await timer(f).resume();
    expect(resumed).toMatchObject({ phase: 'running', remainingMs: 50_000 });
    expect(f.scheduled).toHaveLength(1);
  });

  it('resume après l’échéance : repos terminé proprement (date effacée, activité fermée)', async () => {
    const f = fakes();
    await timer(f).start(60);
    db.clock.advance(61_000);
    expect(await timer(f).resume()).toEqual({ phase: 'finished' });
    expect(await (await db.data.repos.workouts()).getRest()).toBeNull();
    expect(f.calls.ends).toBe(1);
    expect(await timer(f).resume()).toEqual({ phase: 'idle' });
  });

  it('+30 s : échéance repoussée, notification reprogrammée, Live Activity mise à jour', async () => {
    const f = fakes();
    const first = await timer(f).start(60);
    const extended = await timer(f).extend();
    expect(Date.parse(extended.endAt) - Date.parse(first.endAt)).toBe(30_000);
    expect(extended.seconds).toBe(90);
    expect(f.scheduled.map((s) => s.endMs)).toEqual([Date.parse(first.endAt), Date.parse(extended.endAt)]);
    expect(f.calls.starts.at(-1)?.endDateMs).toBe(Date.parse(extended.endAt));
  });

  it('Passer : date effacée, notification annulée, activité fermée', async () => {
    const f = fakes();
    await timer(f).start(60);
    await timer(f).skip();
    expect(await (await db.data.repos.workouts()).getRest()).toBeNull();
    expect(f.calls.cancel).toBeGreaterThanOrEqual(1);
    expect(f.calls.ends).toBe(1);
  });

  it('notifications refusées : rien n’est programmé, le rapport le dit', async () => {
    const f = fakes({ permission: 'denied' });
    expect((await timer(f).start(60)).notification).toBe('denied');
    expect(f.scheduled).toEqual([]);
  });

  it('Live Activity indisponible : repli dans l’app, la raison est rapportée', async () => {
    const f = fakes({ availability: { available: false, reason: 'disabled', error: null } });
    const report = await timer(f).start(60);
    expect(report).toMatchObject({ live: 'unavailable', liveReason: 'disabled', notification: 'scheduled' });
    expect(f.calls.starts).toEqual([]);
  });

  it('PC : aucune notification ni Live Activity, l’échéance reste persistée', async () => {
    const f = fakes({ permission: 'unavailable' });
    const report = await timer(f, 'other').start(60);
    expect(report).toMatchObject({ notification: 'unavailable', live: 'unsupported' });
    expect(f.calls.permission).toBe(0);
    expect(f.scheduled).toEqual([]);
    expect(f.calls.starts).toEqual([]);
    await timer(f, 'other').skip();
    expect(f.calls.ends).toBe(0);
    expect(await (await db.data.repos.workouts()).getRest()).toBeNull();
  });

  it('stop (abandon) : notification annulée et activité fermée', async () => {
    const f = fakes();
    await timer(f).start(60);
    await timer(f).stop();
    expect(f.calls.cancel).toBeGreaterThanOrEqual(1);
    expect(f.calls.ends).toBe(1);
  });
});
