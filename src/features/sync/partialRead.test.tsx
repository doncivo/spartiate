// SYNC-0302 (D-673, option C) : « lecture partielle » à côté de l'heure de dernière synchro, partout où cette heure est montrée (ligne de
// Réglages, carte d'état et ligne « Cet appareil » des Détails), avec un avertissement court dans la section Avertissements ; jamais le
// vert « À jour ». Sans `partialRead`, l'affichage d'avant est inchangé.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId, type IsoDateTime } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { t } from '../../i18n';
import type { SyncDeviceStatus, SyncStatus } from '../../platform/sync/types';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { SyncDetailsScreen } from './SyncDetailsScreen';
import { syncStore } from './syncStore';
import { formatSyncAge, formatSyncTime, statusLine, syncStatusTone } from './syncText';
import { createFakeSyncService, type FakeSyncService } from './testKit';

const SELF = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000f4');
const OTHER = asEntityId<DeviceId>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const NOW = '2026-10-07T08:00:00.000Z';
const LAST = '2026-10-07T07:58:00.000Z' as IsoDateTime;

let db: TestDb;
let container: AppContainer;
let sync: FakeSyncService;

beforeEach(async () => {
  db = await openTestDb(SELF, NOW);
  sync = createFakeSyncService({ phase: 'idle', lastSyncAt: LAST, folderLabel: 'Spartiate', folderKind: 'icloud' });
  container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: SELF }), data: db.data, sync });
});

afterEach(async () => {
  cleanup();
  useNavigationStore.setState(INITIAL_NAVIGATION);
  await db.close();
});

const devices: SyncDeviceStatus[] = [
  { deviceId: SELF, platform: 'windows', self: true, lastReadAt: LAST, status: 'active' },
  { deviceId: OTHER, platform: 'ios', self: false, lastReadAt: LAST, status: 'active' },
];
const status = (patch: Partial<SyncStatus>): SyncStatus => ({ ...sync.status(), devices, ...patch });
const slots = { pairing: null, conflicts: null, version: null, forget: null, reset: null, carryReport: null };
const nowMs = Date.parse(NOW);

function renderDetails(s: SyncStatus): void {
  syncStore.get(container).setState({ status: s });
  render(<AppContainerProvider container={container}><SyncDetailsScreen slots={slots} /></AppContainerProvider>);
}

describe('SYNC-0302 : lecture partielle à l’écran', () => {
  it('ligne de Réglages : l’heure et « lecture partielle », ton neutre (jamais le vert « À jour »)', () => {
    const partial = status({ partialRead: true });
    expect(statusLine(partial, nowMs)).toBe(t('sync.status.upToDatePartial', { age: formatSyncAge(LAST, nowMs) }));
    expect(statusLine(partial, nowMs)).toContain('lecture partielle');
    expect(syncStatusTone(partial)).toBe('neutral');
    // Sans l'indicateur : inchangé.
    expect(statusLine(status({}), nowMs)).toBe(t('sync.status.upToDate', { age: formatSyncAge(LAST, nowMs) }));
    expect(syncStatusTone(status({}))).toBe('success');
  });

  it('une synchro incomplète pour une autre raison garde son texte (les avertissements priment)', () => {
    expect(statusLine(status({ partialRead: true, warnings: ['received-unapplied'] }), nowMs)).toBe(t('sync.status.incomplete'));
  });

  it('Détails : « Cet appareil » porte la mention, l’avertissement dit que la suite viendra au prochain cycle ; levé sans l’indicateur', () => {
    renderDetails(status({ partialRead: true }));
    const time = formatSyncTime(LAST, nowMs);
    expect(screen.getByText(t('sync.status.lastSyncPartial', { time }))).toBeTruthy();
    expect(screen.getByText(t('sync.status.warnPartialRead'))).toBeTruthy();
    expect(document.querySelector('[data-warning="partial-read"]')).not.toBeNull();
    expect(screen.getByText(t('sync.status.sectionWarnings'))).toBeTruthy();
    // La ligne de l'autre appareil (heure de lecture) n'est pas concernée.
    expect(screen.getByText(t('sync.status.lastRead', { time }))).toBeTruthy();
    cleanup();
    renderDetails(status({}));
    expect(screen.getByText(t('sync.status.lastSync', { time }))).toBeTruthy();
    expect(screen.queryByText(t('sync.status.warnPartialRead'))).toBeNull();
    expect(screen.queryByText(t('sync.status.sectionWarnings'))).toBeNull();
  });

  it('textes : mention « lecture partielle » et conseil d’action dans le catalogue de la synchro', () => {
    expect(t('sync.status.lastSyncPartial', { time: '07:58' })).toBe('Dernière synchronisation : 07:58 · lecture partielle');
    expect(t('sync.status.warnPartialRead')).toMatch(/prochain cycle/);
  });
});
