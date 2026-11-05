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
const NAV = ['Profil et poids', 'Synchro et données', 'Préférences', 'Raccourcis clavier', 'À propos et diagnostic'];
const SECTIONS = NAV.slice(1);

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
  const ready = () => screen.findByRole('switch', { name: 'Démarrer avec Windows' });
  const region = (name: string) => screen.getByRole('region', { name });
  const summary = () => screen.getByRole('group', { name: 'Sections des réglages' });

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

  it('sommaire : titre, cinq entrées dans l’ordre, section courante, un clic fait défiler la section ; « Profil et poids » ouvre son écran', async () => {
    renderScreen();
    await ready();
    expect(screen.getByRole('heading', { level: 1, name: 'Plus' })).toBeInTheDocument();
    const nav = summary();
    expect(within(nav).getAllByRole('button').map((button) => button.textContent)).toEqual(NAV);
    for (const name of SECTIONS) expect(within(region(name)).getByRole('heading', { level: 2, name })).toBeInTheDocument();
    for (const old of ['GÉNÉRAL', 'TÂCHES', 'RAPPELS', 'SYNCHRONISATION', 'DONNÉES ET SÉCURITÉ', 'CLAVIER', 'À PROPOS', 'Général', 'Clavier']) {
      expect(screen.queryByText(old)).toBeNull();
    }
    expect(within(nav).getByRole('button', { name: 'Synchro et données' })).toHaveAttribute('aria-current', 'true');
    expect(within(nav).getByRole('button', { name: 'À propos et diagnostic' })).not.toHaveAttribute('aria-current');
    fireEvent.click(within(nav).getByRole('button', { name: 'À propos et diagnostic' }));
    expect(scrolled).toEqual([region('À propos et diagnostic')]);
    expect(within(nav).getByRole('button', { name: 'À propos et diagnostic' })).toHaveAttribute('aria-current', 'true');
    expect(within(nav).getByRole('button', { name: 'Synchro et données' })).not.toHaveAttribute('aria-current');
    expect(document.querySelector('.ct-settings__rule')).toBeNull();
    fireEvent.click(within(nav).getByRole('button', { name: 'Profil et poids' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'body' });
    expect(scrolled).toHaveLength(1);
  });

  it('Synchro et données : sous-titres en capitales (iCloud, sauvegardes, export et import) ; l’export mène à son écran', async () => {
    renderScreen();
    await ready();
    const data = region('Synchro et données');
    const groups = within(data).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(groups).toContain('EXPORT ET IMPORT');
    for (const title of groups) expect(title).toBe(title?.toUpperCase());
    expect(groups.filter((g) => g === 'SYNCHRONISATION ICLOUD' || g === 'SAUVEGARDES' || g === 'EXPORT ET IMPORT').length).toBe(groups.length);
    const exportGroup = within(data).getByRole('group', { name: 'EXPORT ET IMPORT' });
    fireEvent.click(within(exportGroup).getByRole('button', { name: 'Export et import' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'exportimport' });
  });

  it('Préférences : Thème, Début de semaine et Format de l’heure en trois lignes vers Apparence  ; fuseau expliqué ; démarrage expliqué (critère 3)', async () => {
    renderScreen();
    await ready();
    const general = region('Préférences');
    expect(within(general).queryByRole('button', { name: /^Thème · semaine · heure/ })).toBeNull();
    const rows = ['Thème : Sombre', 'Début de semaine : Lundi', 'Format de l’heure : 24 h'];
    for (const name of rows) {
      fireEvent.click(within(general).getByRole('button', { name }));
      expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'appearance' });
      useNavigationStore.setState(INITIAL_NAVIGATION);
    }
    expect(within(general).getByText('Fuseau horaire')).toBeInTheDocument();
    expect(within(general).getByText('Suit celui de Windows')).toBeInTheDocument();
    expect(within(general).getByText('Europe/Paris')).toBeInTheDocument();
    expect(screen.queryByText(/\(automatique\)/)).toBeNull();
    expect(within(general).getByText('Spartiate s’ouvre réduit dans la zone de notification')).toBeInTheDocument();
    expect(within(general).getByRole('switch', { name: 'Démarrer avec Windows' })).toBeInTheDocument();
  });

  it('les lignes partagées rejoignent leurs sections (critère 4)', async () => {
    renderScreen();
    await ready();
    const about = region('À propos et diagnostic');
    expect(within(about).getByRole('button', { name: 'Rechercher une mise à jour' })).toBeInTheDocument();
  });

  it('Clavier : « Tous les raccourcis » avec « Ctrl / » ouvre la liste ; aucune ligne de capture rapide (supprimée en 001b-front)', async () => {
    renderScreen();
    await ready();
    const keyboard = region('Raccourcis clavier');
    const all = within(keyboard).getByRole('button', { name: 'Afficher les raccourcis clavier' });
    expect(all).toHaveTextContent('Tous les raccourcis');
    expect(all).toHaveTextContent('Ctrl /');
    expect(all).toHaveClass('ct-settings__rowButton');
    fireEvent.click(all);
    expect(useNavigationStore.getState().overlays).toEqual([{ kind: 'shortcutsHelp' }]);
  });

  it('iPhone : pas de sommaire, sections DONNÉES / PRÉFÉRENCES / À PROPOS (Plus réorganisé)', async () => {
    mockViewport(440);
    renderScreen(containerWith(null));
    await screen.findByRole('heading', { name: 'PRÉFÉRENCES' });
    expect(screen.queryByRole('group', { name: 'Sections des réglages' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'DONNÉES' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thème : Sombre' })).toBeInTheDocument();
    expect(screen.getByText('Europe/Paris (automatique)')).toBeInTheDocument();
    expect(screen.queryByText('Suit celui de Windows')).toBeNull();
  });
});
