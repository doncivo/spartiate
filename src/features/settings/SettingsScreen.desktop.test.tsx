import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { createFakeDesktop, fakePendingUpdate, type FakeDesktop } from '../../platform/desktop/testing';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { updaterStore } from '../updater';
import { SettingsScreen } from './SettingsScreen';

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000d2');

// UI-REFONTE-09 : sur PC les titres de section sont en minuscules (« Préférences », « À propos et diagnostic »).
describe('SettingsScreen PC (D-02, D-03)', () => {
  let db: TestDb;
  let desktop: FakeDesktop;
  let container: AppContainer;

  const containerWith = (d: FakeDesktop | null): AppContainer =>
    createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, desktop: d });
  const renderScreen = (c: AppContainer = container) =>
    render(
      <AppContainerProvider container={c}>
        <SettingsScreen />
      </AppContainerProvider>,
    );
  // ERGO-02 : sur PC, un réglage s'ouvre dans le panneau de droite après un clic sur son entrée de la liste.
  const GENERAL = /^Fuseau et démarrage/;
  const ABOUT = /^À propos et diagnostic/;
  const open = async (name: RegExp): Promise<void> => {
    fireEvent.click(await screen.findByRole('button', { name }));
  };
  const startup = () => screen.getByRole('switch', { name: 'Démarrer avec Windows' });

  beforeEach(async () => {
    db = await openTestDb(DEVICE);
    desktop = createFakeDesktop();
    container = containerWith(desktop);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    await db.close();
  });

  describe('démarrage avec Windows (D-02)', () => {
    it('hors PC : pas de ligne « Démarrer avec Windows » ni de ligne de mise à jour (critère 1 ; Préférences porte le fuseau de T-11 ; À propos et diagnostic ne porte que le guide, P-05)', async () => {
      renderScreen(containerWith(null));
      await open(GENERAL);
      expect(screen.queryByRole('switch', { name: 'Démarrer avec Windows' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: ABOUT })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Rechercher une mise à jour' })).not.toBeInTheDocument();
    });

    it('sur PC : section Préférences, interrupteur désactivé par défaut (critère 1)', async () => {
      renderScreen();
      await open(GENERAL);
      await waitFor(() => expect(startup()).toHaveAttribute('aria-checked', 'false'));
    });

    it('activer crée l’entrée et mémorise le réglage local ; désactiver la supprime (critères 2 et 3)', async () => {
      renderScreen();
      await open(GENERAL);
      startup().click();
      await waitFor(() => expect(startup()).toHaveAttribute('aria-checked', 'true'));
      await waitFor(() => expect(desktop.autostart).toBe(true));
      await waitFor(async () => expect(await db.data.repos.settings.get('desktop.launchAtStartup')).toBe(true));
      startup().click();
      await waitFor(() => expect(desktop.autostart).toBe(false));
      await waitFor(async () => expect(await db.data.repos.settings.get('desktop.launchAtStartup')).toBe(false));
    });

    it('entrée retirée hors de l’app : l’interrupteur reflète l’état réel et le réglage local est réaligné (critère 6)', async () => {
      await db.data.repos.settings.set('desktop.launchAtStartup', true);
      desktop.autostart = false;
      renderScreen();
      await open(GENERAL);
      await waitFor(() => expect(startup()).toHaveAttribute('aria-checked', 'false'));
      await waitFor(async () => expect(await db.data.repos.settings.get('desktop.launchAtStartup')).toBe(false));
    });

    it('entrée présente : interrupteur activé à l’ouverture', async () => {
      desktop.autostart = true;
      renderScreen();
      await open(GENERAL);
      await waitFor(() => expect(startup()).toHaveAttribute('aria-checked', 'true'));
    });

    it('échec du registre : retour à l’état précédent et message', async () => {
      renderScreen();
      await open(GENERAL);
      desktop.failAutostart = true;
      startup().click();
      expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de modifier le démarrage avec Windows.');
      expect(startup()).toHaveAttribute('aria-checked', 'false');
      expect(await db.data.repos.settings.get('desktop.launchAtStartup')).toBe(false);
    });
  });

  describe('À propos (D-03)', () => {
    it('affiche la version installée et le bouton de recherche (critère 7)', async () => {
      // I-06 : la version vient du conteneur (lue au démarrage par platform/appVersion.ts, même lecteur que DesktopPlatform.getVersion).
      renderScreen(createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, desktop, appVersion: { ok: true, version: '0.1.0', source: 'runtime' } }));
      await open(ABOUT);
      expect(await screen.findByText('Version 0.1.0')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rechercher une mise à jour' })).toBeEnabled();
    });

    it('updater non configuré (D-30) : « Mises à jour : non configurées (SPA-002) », pas de bouton de vérification, aucune requête', async () => {
      desktop.updaterConfigured = false;
      renderScreen();
      await open(ABOUT);
      expect(await screen.findByText('Mises à jour : non configurées (SPA-002)')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Rechercher une mise à jour' })).not.toBeInTheDocument();
      expect(desktop.checks).toBe(0);
    });

    it('à jour : « Spartiate est à jour »', async () => {
      renderScreen();
      await open(ABOUT);
      (await screen.findByRole('button', { name: 'Rechercher une mise à jour' })).click();
      expect(await screen.findByText('Spartiate est à jour')).toBeInTheDocument();
    });

    it('latest.json inaccessible : « Impossible de vérifier les mises à jour »', async () => {
      desktop.nextCheck = new Error('hors ligne');
      renderScreen();
      await open(ABOUT);
      (await screen.findByRole('button', { name: 'Rechercher une mise à jour' })).click();
      expect(await screen.findByText('Impossible de vérifier les mises à jour')).toBeInTheDocument();
    });

    it('nouvelle version : l’état du store propose le bandeau (rendu par la coquille)', async () => {
      desktop.nextCheck = fakePendingUpdate('1.2.0');
      renderScreen();
      await open(ABOUT);
      (await screen.findByRole('button', { name: 'Rechercher une mise à jour' })).click();
      await waitFor(() => expect(updaterStore.get(container).getState()).toMatchObject({ status: 'available', bannerVisible: true }));
    });

    it('le lien « Dernière version » ouvre la page des versions', async () => {
      renderScreen();
      await open(ABOUT);
      (await screen.findByRole('button', { name: 'Ouvrir la page de la dernière version' })).click();
      await waitFor(() => expect(desktop.openedReleases).toBe(1));
    });

    it('échec d’ouverture du lien : message', async () => {
      desktop.openLatestRelease = () => Promise.reject(new Error('navigateur introuvable'));
      renderScreen();
      await open(ABOUT);
      (await screen.findByRole('button', { name: 'Ouvrir la page de la dernière version' })).click();
      expect(await screen.findByRole('alert')).toHaveTextContent('Impossible d’ouvrir la page de la dernière version.');
    });
  });
});
