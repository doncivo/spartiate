// SPA-001a, D-30 : le plugin updater n'est pas initialisé côté Rust, donc aucun chemin d'exécution ne doit l'appeler tant que SPA-002 ne
// l'a pas rétabli. Adaptateur Tauri réel (plugins simulés) : `check` et `downloadAndInstall` ne sont jamais appelés.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
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

describe('updater non initialisé : aucun appel au plugin (D-30)', () => {
  it('l’adaptateur réel se déclare non configuré', () => {
    expect(createTauriDesktop().updaterConfigured).toBe(false);
  });

  it('vérification directe et planification : le plugin n’est jamais appelé', async () => {
    const db = await openTestDb(DEVICE);
    const container = createAppContainer({
      clock: db.clock,
      hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }),
      data: db.data,
      desktop: createTauriDesktop(),
    });
    await expect(updaterStore.get(container).getState().check()).resolves.toBe('ok');
    expect(updaterStore.get(container).getState().status).toBe('notConfigured');
    const timers = { setTimeout: vi.fn(() => 1), clearTimeout: vi.fn(), setInterval: vi.fn(() => 2), clearInterval: vi.fn() };
    const checks = startUpdateChecks(container, timers);
    await checks.tick();
    checks.dispose();
    expect(timers.setTimeout).not.toHaveBeenCalled();
    expect(timers.setInterval).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
    await db.close();
  });

  it('un seul appelant de checkForUpdate dans src, protégé par updaterConfigured', () => {
    const store = readFileSync(new URL('./updaterStore.ts', import.meta.url), 'utf8');
    const guard = store.indexOf('if (!desktop.updaterConfigured)');
    const call = store.indexOf('desktop.checkForUpdate()');
    expect(guard).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(guard);
    const adapter = readFileSync(new URL('../../platform/desktop/tauriDesktop.ts', import.meta.url), 'utf8');
    expect(adapter).toContain('updaterConfigured: false');
  });
});
