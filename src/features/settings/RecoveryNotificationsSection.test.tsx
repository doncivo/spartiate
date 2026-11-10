import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { createFakeNotificationScheduler, type FakeNotificationScheduler } from '../../platform/notifications';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { RecoveryNotificationsSection } from './RecoveryNotificationsSection';

vi.mock('../../platform/desktop/log', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), logFailure: vi.fn() }));

/** Réglages « Sommeil et rappels » (I5-02 point 2.3) : deux interrupteurs éteints par défaut, heure proposée, autorisation sur geste seulement. */
const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-000000000013');

describe('Section « Sommeil et rappels »', () => {
  let db: TestDb;
  let fake: FakeNotificationScheduler;
  let container: AppContainer;
  const build = (platform: AppContainer['platform']): AppContainer =>
    createAppContainer({
      clock: db.clock,
      hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }),
      data: db.data,
      platform,
      notifications: fake,
      notificationClock: { nowMs: () => Date.parse('2026-11-10T06:00:00Z'), zone: () => 'Europe/Paris' },
    });
  const renderSection = () =>
    render(
      <AppContainerProvider container={container}>
        <RecoveryNotificationsSection />
      </AppContainerProvider>,
    );

  beforeEach(async () => {
    db = await openBaseDb(DEVICE, '2026-11-10T06:00:00.000Z');
    fake = createFakeNotificationScheduler();
    container = build({ runtime: 'tauri', os: 'ios' });
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it('deux interrupteurs désactivés par défaut ; aucune notification planifiée ni autorisation demandée à l’ouverture', async () => {
    renderSection();
    const bedtime = await screen.findByRole('switch', { name: 'Rappel de coucher' });
    expect(bedtime).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Notification du matin' })).toHaveAttribute('aria-checked', 'false');
    expect(fake.calls).toEqual([]);
  });

  it('sans proposition connue : « pas encore de proposition », jamais une heure inventée', async () => {
    renderSection();
    expect(await screen.findByText(/Pas encore de proposition/)).toBeInTheDocument();
  });

  it('affiche l’heure proposée enregistrée', async () => {
    await db.data.repos.settings.set('recovery.bedtimeProposal', { v: 1, day: '2026-11-10', time: '23:00' });
    renderSection();
    expect(await screen.findByText('23:00')).toBeInTheDocument();
  });

  it('proposition « pas encore » (moins de 7 nuits) : texte des 7 nuits', async () => {
    await db.data.repos.settings.set('recovery.bedtimeProposal', { v: 1, day: '2026-11-10', time: null });
    renderSection();
    expect(await screen.findByText(/au moins 7 nuits/)).toBeInTheDocument();
  });

  it('activer le coucher : réglage local enregistré, notifications planifiées', async () => {
    await db.data.repos.settings.set('recovery.bedtimeProposal', { v: 1, day: '2026-11-10', time: '23:00' });
    renderSection();
    fireEvent.click(await screen.findByRole('switch', { name: 'Rappel de coucher' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Rappel de coucher' })).toHaveAttribute('aria-checked', 'true'));
    expect(await db.data.repos.settings.get('recovery.notificationPrefs')).toEqual({ v: 1, bedtime: true, morning: false });
    await waitFor(async () => expect((await fake.pending()).filter((n) => n.kind === 'bedtime')).toHaveLength(7));
  });

  it('autorisation refusée : message explicite, aucune nouvelle demande d’autorisation', async () => {
    fake.setPermission('denied');
    renderSection();
    fireEvent.click(await screen.findByRole('switch', { name: 'Notification du matin' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('refusées');
    expect(fake.calls.map((c) => c.type)).not.toContain('requestPermission');
  });

  it('PC : aucune notification, une phrase, aucun interrupteur actif', async () => {
    container = build({ runtime: 'tauri', os: 'windows' });
    renderSection();
    expect(await screen.findByText(/le PC n’en envoie aucune/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(fake.calls).toEqual([]);
  });
});
