import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createManualClock } from '../../domain/clock';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { createFakeDesktop, type FakeDesktop } from '../../platform/desktop/testing';
import { createAppContainer } from './container';
import { restBadgeTitle, setRestBadge, startDesktopIntegration } from './desktop';

/**
 * BL-118 (D-399, COQUILLE-PC) : le minuteur de repos s'affiche dans le titre de la fenêtre PC (« Repos 1:23 · Spartiate »), recalculé depuis
 * l'échéance chaque seconde, rendu au titre simple à la fin. Hors PC : rien.
 */
const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000d7');
const START = '2026-11-25T10:00:00.000Z';

describe('badge du minuteur de repos dans le titre de la fenêtre PC (BL-118)', () => {
  let db: TestDb;
  let desktop: FakeDesktop;
  let warn: MockInstance;
  let clock = createManualClock(START);

  beforeEach(async () => {
    vi.useFakeTimers();
    clock = createManualClock(START);
    db = await openTestDb(DEVICE);
    desktop = createFakeDesktop();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    setRestBadge(null);
    vi.useRealTimers();
    vi.restoreAllMocks();
    await db.close();
  });

  const start = () =>
    startDesktopIntegration(createAppContainer({ clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, desktop }));

  it('titre : minutes et secondes sans zéro de tête sur les minutes, nom de l’app en dernier', () => {
    expect(restBadgeTitle(83_000)).toBe('Repos 1:23 · Spartiate');
    expect(restBadgeTitle(5_000)).toBe('Repos 0:05 · Spartiate');
    expect(restBadgeTitle(600_000)).toBe('Repos 10:00 · Spartiate');
    expect(restBadgeTitle(400)).toBe('Repos 0:01 · Spartiate');
  });

  it('une échéance donne le titre de la fenêtre, qui décroît chaque seconde puis revient à « Spartiate »', async () => {
    const integration = start();
    setRestBadge(Date.parse(START) + 83_000);
    await vi.waitFor(() => expect(desktop.windowTitle).toBe('Repos 1:23 · Spartiate'));
    clock.advance(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(desktop.windowTitle).toBe('Repos 1:22 · Spartiate');
    clock.advance(82_000);
    await vi.advanceTimersByTimeAsync(82_000);
    expect(desktop.windowTitle).toBe('Spartiate');
    integration.dispose();
  });

  it('« Passer » (null) remet le titre simple aussitôt ; dispose le remet aussi et coupe la minuterie', async () => {
    const integration = start();
    setRestBadge(Date.parse(START) + 120_000);
    await vi.waitFor(() => expect(desktop.windowTitle).toBe('Repos 2:00 · Spartiate'));
    setRestBadge(null);
    await vi.waitFor(() => expect(desktop.windowTitle).toBe('Spartiate'));
    setRestBadge(Date.parse(START) + 120_000);
    await vi.waitFor(() => expect(desktop.windowTitle).toBe('Repos 2:00 · Spartiate'));
    integration.dispose();
    await vi.waitFor(() => expect(desktop.windowTitle).toBe('Spartiate'));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('un échec du titre est journalisé sans interrompre l’app', async () => {
    desktop.setWindowTitle = () => Promise.reject(new Error('fenêtre absente'));
    const integration = start();
    setRestBadge(Date.parse(START) + 60_000);
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining('fenêtre absente')));
    integration.dispose();
  });
});
