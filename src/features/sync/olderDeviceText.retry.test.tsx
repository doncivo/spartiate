import { act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId, type IsoDateTime } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { t } from '../../i18n';
import { useAppStatusStore } from '../app/appStatus';
import { createAppContainer, type AppContainer } from '../app/container';
import { startSyncIntegration } from './startSync';
import { createFakeSyncService, type FakeSyncService } from './testKit';

/**
 * SYNC-01, revue 1 (M5) : le texte « appareil plus ancien » vient d'un bloc à la demande. Si son chargement échoue, le bandeau montre le
 * texte générique (jamais muet), et le chargement est retenté au retour de l'avertissement : le repli ne reste pas affiché toute la session.
 */

const load = vi.hoisted(() => ({ fail: true }));
vi.mock('../../i18n/syncOlderDeviceText', async () => {
  if (load.fail) throw new Error('bloc indisponible');
  const { syncOlderDeviceFr } = await import('../../i18n/fr.syncOlderDevice');
  return { olderDeviceText: () => syncOlderDeviceFr.banner };
});

const SELF = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000f2');
const NOW = '2026-11-15T08:02:00.000Z';
const TEXT = 'Un appareil utilise une version plus ancienne. Mets-le à jour.';
const timers = { setInterval: () => 0, clearInterval: () => undefined, setTimeout: () => 0, clearTimeout: () => undefined };

let db: TestDb;
let container: AppContainer;
let sync: FakeSyncService;

beforeEach(async () => {
  db = await openTestDb(SELF, NOW);
  sync = createFakeSyncService({ phase: 'idle', lastSyncAt: '2026-11-15T08:00:00.000Z' as IsoDateTime, folderLabel: 'Spartiate', folderKind: 'icloud' });
  container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: SELF }), data: db.data, sync });
});

afterEach(async () => {
  cleanup();
  useAppStatusStore.setState({ sources: {} });
  await db.close();
});

/** Signal sûr, sans délai : résolu au premier message du bandeau `syncTrouble` égal à `expected` (déjà posé compris). */
function bannerMessage(expected: string): Promise<void> {
  return new Promise((resolve) => {
    const done = (): boolean => useAppStatusStore.getState().sources.syncTrouble?.message === expected;
    if (done()) return resolve();
    const stop = useAppStatusStore.subscribe(() => {
      if (!done()) return;
      stop();
      resolve();
    });
  });
}

describe('SYNC-01 revue 1 : chargement du texte « appareil plus ancien » en échec', () => {
  it('texte générique, puis le vrai texte au retour de l’avertissement une fois le bloc disponible', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sync.setStatus({ warnings: ['older-device'] });
    const integration = startSyncIntegration(container, timers);
    await integration.refreshed();
    await act(() => bannerMessage(t('sync.status.errorGeneric')));
    expect(useAppStatusStore.getState().sources.syncTrouble?.message).toBe(t('sync.status.errorGeneric'));
    load.fail = false;
    act(() => {
      sync.setStatus({ warnings: [] });
    });
    expect(useAppStatusStore.getState().sources.syncTrouble).toBeFalsy();
    act(() => {
      sync.setStatus({ warnings: ['older-device'] });
    });
    await act(() => bannerMessage(TEXT));
    expect(useAppStatusStore.getState().sources.syncTrouble?.message).toBe(TEXT);
    integration.dispose();
  });
});
