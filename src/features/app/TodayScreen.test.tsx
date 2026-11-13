import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import type { SyncEngineService } from '../../platform/sync/types';
import { PC_MEDIA_QUERY } from '../../ui';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from './AppContainerContext';
import { createAppContainer } from './container';
import { INITIAL_NAVIGATION, useNavigationStore } from './navigation';
import { TodayScreen } from './TodayScreen';

const DEVICE = '60000000-0000-4000-8000-0000000000c9' as DeviceId;

function viewport(layout: 'pc' | 'mobile'): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === PC_MEDIA_QUERY && layout === 'pc',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('Aujourd’hui (I0) : planches iPhone et PC, valeurs réelles seulement', () => {
  let db: TestDb;
  const open = (sync?: SyncEngineService) => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, ...(sync ? { sync } : {}) });
    return render(
      <AppContainerProvider container={container}>
        <TodayScreen />
      </AppContainerProvider>,
    );
  };
  const seed = async (kgs: readonly number[]) => {
    const profiles = await db.data.repos.profile();
    await profiles.save({ heightCm: 178, birthYear: 1990, goal: 'gain', experience: 'intermediate' }, 2026);
    const weights = await db.data.repos.bodyWeights();
    for (const [i, kg] of kgs.entries()) {
      const day = String(4 - (kgs.length - 1 - i)).padStart(2, '0');
      await weights.saveManual({ date: `2026-11-${day}` as LocalDate, kg, timezone: 'Europe/Paris' }, '2026-11-04' as LocalDate);
    }
  };
  beforeEach(async () => {
    useNavigationStore.setState(INITIAL_NAVIGATION);
    db = await openBaseDb(DEVICE, '2026-11-04T08:00:00.000Z');
  });
  afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    await db.close();
  });

  describe('iPhone', () => {
    beforeEach(() => viewport('mobile'));

    it('sans profil : carte d’accueil, trois étapes, bouton principal vers Profil et poids, à venir, synchro non configurée', async () => {
      open();
      expect(await screen.findByRole('heading', { name: 'Aujourd’hui' })).toBeInTheDocument();
      expect(await screen.findByText('mercredi 4 novembre')).toBeInTheDocument();
      expect(screen.getByText('Trois réglages, puis on s’entraîne.')).toBeInTheDocument();
      const steps = screen.getAllByRole('listitem');
      expect(steps).toHaveLength(3);
      expect(within(steps[0] as HTMLElement).getByText('Profil')).toBeInTheDocument();
      expect(within(steps[1] as HTMLElement).getByText('Première pesée')).toBeInTheDocument();
      expect(within(steps[2] as HTMLElement).getByText('Relier le PC')).toBeInTheDocument();
      expect(screen.queryByText('programme Haut / Bas, charges proposées')).toBeNull();
      expect(screen.queryByText('journal, cibles, dépense mesurée')).toBeNull();
      expect(screen.queryByText('Arrive ensuite')).toBeNull();
      expect(await screen.findByText('Aucun résumé de récupération reçu de l’iPhone.')).toBeInTheDocument();
      expect(screen.getByText('Synchro non configurée')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Renseigner mon profil' }));
      expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'body' });
    });

    it('étape 3 : relier le PC mène à Synchro quand profil et pesée sont faits ; étapes faites cochées', async () => {
      await seed([81.4]);
      open();
      const steps = await screen.findAllByRole('listitem');
      expect(within(steps[0] as HTMLElement).getByRole('img', { name: 'fait' })).toBeInTheDocument();
      expect(within(steps[1] as HTMLElement).getByRole('img', { name: 'fait' })).toBeInTheDocument();
      expect(within(steps[2] as HTMLElement).queryByRole('img', { name: 'fait' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Relier le PC' }));
      expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'sync' });
    });

    it('profil fait sans pesée : le bouton mène à la pesée', async () => {
      const profiles = await db.data.repos.profile();
      await profiles.save({ heightCm: 178 }, 2026);
      open();
      fireEvent.click(await screen.findByRole('button', { name: 'Faire ma première pesée' }));
      expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'body' });
    });
  });

  describe('PC', () => {
    beforeEach(() => viewport('pc'));

    it('sans pesée ni profil : état vide sobre, valeurs « — », aucun faux zéro', async () => {
      open();
      expect(await screen.findByText('Aucune pesée pour l’instant.')).toBeInTheDocument();
      expect(screen.queryByText('Trois réglages, puis on s’entraîne.')).toBeNull();
      expect(screen.queryByText('Arrive avec les prochaines versions')).toBeNull();
      expect(await screen.findByText('Aucun résumé de récupération reçu de l’iPhone.')).toBeInTheDocument();
      // ERGO-01b P4 (D-238) : une seule carte « État » à droite (synchro, signature, Apple Santé, sauvegarde, dernier export) au lieu de
      // « Profil », « iPhone » et « Données » ; le profil se règle dans Plus › Profil et poids. Mêmes valeurs « — », aucun faux zéro.
      const state = screen.getByRole('region', { name: 'État' });
      expect(within(state).getAllByText('—')).toHaveLength(4);
      expect(within(state).getByText('non configurée')).toBeInTheDocument();
      for (const gone of ['Profil', 'iPhone', 'Données']) expect(screen.queryByRole('region', { name: gone })).toBeNull();
      expect(document.body.textContent ?? '').not.toMatch(/\b0\b/);
    });

    it('ERGO-01b P4 : Récupération en tête de la colonne principale, puis Séance et Nutrition ; une carte « État » à droite', async () => {
      const { container } = open();
      expect(await screen.findByText('Aucun résumé de récupération reçu de l’iPhone.')).toBeInTheDocument();
      const [main, aside] = [...container.querySelectorAll('.ct-today__col')];
      expect(main?.firstElementChild?.querySelector('h2')).toHaveTextContent('Récupération');
      const state = screen.getByRole('region', { name: 'État' });
      expect(aside?.contains(state)).toBe(true);
      expect(aside?.querySelectorAll('section')).toHaveLength(1);
      expect(within(state).getAllByRole('term').map((t) => t.textContent)).toEqual(['Synchro', 'Signature', 'Apple Santé', 'Sauvegarde', 'Dernier export']);
    });

    it('avec profil et pesées : dernier poids en grand, apprentissage, courbe, profil réel, boutons', async () => {
      await seed([82.2, 82, 81.9, 81.4]);
      open();
      expect(await screen.findByText('81,4')).toBeInTheDocument();
      expect(screen.getByText('en apprentissage')).toBeInTheDocument();
      expect(screen.getByText('4 pesées sur 14 nécessaires')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Courbe des pesées récentes' })).toBeInTheDocument();
      // ERGO-01b P4 (D-238) : le profil n'est plus une carte d'Aujourd'hui sur PC (maquette P4) ; il reste à un clic, « Profil et poids ».
      expect(screen.queryByText('178 cm')).toBeNull();
      expect(screen.queryByRole('region', { name: 'Profil' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Nouvelle pesée' }));
      expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'body' });
      useNavigationStore.setState(INITIAL_NAVIGATION);
      fireEvent.click(screen.getByRole('button', { name: 'Profil et poids' }));
      expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'body' });
    });
  });

  it('iPhone, étapes faites : la carte d’accueil disparaît, le poids courant reste', async () => {
    viewport('mobile');
    await seed([81.4]);
    const status = { phase: 'idle', lastSyncAt: '2026-11-04T07:58:00.000Z', folderLabel: null, devices: [], pendingFiles: [], conflictsThisWeek: 0, progress: null };
    open({ status: () => status, subscribe: () => () => undefined } as unknown as SyncEngineService);
    await screen.findByText('81,4');
    expect(screen.queryByText('Trois réglages, puis on s’entraîne.')).toBeNull();
  });
});
