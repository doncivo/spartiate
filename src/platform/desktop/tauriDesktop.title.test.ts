import { beforeEach, describe, expect, it, vi } from 'vitest';

/** BL-118 : le titre de la fenêtre principale passe par l'API fenêtre de Tauri (permission `core:window:allow-set-title`). */
const setTitle = vi.fn(async (_title: string) => undefined);
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ setTitle }) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-autostart', () => ({ enable: vi.fn(), disable: vi.fn(), isEnabled: vi.fn() }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('../relaunch', () => ({ relaunchApp: vi.fn() }));
vi.mock('../appVersion', () => ({ readAppVersion: vi.fn() }));

import { createTauriDesktop } from './tauriDesktop';

describe('titre de la fenêtre (BL-118)', () => {
  beforeEach(() => setTitle.mockClear());

  it('setWindowTitle écrit le titre de la fenêtre courante', async () => {
    await createTauriDesktop().setWindowTitle('Repos 1:23 · Spartiate');
    expect(setTitle).toHaveBeenCalledWith('Repos 1:23 · Spartiate');
  });
});
