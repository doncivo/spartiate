import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../domain/hlc';
import type { DeviceId } from '../domain/types';
import { openBaseDb, type TestDb } from '../db/repositories/sql/testSetup';
import { createLogJournal, createMemoryLogTransport } from '../platform/logs';
import { AppContainerProvider } from './app/AppContainerContext';
import { createAppContainer } from './app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from './app/navigation';
import { LogsScreen } from './settings/logs/LogsScreen';
import { SettingsScreen } from './settings/SettingsScreen';
import { TodaySessionCard } from './training/session/TodaySessionCard';
import { TrainingScreen } from './training/TrainingScreen';

/**
 * ERGO-01b P5 (D-238, docs/ERGO-01.md § 4) : le doublon « Journal des séances » de la carte Séance est retiré, l'historique reste accessible
 * depuis Entraînement (section « Journal ») ; « Tester le minuteur (60 s) » quitte Plus › À propos pour Plus › Logs.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f5' as DeviceId;
let db: TestDb;
const mount = (node: React.ReactNode, route?: Route) => {
  if (route) act(() => useNavigationStore.getState().navigate(route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } });
  return render(<AppContainerProvider container={container}>{node}</AppContainerProvider>);
};

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('ERGO-01b P5 : doublon retiré, accès gardé', () => {
  it('carte Séance : plus de bouton « Journal des séances »', async () => {
    mount(<TodaySessionCard />);
    expect(await screen.findByRole('button', { name: 'Commencer une séance' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Journal des séances' })).toBeNull();
  });

  it('Entraînement garde l’accès à l’historique : section « Journal » et liste des séances', async () => {
    mount(<TrainingScreen />, { tab: 'training', screen: 'history' });
    expect(await screen.findByRole('radio', { name: 'Journal' })).toBeChecked();
    expect(await screen.findByText(/Aucune séance terminée pour l’instant/)).toBeInTheDocument();
  });

  it('« Tester le minuteur (60 s) » est dans Logs, plus dans Plus › À propos', async () => {
    mount(<SettingsScreen />, { tab: 'more', screen: 'home' });
    expect(await screen.findByRole('button', { name: 'Ouvrir l’écran des logs' })).toBeInTheDocument();
    expect(screen.queryByText('Tester le minuteur (60 s)')).toBeNull();
    cleanup();
    mount(<LogsScreen journal={createLogJournal(createMemoryLogTransport([]), { document: null, window: null })} version={() => Promise.resolve('0.22.1')} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Outils de test' }));
    expect(await screen.findByText('Tester le minuteur (60 s)')).toBeInTheDocument();
  });
});
