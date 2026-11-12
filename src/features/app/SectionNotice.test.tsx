import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from './AppContainerContext';
import { createAppContainer } from './container';
import { BodyProgress, NutritionRemainingCard, RecoveryProgress, RecoveryToday, TodaySessionCard } from './lazyScreens';
import { INITIAL_NAVIGATION, useNavigationStore } from './navigation';
import { SectionNotice } from './SectionNotice';

const DEVICE = '60000000-0000-4000-8000-0000000000c9' as DeviceId;

describe('sections I0 : états explicites, sans faux zéro ni bouton mort (SPA-009 critères 1 et 4)', () => {
  let db: TestDb;
  const open = (tab: 'today' | 'training' | 'nutrition' | 'progress') => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    return render(
      <AppContainerProvider container={container}>
        <SectionNotice tab={tab} />
      </AppContainerProvider>,
    );
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

  it.each([
    ['training', 'Entraînement'],
    ['nutrition', 'Nutrition'],
    ['progress', 'Progrès'],
  ] as const)('%s : titre, explication de l’indisponibilité, aucun bouton, aucun chiffre', async (tab, title) => {
    open(tab);
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(/arrive avec une prochaine version/)).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(document.body.textContent ?? '').not.toMatch(/\d/);
  });

  it('progress : la section Récupération (journal de facteurs, I6-01) est chargée à la demande sous l’explication', async () => {
    // I6-02 : deux blocs à la demande sous Progrès (Récupération, Corps) ; leur import à froid est fait avant l'attente (aucun délai allongé).
    await Promise.all([RecoveryProgress.preload(), BodyProgress.preload()]);
    open('progress');
    expect(await screen.findByRole('region', { name: 'Récupération : ce qui change ta Recovery' })).toBeInTheDocument();
    expect(screen.getByText(/Aucun jour renseigné/)).toBeInTheDocument();
  });

  it('progress : la section Corps (mensurations, photos de progression, I6-02) est chargée à la demande', async () => {
    await BodyProgress.preload();
    open('progress');
    expect(await screen.findByRole('region', { name: 'Mensurations' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Photos de progression' })).toBeInTheDocument();
  });

  it('Aujourd’hui : rend l’écran I0 (iPhone) ; sans profil, le bouton principal ouvre Profil et poids', async () => {
    // I6-02 (CI 43206818645) : l'import à froid des cartes d'Aujourd'hui dépassait la seconde de `findBy` sur un runner chargé ; il est fait avant l'attente (aucun délai allongé).
    await Promise.all([RecoveryToday.preload(), TodaySessionCard.preload(), NutritionRemainingCard.preload()]);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    open('today');
    // Requête par texte et sélecteur : la requête par rôle calcule l'arbre d'accessibilité de toute la page (lent sous couverture, sur un runner chargé).
    // Diagnostic (CI 12/11, échec intermittent sur un runner chargé) : si l'en-tête manque, l'échec dit ce que la page contenait.
    try {
      expect(await screen.findByText('Aujourd’hui', { selector: 'h1' })).toBeInTheDocument();
    } catch (error) {
      throw new Error(`En-tête d’Aujourd’hui absent ; page : ${document.body.innerHTML.slice(0, 1500)} ; cause : ${String(error)}`);
    }
    expect(await screen.findByText('Trois réglages, puis on s’entraîne.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Renseigner mon profil' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'body' });
  });
});
