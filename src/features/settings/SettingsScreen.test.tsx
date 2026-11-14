import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId, type LocalDate } from '../../domain/types';
import type { DataAccess } from '../../db/repositories';
import { openBaseDb, openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { useAppStore } from '../app/appStore';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { createFakeAuthenticator, guardAuthenticator } from '../../platform/biometric';
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

  /** Base neuve (profil et pesées) : le résumé de la carte profil lit ces deux tables. */
  async function renderOnBaseDb(seed: (base: TestDb) => Promise<void>): Promise<TestDb> {
    const base = await openBaseDb(DEVICE);
    await seed(base);
    renderScreen(createAppContainer({ clock: base.clock, hlc: createHlcClock({ clock: base.clock, deviceId: DEVICE }), data: base.data }));
    return base;
  }

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
    expect(screen.getByRole('heading', { level: 2, name: 'APP' })).toBeInTheDocument();
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
  it('Plus iPhone (ERGO-02) : titre, puis MOI (profil), SOURCES, APP, DONNÉES dans l’ordre ; plus de groupe IPHONE ni À PROPOS', async () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1, name: 'Plus' })).toBeInTheDocument();
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['MOI', 'SOURCES', 'APP', 'DONNÉES']);
    for (const old of ['GÉNÉRAL', 'DONNÉES ET SÉCURITÉ', 'SYNCHRONISATION', 'IPHONE', 'PRÉFÉRENCES', 'À PROPOS']) expect(screen.queryByText(old)).toBeNull();
    const profile = screen.getByRole('button', { name: /Profil et poids/ });
    const me = screen.getByRole('heading', { name: 'MOI' });
    expect(me.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(screen.queryByRole('group', { name: 'Sections des réglages' })).toBeNull();
    expect(document.querySelector('.ct-settings__rule')).toBeNull();
  });

  it('finitions 0.1.2 (a) — D-37 : la ligne « Verrouillage Face ID » reste masquée même quand l’iPhone sait authentifier', async () => {
    const withAuth = createAppContainer({
      clock: db.clock,
      hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }),
      data: db.data,
      authenticator: guardAuthenticator(createFakeAuthenticator()),
    });
    expect(withAuth.authenticator.supported).toBe(true);
    renderScreen(withAuth);
    await screen.findByRole('heading', { level: 1, name: 'Plus' });
    expect(screen.queryByText(/Verrouillage/)).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'IPHONE' })).toBeNull();
  });

  it('carte profil sans valeur saisie : texte neutre, jamais de valeur inventée ; un appui ouvre Profil et poids', async () => {
    renderScreen();
    const card = screen.getByRole('button', { name: /Profil et poids/ });
    expect(await within(card).findByText('Taille, poids et objectif')).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/kg|cm/);
    fireEvent.click(card);
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'body' });
  });

  it('carte profil : résumé construit avec la taille, le dernier poids et l’objectif réellement saisis', async () => {
    const base = await renderOnBaseDb(async (b) => {
      await (await b.data.repos.profile()).save({ heightCm: 178, goal: 'gain' }, 2026);
      await (await b.data.repos.bodyWeights()).saveManual({ date: '2026-01-10' as LocalDate, kg: 81.4, timezone: 'Europe/Paris' }, '2026-11-04' as LocalDate);
    });
    const card = screen.getByRole('button', { name: /Profil et poids/ });
    expect(await within(card).findByText('178 cm · 81,4 kg le 10 janv. · prise de masse')).toBeInTheDocument();
    cleanup();
    await base.close();
  });

  it('carte profil : un profil sans taille ni objectif ne montre que le poids saisi', async () => {
    const base = await renderOnBaseDb(async (b) => {
      await (await b.data.repos.bodyWeights()).saveManual({ date: '2026-01-10' as LocalDate, kg: 80, timezone: 'Europe/Paris' }, '2026-11-04' as LocalDate);
    });
    const card = screen.getByRole('button', { name: /Profil et poids/ });
    expect(await within(card).findByText('80 kg le 10 janv.')).toBeInTheDocument();
    cleanup();
    await base.close();
  });

  it('DONNÉES : « Export et import » mène à son écran ; PRÉFÉRENCES : thème, début de semaine, heure mènent à Apparence', async () => {
    renderScreen();
    const data = screen.getByRole('heading', { name: 'DONNÉES' }).nextElementSibling as HTMLElement;
    fireEvent.click(within(data).getByRole('button', { name: 'Export et import' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'exportimport' });
    useNavigationStore.setState(INITIAL_NAVIGATION);
    for (const name of ['Thème : Sombre', 'Début de semaine : Lundi', 'Format de l’heure : 24 h']) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'appearance' });
      useNavigationStore.setState(INITIAL_NAVIGATION);
    }
  });

  it('Version et « Logs » (diagnostic et journal) restent accessibles, dans le groupe APP (ERGO-02)', async () => {
    renderScreen();
    const app = screen.getByRole('heading', { name: 'APP' }).nextElementSibling as HTMLElement;
    expect(within(app).getByText(/^Version/)).toBeInTheDocument();
    expect(within(app).getByRole('button', { name: 'Ouvrir l’écran des logs' })).toBeInTheDocument();
  });
});
