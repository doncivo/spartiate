import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier, TimerNotifierPermission } from '../../../platform/notifications/timerNotification';
import { createRestTimer } from './restTimer';

/**
 * SEANCE-0292 (§ 10.3) : l'autorisation des notifications est demandée à la fin de la première séance, pas au premier repos. Avant elle, le
 * repos reste visible dans l'app (mode dégradé du § 10.3), aucune demande système.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000d9' as DeviceId;
const TEXTS = { label: 'Repos', finishedLabel: 'Terminé', notificationTitle: 'Repos terminé', notificationBody: 'Passe à la série suivante.' };
let db: TestDb;

function fakes(permission: TimerNotifierPermission) {
  const calls = { request: 0, schedule: 0 };
  const notifier: TimerNotifier = {
    permission: async () => permission,
    requestPermission: async () => (calls.request++, 'granted'),
    isPending: async () => false,
    schedule: async () => (calls.schedule++, true),
    cancel: async () => undefined,
  };
  const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };
  return { notifier, liveActivity, calls };
}

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await db.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'empty' }));
});
afterEach(async () => db.close());

describe('§ 10.3 : autorisation des notifications', () => {
  it('autorisation pas encore décidée : le premier repos ne la demande pas, aucune notification ; le repos reste dans l’app', async () => {
    const f = fakes('undetermined');
    const report = await createRestTimer({ clock: db.clock, store: () => db.data.repos.workouts(), liveActivity: f.liveActivity, notifier: f.notifier, os: 'ios', texts: TEXTS }).start(90);
    expect(f.calls.request).toBe(0);
    expect(f.calls.schedule).toBe(0);
    expect(report.notification).toBe('undetermined');
  });

  it('autorisation accordée : notification programmée comme avant', async () => {
    const f = fakes('granted');
    const report = await createRestTimer({ clock: db.clock, store: () => db.data.repos.workouts(), liveActivity: f.liveActivity, notifier: f.notifier, os: 'ios', texts: TEXTS }).start(90);
    expect(report.notification).toBe('scheduled');
    expect(f.calls.request).toBe(0);
  });
});
