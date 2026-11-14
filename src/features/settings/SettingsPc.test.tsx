import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { createFakeDesktop, type FakeDesktop } from '../../platform/desktop/testing';
import { AppContainerProvider } from '../app/AppContainerContext';
import { useAppStore } from '../app/appStore';
import { createAppContainer, type AppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { SettingsScreen } from './SettingsScreen';

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000d9');

function mockViewport(width: number): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= 1024 && query.includes('min-width: 1024px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

/**
 * UI-REFONTE-09 — Réglages sur PC (docs/archive/circletasks/maquettes-refonte/PC-Reglages.html) : sommaire à gauche, colonne bornée, titres en minuscules,
 * « Préférences » en cinq lignes (Thème, Début de semaine, Format de l’heure, Fuseau horaire, Démarrer avec Windows),
 * « Clavier » avec « Tous les raccourcis » et le conflit expliqué en une phrase. L'iPhone ne change pas.
 */
describe('UI-REFONTE-09 — Réglages sur PC (PC-Reglages.html)', () => {
  let db: TestDb;
  let desktop: FakeDesktop;
  let container: AppContainer;
  let scrolled: Element[];

  const containerWith = (d: FakeDesktop | null): AppContainer =>
    createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, desktop: d });
  const renderScreen = (c: AppContainer = container) =>
    render(
      <AppContainerProvider container={c}>
        <SettingsScreen />
      </AppContainerProvider>,
    );
  const list = () => screen.getByRole('group', { name: 'Réglages' });
  const ready = () => screen.findByRole('group', { name: 'Réglages' });
  const open = async (name: RegExp) => {
    await ready();
    fireEvent.click(within(list()).getByRole('button', { name }));
    return screen.findByRole('region', { name: name.source.replace(/[\^]/g, '') });
  };

  beforeEach(async () => {
    db = await openTestDb(DEVICE);
    desktop = createFakeDesktop();
    container = containerWith(desktop);
    mockViewport(1440);
    useAppStore.setState({ timeZone: 'Europe/Paris' });
    scrolled = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useNavigationStore.setState(INITIAL_NAVIGATION);
    useAppStore.setState({ timeZone: null });
    await db.close();
  });

  it('liste : titre, quatre groupes, entrées dans l’ordre (ERGO-02) ; l’entrée courante est marquée', async () => {
    renderScreen();
    await ready();
    expect(screen.getByRole('heading', { level: 1, name: 'Plus' })).toBeInTheDocument();
    expect(within(list()).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['MOI', 'SOURCES', 'APP', 'DONNÉES']);
    expect(within(list()).getAllByRole('button').map((b) => (b.firstChild as HTMLElement).textContent)).toEqual([
      'Profil et poids',
      'Appareils et synchro',
      'Apparence',
      'Fuseau et démarrage',
      'Raccourcis clavier',
      'À propos et diagnostic',
      'Export et import',
      'Journaux',
      'Repartir de zéro',
    ]);
    for (const old of ['Synchro et données', 'Préférences', 'GÉNÉRAL', 'CLAVIER']) expect(screen.queryByText(old)).toBeNull();
    expect(screen.getByRole('region', { name: 'Profil et poids' })).toBeInTheDocument();
  });

  it('Fuseau et démarrage : fuseau expliqué, démarrage expliqué avec son interrupteur (critère 3)', async () => {
    renderScreen();
    const general = await open(/^Fuseau et démarrage/);
    expect(within(general).getByText('Fuseau horaire')).toBeInTheDocument();
    expect(within(general).getByText('Suit celui de Windows')).toBeInTheDocument();
    expect(within(general).getByText('Europe/Paris')).toBeInTheDocument();
    expect(screen.queryByText(/(automatique)/)).toBeNull();
    expect(within(general).getByText('Spartiate s’ouvre réduit dans la zone de notification')).toBeInTheDocument();
    expect(await within(general).findByRole('switch', { name: 'Démarrer avec Windows' })).toBeInTheDocument();
  });

  it('À propos et diagnostic : mise à jour dans le panneau (critère 4)', async () => {
    renderScreen();
    const about = await open(/^À propos et diagnostic/);
    expect(await within(about).findByRole('button', { name: 'Rechercher une mise à jour' })).toBeInTheDocument();
  });

  it('Export et import s’ouvre dans le panneau, sans changer de route', async () => {
    renderScreen();
    const panel = await open(/^Export et import/);
    expect(panel).toBeInTheDocument();
    expect(useNavigationStore.getState().route).toEqual(INITIAL_NAVIGATION.route);
  });

  it('Clavier : « Tous les raccourcis » avec « Ctrl / » ouvre la liste ; aucune ligne de capture rapide (supprimée en 001b-front)', async () => {
    renderScreen();
    const keyboard = await open(/^Raccourcis clavier/);
    const all = within(keyboard).getByRole('button', { name: 'Afficher les raccourcis clavier' });
    expect(all).toHaveTextContent('Tous les raccourcis');
    expect(all).toHaveTextContent('Ctrl /');
    expect(all).toHaveClass('ct-settings__rowButton');
    fireEvent.click(all);
    expect(useNavigationStore.getState().overlays).toEqual([{ kind: 'shortcutsHelp' }]);
  });

  it('iPhone : pas de liste ni de panneau, quatre groupes (Plus réorganisé)', async () => {
    mockViewport(440);
    renderScreen(containerWith(null));
    await screen.findByRole('heading', { name: 'APP' });
    expect(screen.queryByRole('group', { name: 'Réglages' })).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByRole('heading', { name: 'DONNÉES' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thème : Sombre' })).toBeInTheDocument();
    expect(screen.getByText('Europe/Paris (automatique)')).toBeInTheDocument();
    expect(screen.queryByText('Suit celui de Windows')).toBeNull();
  });
});
