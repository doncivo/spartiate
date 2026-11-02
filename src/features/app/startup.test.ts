import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../../domain/clock';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { useAppStore } from './appStore';
import { createAppContainer } from './container';
import { startAppStartup, type StartupEnv } from './startup';

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-000000000008');

function fakeEnv(extra: Partial<StartupEnv> = {}) {
  const handlers = new Map<string, () => void>();
  const add = vi.fn((type: string, h: () => void) => void handlers.set(type, h));
  const remove = vi.fn((type: string) => void handlers.delete(type));
  const doc = { addEventListener: add, removeEventListener: remove, visibilityState: 'visible' as DocumentVisibilityState };
  const env = { document: doc, window: { addEventListener: add, removeEventListener: remove } } as unknown as StartupEnv;
  Object.assign(env, extra);
  return { env, handlers };
}

describe('startAppStartup (fuseau et sauvegarde quotidienne)', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await openTestDb(DEVICE, new Date(2026, 8, 23, 12).getTime());
  });
  afterEach(async () => {
    useAppStore.setState({ timeZone: null });
    await db.close();
  });
  const container = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: createManualClock(0), deviceId: DEVICE }), data: db.data });

  it('fuseau lu au démarrage, écouteurs visibilitychange et focus posés puis retirés', async () => {
    const { env, handlers } = fakeEnv();
    const startup = startAppStartup(container(), env);
    expect([...handlers.keys()].sort()).toEqual(['focus', 'visibilitychange']);
    await startup.ready;
    expect(useAppStore.getState().timeZone).not.toBeUndefined();
    startup.dispose();
    startup.dispose();
    expect(handlers.size).toBe(0);
  });

  it('T-11 : fuseau publié au démarrage ; un changement au retour au premier plan met à jour le réglage et notifie', async () => {
    let zone = 'Europe/Paris';
    const changes: unknown[] = [];
    const { env, handlers } = fakeEnv({ detectTimeZone: () => zone, onTimeZoneChange: (c) => void changes.push(c) });
    const startup = startAppStartup(container(), env);
    await startup.ready;
    expect(useAppStore.getState().timeZone).toBe('Europe/Paris');
    expect(await db.data.repos.settings.get('general.timeZone')).toBe('Europe/Paris');
    zone = 'Africa/Tunis';
    handlers.get('focus')?.();
    await vi.waitFor(() => expect(useAppStore.getState().timeZone).toBe('Africa/Tunis'));
    expect(await db.data.repos.settings.get('general.timeZone')).toBe('Africa/Tunis');
    expect(changes).toEqual([{ previous: 'Europe/Paris', current: 'Africa/Tunis' }]);
    startup.dispose();
  });
});
