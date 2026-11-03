// SPA-002 : updater rétabli. Adaptateur réel (plugins simulés) : appelle le plugin ; l'état non configuré (D-30) reste couvert par un
// DesktopPlatform synthétique : zéro appel au plugin et zéro minuterie.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import type { DesktopPlatform } from '../../platform';
import { createFakeDesktop } from '../../platform/desktop/testing';
import { openTestDb } from '../../db/repositories/sql/testSetup';

const check = vi.fn(async () => null);
vi.mock('@tauri-apps/api/app', () => ({ getVersion: async () => '0.1.0' }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-autostart', () => ({ isEnabled: async () => false, enable: async () => undefined, disable: async () => undefined }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: async () => undefined }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: async () => undefined }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: () => check() }));

const { createTauriDesktop } = await import('../../platform/desktop/tauriDesktop');
const { createAppContainer } = await import('../app/container');
const { startUpdateChecks } = await import('./updateChecks');
const { updaterStore } = await import('./updaterStore');

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000d4');

describe('updater configuré (SPA-002) et état non configuré (D-30)', () => {
  const containerWith = async (desktop: DesktopPlatform) => {
    const db = await openTestDb(DEVICE);
    const container = createAppContainer({
      clock: db.clock,
      hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }),
      data: db.data,
      desktop,
    });
    return { db, container };
  };

  it('l’adaptateur réel se déclare configuré et appelle le plugin', async () => {
    check.mockClear();
    const desktop = createTauriDesktop();
    expect(desktop.updaterConfigured).toBe(true);
    const { db, container } = await containerWith(desktop);
    await expect(updaterStore.get(container).getState().check()).resolves.toBe('ok');
    expect(check).toHaveBeenCalledTimes(1);
    expect(updaterStore.get(container).getState().status).toBe('upToDate');
    await db.close();
  });

  it('non configuré (DesktopPlatform synthétique) : zéro appel et zéro minuterie', async () => {
    check.mockClear();
    const desktop = createFakeDesktop();
    desktop.updaterConfigured = false;
    const { db, container } = await containerWith(desktop);
    await expect(updaterStore.get(container).getState().check()).resolves.toBe('ok');
    expect(updaterStore.get(container).getState().status).toBe('notConfigured');
    const timers = { setTimeout: vi.fn(() => 1), clearTimeout: vi.fn(), setInterval: vi.fn(() => 2), clearInterval: vi.fn() };
    const checks = startUpdateChecks(container, timers);
    await checks.tick();
    checks.dispose();
    expect(timers.setTimeout).not.toHaveBeenCalled();
    expect(timers.setInterval).not.toHaveBeenCalled();
    expect(desktop.checks).toBe(0);
    expect(check).not.toHaveBeenCalled();
    await db.close();
  });

  it('un seul appelant de checkForUpdate dans src, protégé par updaterConfigured', () => {
    const store = readFileSync(new URL('./updaterStore.ts', import.meta.url), 'utf8');
    const guard = store.indexOf('if (!desktop.updaterConfigured)');
    const call = store.indexOf('desktop.checkForUpdate()');
    expect(guard).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(guard);
  });
});
