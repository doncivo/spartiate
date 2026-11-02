import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import type { DataAccess } from '../../db/repositories';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { useAppStore } from '../app/appStore';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { SettingsScreen } from './SettingsScreen';

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-000000000007');

// UI-REFONTE-09 : l'écran de Reglages.html est celui de l'iPhone ; le PC a son sommaire et ses titres en minuscules (SettingsPc.test).
function mockViewport(width: number): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= 1024 && query.includes('min-width: 1024px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('SettingsScreen (T-06)', () => {
  let db: TestDb;
  let container: AppContainer;

  const containerWith = (data: DataAccess): AppContainer =>
    createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data });
  const failing = (method: 'get' | 'set'): DataAccess =>
    ({
      ...db.data,
      repos: { ...db.data.repos, settings: { ...db.data.repos.settings, [method]: () => Promise.reject(new Error('boom')) } },
    }) as DataAccess;
  const renderScreen = (c: AppContainer = container) =>
    render(
      <AppContainerProvider container={c}>
        <SettingsScreen />
      </AppContainerProvider>,
    );

  beforeEach(async () => {
    mockViewport(440);
    db = await openTestDb(DEVICE);
    container = containerWith(db.data);
  });

  afterEach(async () => {
    cleanup();
    useNavigationStore.setState(INITIAL_NAVIGATION);
    useAppStore.setState({ timeZone: null });
    vi.unstubAllGlobals();
    await db.close();
  });

  it('T-11 : la ligne « Fuseau horaire » affiche le fuseau courant suivi de « (automatique) » (critère 5)', () => {
    useAppStore.setState({ timeZone: 'Europe/Paris' });
    renderScreen();
    expect(screen.getByText('GÉNÉRAL')).toBeInTheDocument();
    expect(screen.getByText('Fuseau horaire')).toBeInTheDocument();
    expect(screen.getByText('Europe/Paris (automatique)')).toBeInTheDocument();
  });

  it('T-11 : le fuseau suit le store quand il change (critère 6)', async () => {
    useAppStore.setState({ timeZone: 'Europe/Paris' });
    renderScreen();
    useAppStore.getState().setTimeZone('Africa/Tunis');
    expect(await screen.findByText('Africa/Tunis (automatique)')).toBeInTheDocument();
  });

  it('échec de lecture : message, pas de rejet', async () => {
    renderScreen(containerWith(failing('get')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de lire les réglages.');
  });
});
