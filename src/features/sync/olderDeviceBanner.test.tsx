import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { SYNC_TROUBLE_ORDER, syncBannerFor } from '../../domain/syncBanners';
import { asEntityId, type DeviceId, type IsoDateTime } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { t } from '../../i18n';
import type { SyncDeviceStatus, SyncStatus } from '../../platform/sync/types';
import { AppContainerProvider } from '../app/AppContainerContext';
import { useAppStatusStore } from '../app/appStatus';
import { createAppContainer, type AppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { SyncDetailsScreen } from './SyncDetailsScreen';
import { startSyncIntegration } from './startSync';
import { syncStore } from './syncStore';
import { statusLine } from './syncText';
import { createFakeSyncService, type FakeSyncService } from './testKit';

/**
 * SYNC-01 (D-275, critère 2) : une ligne créée par un appareil resté au schéma précédent attend sur cet appareil (avertissement
 * `older-device`) : bandeau A-09 existant (`syncTrouble`) « Un appareil utilise une version plus ancienne. Mets-le à jour. », texte d'un
 * catalogue chargé à la demande ; même texte dans AVERTISSEMENTS ; jamais « À jour » tant qu'il est levé ; disparaît avec l'avertissement.
 */

const SELF = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000f1');
const NOW = '2026-11-15T08:02:00.000Z';
const TEXT = 'Un appareil utilise une version plus ancienne. Mets-le à jour.';
const NO_PERSISTED = { join: null, devices: null, blocking: null, readFailed: false } as const;
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
  useNavigationStore.setState(INITIAL_NAVIGATION);
  useAppStatusStore.setState({ sources: {} });
  await db.close();
});

const status = (patch: Partial<SyncStatus>): SyncStatus => ({ ...sync.status(), ...patch });

describe('SYNC-01 : appareil resté à une version plus ancienne', () => {
  it('avertissement des données, avant « reçu non appliqué » ; ligne d’état « incomplète », jamais « À jour »', () => {
    const order = SYNC_TROUBLE_ORDER as readonly string[];
    expect(order).toContain('older-device');
    expect(order.indexOf('older-device')).toBeLessThan(order.indexOf('received-unapplied'));
    const banners = syncBannerFor<SyncDeviceStatus, SyncStatus>(status({ warnings: ['older-device'] as SyncStatus['warnings'], devices: [] }), NO_PERSISTED);
    expect(banners.troubles.map((x) => x.code)).toEqual(['older-device']);
    expect(statusLine(status({ warnings: ['older-device'] as SyncStatus['warnings'] }), Date.parse(NOW))).toBe(t('sync.status.incomplete'));
  });

  it('bandeau posé par l’intégration : texte chargé à la demande, « Voir » ; levé quand plus rien n’attend', async () => {
    sync.setStatus({ warnings: ['older-device'] as SyncStatus['warnings'] });
    const integration = startSyncIntegration(container, timers);
    await integration.refreshed();
    await vi.waitFor(() => {
      expect(useAppStatusStore.getState().sources.syncTrouble?.message).toBe(TEXT);
    });
    const banner = useAppStatusStore.getState().sources.syncTrouble;
    expect(banner?.detail).toBe('older-device');
    expect(banner?.onAction).toBeTypeOf('function');
    sync.setStatus({ warnings: [] });
    await vi.waitFor(() => {
      expect(useAppStatusStore.getState().sources.syncTrouble).toBeFalsy();
    });
    integration.dispose();
  });

  it('Réglages › Synchronisation : même texte dans AVERTISSEMENTS', () => {
    syncStore.get(container).setState({ status: status({ warnings: ['older-device'] as SyncStatus['warnings'] }) });
    render(
      <AppContainerProvider container={container}>
        <SyncDetailsScreen slots={{ pairing: null, conflicts: null, version: null, forget: null, reset: null }} />
      </AppContainerProvider>,
    );
    expect(screen.getByText(t('sync.status.sectionWarnings'))).toBeTruthy();
    expect(screen.getByText(TEXT)).toBeTruthy();
  });
});
