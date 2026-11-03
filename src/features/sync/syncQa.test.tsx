import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId, type IsoDateTime } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { t } from '../../i18n';
import type { SyncPhase } from '../../platform/sync/types';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { trayLabels } from '../app/desktop';
import { BackupSheet } from '../settings/BackupSheet';
import { createMemoryBackup } from '../../platform/backup';
import { SyncStatusLine } from './SyncStatusLine';
import { formatCount } from './syncText';
import { createFakeSyncService, type FakeSyncService } from './testKit';

/**
 * QA du lot Y2, côté écran (Y-02 critère 16, Y-03 critères 7 et 8, Y-05 critère 2) : tous les états d'erreur laissent le bouton actif
 * sans boîte bloquante, le bouton est natif et atteignable au clavier, le libellé du menu de la zone de notification suit la langue.
 */

const SELF = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000e2');
const NOW = '2026-10-05T08:00:30.000Z';

let db: TestDb;
let sync: FakeSyncService;
let container: AppContainer;

beforeEach(async () => {
  db = await openTestDb(SELF, NOW);
  sync = createFakeSyncService({ phase: 'idle', lastSyncAt: '2026-10-05T08:00:00.000Z' as IsoDateTime, folderLabel: 'Spartiate', folderKind: 'icloud' });
  container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: SELF }), data: db.data, sync });
});

afterEach(async () => {
  cleanup();
  await db.close();
});

const renderLine = () =>
  render(
    <AppContainerProvider container={container}>
      <SyncStatusLine />
    </AppContainerProvider>,
  );

describe('UI-FIX-02 : couleur de tous les états', () => {
  it.each(['not-configured', 'needs-pairing', 'syncing', 'waiting-icloud', 'restore-choice', 'update-required', 'clock-ahead', 'key-mismatch', 'error', 'forgotten', 'reset-required'] as const)('%s ne prend jamais la couleur du succès', (phase) => {
    sync.setStatus({ phase });
    renderLine();
    expect(screen.getByTestId('sync-status-text').getAttribute('data-tone')).toBe(phase === 'error' || phase === 'key-mismatch' || phase === 'clock-ahead' || phase === 'update-required' || phase === 'forgotten' || phase === 'reset-required' ? 'danger' : 'neutral');
  });

  it.each(([null, ['received-unapplied'], ['publish-blocked'], ['awaiting-other-devices'], ['own-delete-failed'], ['carry-held'], ['carry-report']] as const).map((warnings) => ({ warnings })))('idle ne devient pas vert avec une publication incomplète : $warnings', ({ warnings }) => {
    sync.setStatus({ phase: 'idle', lastSyncAt: warnings === null ? null : NOW as IsoDateTime, warnings: warnings === null ? [] : [...warnings] });
    renderLine();
    expect(screen.getByTestId('sync-status-text').getAttribute('data-tone')).not.toBe('success');
    expect(screen.getByTestId('sync-status-live').textContent).toBe('');
  });

  it('réserve le succès à idle avec un cycle complet sans avertissement', () => {
    renderLine();
    expect(screen.getByTestId('sync-status-text').getAttribute('data-tone')).toBe('success');
  });
});

describe('états d’erreur (Y-03 critère 7, Y-05 critère 2)', () => {
  const cases: readonly { phase: SyncPhase; patch: Record<string, unknown> }[] = [
    { phase: 'error', patch: { errorCode: 'folder-unreachable' } },
    { phase: 'error', patch: { errorCode: 'cloud-provider-stopped' } },
    { phase: 'error', patch: { errorCode: 'io' } },
    { phase: 'waiting-icloud', patch: { errorCode: 'cloud-pending' } },
    { phase: 'key-mismatch', patch: {} },
    { phase: 'update-required', patch: {} },
    { phase: 'clock-ahead', patch: { clockAheadDevice: 'iPhone' } },
  ];
  it.each(cases)('phase $phase ($patch) : bouton actif, texte de la phase, aucune boîte bloquante', ({ phase, patch }) => {
    sync.setStatus({ phase, ...patch });
    renderLine();
    const button = screen.getByRole('button', { name: 'Synchroniser' });
    expect(button).toHaveProperty('disabled', false);
    expect(button.getAttribute('aria-busy')).not.toBe('true');
    const text = screen.getByTestId('sync-status-text').textContent ?? '';
    expect(text.length).toBeGreaterThan(3);
    expect(text).not.toMatch(/undefined|\{|\}/);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('accessibilité du bouton (Y-03 critère 8)', () => {
  it('bouton natif, atteignable au clavier (Tab, Entrée, Espace activent un bouton natif), état annoncé par une région vivante séparée', () => {
    renderLine();
    const button = screen.getByRole('button', { name: 'Synchroniser' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('tabindex')).not.toBe('-1');
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(screen.getByTestId('sync-status-live')).toBeTruthy();
  });
});

describe('menu de la zone de notification et langue (Y-03 critères 4 et 8)', () => {
  it('« Synchroniser maintenant » vient du catalogue, pas du code', () => {
    expect(trayLabels(true).sync).toBe('Synchroniser maintenant');
    expect(trayLabels(true).sync).toBe(t('desktop.tray.sync'));
  });
});

describe('nombres de l’arrivée selon la langue (Ordre 4)', () => {
  it('groupement de milliers à la française', () => {
    expect(formatCount(1200).replace(/\s/g, ' ')).toBe('1 200');
  });
});

describe('feuille de sauvegarde (Y-02 critère 13)', () => {
  const sheet = (c: AppContainer) =>
    render(
      <AppContainerProvider container={c}>
        <BackupSheet onClose={() => undefined} />
      </AppContainerProvider>,
    );

  it('dossier configuré : « Cet appareil est associé : le choix vous sera demandé à la prochaine synchro » ; sinon rien', async () => {
    const backups = createMemoryBackup({ versions: [], nowMs: () => db.clock.nowMs() });
    const withSync = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: SELF }), data: db.data, sync, backups });
    sheet(withSync);
    expect(await screen.findByText('Cet appareil est associé : le choix vous sera demandé à la prochaine synchro')).toBeTruthy();
    cleanup();
    sync.setStatus({ phase: 'not-configured' });
    const without = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: SELF }), data: db.data, sync, backups });
    sheet(without);
    await screen.findByRole('heading', { level: 2 });
    expect(screen.queryByText(/Cet appareil est associé/)).toBeNull();
  });
});
