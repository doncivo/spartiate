// ERGO-02 (C3, C9) : Plus en quatre groupes (Moi, Sources, App, Données) avec la valeur actuelle de chaque réglage ; PC : liste à gauche,
// réglage ouvert à droite ; Appareils et synchro : « Ajouter un appareil » (iPhone), QR à droite (PC).
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { t } from '../../i18n';
import { asEntityId, type DeviceId, type IsoDateTime } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { MemorySyncFolder, createMemorySyncPlatform } from '../../platform/sync';
import { createFakeDesktop } from '../../platform/desktop/testing';
import { AppContainerProvider } from '../app/AppContainerContext';
import { useAppStore } from '../app/appStore';
import { createAppContainer, type AppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { SyncDetailsScreen } from '../sync/SyncDetailsScreen';
import { createFakeSyncService } from '../sync/testKit';
import { SettingsScreen } from './SettingsScreen';

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000e2');
const NOW = '2026-11-13T08:02:00.000Z';

function mockViewport(width: number): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= 1024 && query.includes('min-width: 1024px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('ERGO-02 — Plus et Appareils et synchro (aperçu 13/11)', () => {
  let db: TestDb;
  let container: AppContainer;
  const renderIn = (node: React.ReactNode) => render(<AppContainerProvider container={container}>{node}</AppContainerProvider>);

  beforeEach(async () => {
    db = await openTestDb(DEVICE, NOW);
    const platform = createMemorySyncPlatform({ folder: new MemorySyncFolder() });
    await platform.folder.choose();
    await platform.bindDevice(DEVICE);
    await platform.key.create();
    const sync = createFakeSyncService({ phase: 'idle', lastSyncAt: '2026-11-13T08:00:00.000Z' as IsoDateTime, folderLabel: 'Spartiate', folderKind: 'icloud' });
    container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, sync, syncPlatform: platform, desktop: createFakeDesktop() });
    useAppStore.setState({ timeZone: 'Europe/Paris' });
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

  describe('iPhone (440 px)', () => {
    beforeEach(() => mockViewport(440));
    const group = (title: string): HTMLElement => screen.getByRole('heading', { level: 2, name: title }).nextElementSibling as HTMLElement;

    it('quatre groupes dans l’ordre : MOI, SOURCES, APP, DONNÉES', async () => {
      renderIn(<SettingsScreen />);
      await screen.findByRole('heading', { level: 1, name: 'Plus' });
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['MOI', 'SOURCES', 'APP', 'DONNÉES']);
    });

    it('MOI : Profil et poids ; SOURCES : Appareils et synchro avec son état ; APP : thème, semaine, heure, fuseau ; DONNÉES : export, repartir de zéro', async () => {
      renderIn(<SettingsScreen />);
      await screen.findByRole('heading', { level: 1, name: 'Plus' });
      expect(within(group('MOI')).getByRole('button', { name: /^Profil et poids/ })).toBeInTheDocument();
      const sync = await within(group('SOURCES')).findByRole('button', { name: /^Appareils et synchro : À jour/ });
      fireEvent.click(sync);
      expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'sync' });
      const app = group('APP');
      for (const name of ['Thème : Sombre', 'Début de semaine : Lundi', 'Format de l’heure : 24 h']) expect(within(app).getByRole('button', { name })).toBeInTheDocument();
      expect(within(app).getByText('Europe/Paris (automatique)')).toBeInTheDocument();
      const data = group('DONNÉES');
      expect(within(data).getByRole('button', { name: 'Export et import' })).toBeInTheDocument();
      expect(within(data).getByRole('button', { name: /^Repartir de zéro/ })).toBeInTheDocument();
    });

    it('À propos reste atteignable (version, journal) et aucune entrée ne disparaît', async () => {
      renderIn(<SettingsScreen />);
      await screen.findByRole('heading', { level: 1, name: 'Plus' });
      expect(screen.getByText(/^Version/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ouvrir l’écran des logs' })).toBeInTheDocument();
    });
  });

  describe('PC (1 440 px) : liste à gauche, réglage à droite', () => {
    beforeEach(() => mockViewport(1440));
    const list = () => screen.getByRole('group', { name: 'Réglages' });

    it('la liste porte les quatre groupes ; le panneau de droite ouvre Profil et poids au départ', async () => {
      renderIn(<SettingsScreen />);
      await screen.findByRole('heading', { level: 1, name: 'Plus' });
      expect(within(list()).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['MOI', 'SOURCES', 'APP', 'DONNÉES']);
      expect(screen.getByRole('region', { name: 'Profil et poids' })).toBeInTheDocument();
      expect(within(list()).getByRole('button', { name: /^Profil et poids/ })).toHaveAttribute('aria-current', 'true');
    });

    it('un clic ouvre le réglage dans le panneau, sans changer de route', async () => {
      renderIn(<SettingsScreen />);
      await screen.findByRole('heading', { level: 1, name: 'Plus' });
      fireEvent.click(within(list()).getByRole('button', { name: /^Apparence/ }));
      const panel = await screen.findByRole('region', { name: 'Apparence' });
      expect(await within(panel).findByRole('heading', { level: 1, name: /^Apparence/ })).toBeInTheDocument();
      expect(within(list()).getByRole('button', { name: /^Apparence/ })).toHaveAttribute('aria-current', 'true');
      expect(useNavigationStore.getState().route).toEqual(INITIAL_NAVIGATION.route);
    });

    it('chaque entrée montre sa valeur actuelle (apparence, synchro)', async () => {
      renderIn(<SettingsScreen />);
      await screen.findByRole('heading', { level: 1, name: 'Plus' });
      expect(within(list()).getByRole('button', { name: 'Apparence : Sombre' })).toBeInTheDocument();
      expect(within(list()).getByRole('button', { name: /^Appareils et synchro : À jour/ })).toBeInTheDocument();
    });

    it('clavier : flèche bas / haut déplace le focus dans la liste', async () => {
      renderIn(<SettingsScreen />);
      await screen.findByRole('heading', { level: 1, name: 'Plus' });
      const buttons = within(list()).getAllByRole('button');
      act(() => buttons[0]?.focus());
      fireEvent.keyDown(buttons[0] as HTMLElement, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(buttons[1]);
      fireEvent.keyDown(buttons[1] as HTMLElement, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(buttons[0]);
    });
  });

  describe('Appareils et synchro', () => {
    const slots = { pairing: <button type="button">{t('sync.pairing.show')}</button>, conflicts: null, version: null, forget: null, reset: null, carryReport: null };

    it('iPhone : section « Ajouter un appareil » avec l’appairage', async () => {
      mockViewport(440);
      await act(async () => {
        renderIn(<SyncDetailsScreen slots={slots} />);
      });
      const section = screen.getByRole('region', { name: 'Ajouter un appareil' });
      expect(within(section).getByRole('button', { name: t('sync.pairing.show') })).toBeInTheDocument();
    });

    it('PC : « Ajouter un iPhone » est une colonne à droite de l’état et des appareils', async () => {
      mockViewport(1440);
      await act(async () => {
        renderIn(<SyncDetailsScreen slots={slots} />);
      });
      const aside = screen.getByRole('region', { name: 'Ajouter un iPhone' });
      expect(within(aside).getByRole('button', { name: t('sync.pairing.show') })).toBeInTheDocument();
      const main = document.querySelector('.ct-sync__main');
      expect(main).not.toBeNull();
      expect((main as Element).compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    });
  });
});
