import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createManualClock } from '../../domain/clock';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { createFakeDesktop, type FakeDesktop } from '../../platform/desktop/testing';
import { createAppContainer, type AppContainer } from './container';
import { clearRestBadge, restBadgeTitle, setRestBadge } from './restBadge';

/**
 * BL-118 (D-399, COQUILLE-PC, D-596) : le minuteur de repos s'affiche dans le titre de la fenêtre PC (« Repos 1:23 · Spartiate »), recalculé depuis
 * l'échéance chaque seconde, rendu au titre simple à la fin. Hors PC : rien. Module chargé avec la séance, jamais dans le départ.
 */
const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000d7');
const START = '2026-11-25T10:00:00.000Z';

describe('badge du minuteur de repos dans le titre de la fenêtre PC (BL-118)', () => {
  let db: TestDb;
  let desktop: FakeDesktop;
  let warn: MockInstance;
  let clock = createManualClock(START);
  let container: AppContainer;

  beforeEach(async () => {
    vi.useFakeTimers();
    clock = createManualClock(START);
    db = await openTestDb(DEVICE);
    desktop = createFakeDesktop();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    container = createAppContainer({ clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, desktop });
  });
  afterEach(async () => {
    clearRestBadge(container);
    vi.useRealTimers();
    vi.restoreAllMocks();
    await db.close();
  });

  it('titre : minutes et secondes sans zéro de tête sur les minutes, nom de l’app en dernier', () => {
    expect(restBadgeTitle(83_000)).toBe('Repos 1:23 · Spartiate');
    expect(restBadgeTitle(5_000)).toBe('Repos 0:05 · Spartiate');
    expect(restBadgeTitle(600_000)).toBe('Repos 10:00 · Spartiate');
    expect(restBadgeTitle(400)).toBe('Repos 0:01 · Spartiate');
  });

  it('une échéance donne le titre de la fenêtre, qui décroît chaque seconde puis revient à « Spartiate »', async () => {
    setRestBadge(container, Date.parse(START) + 83_000);
    await vi.waitFor(() => expect(desktop.windowTitle).toBe('Repos 1:23 · Spartiate'));
    clock.advance(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(desktop.windowTitle).toBe('Repos 1:22 · Spartiate');
    clock.advance(82_000);
    await vi.advanceTimersByTimeAsync(82_000);
    expect(desktop.windowTitle).toBe('Spartiate');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('« Passer » (null) remet le titre simple aussitôt et coupe la minuterie', async () => {
    setRestBadge(container, Date.parse(START) + 120_000);
    await vi.waitFor(() => expect(desktop.windowTitle).toBe('Repos 2:00 · Spartiate'));
    setRestBadge(container, null);
    await vi.waitFor(() => expect(desktop.windowTitle).toBe('Spartiate'));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('hors PC : aucun effet', () => {
    const web = createAppContainer({ clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    expect(() => setRestBadge(web, Date.parse(START) + 60_000)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('un échec du titre est journalisé sans interrompre l’app', async () => {
    desktop.setWindowTitle = () => Promise.reject(new Error('fenêtre absente'));
    setRestBadge(container, Date.parse(START) + 60_000);
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining('fenêtre absente')));
  });
});
