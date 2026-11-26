import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from './AppContainerContext';
import { createAppContainer } from './container';
import { BodyProgress, CardioProgress, NutritionRemainingCard, RecoveryProgress, RecoveryToday, TodaySessionCard } from './lazyScreens';
import { INITIAL_NAVIGATION, useNavigationStore } from './navigation';
import { SectionNotice } from './SectionNotice';

const DEVICE = '60000000-0000-4000-8000-0000000000c9' as DeviceId;

/** PROG-0301a (BL-177) : Progrès en onglets ; ouvre l'onglet (et le sous-onglet de Corps) où vit le bloc. */
async function openProgressTab(tab: string, body?: string): Promise<HTMLElement> {
  fireEvent.click(within(await screen.findByRole('tablist', { name: 'Progrès' })).getByRole('tab', { name: tab }));
  const panel = await screen.findByRole('tabpanel', { name: tab });
  if (!body) return panel;
  fireEvent.click(within(await within(panel).findByRole('tablist', { name: 'Corps' })).getByRole('tab', { name: body }));
  return within(panel).findByRole('tabpanel', { name: body });
}

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
    // ERGO-01 (D-193) : Progrès montre Récupération et Corps ; « arrive avec une prochaine version » y était faux (ErgoToday.test.tsx).
  ] as const)('%s : titre, explication de l’indisponibilité, aucun bouton, aucun chiffre', async (tab, title) => {
    open(tab);
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(/arrive avec une prochaine version/)).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(document.body.textContent ?? '').not.toMatch(/\d/);
  });

  it('progress : la section Récupération (journal de facteurs, I6-01) est chargée à la demande sous l’explication', async () => {
    // I6-02 : deux blocs à la demande sous Progrès (Récupération, Corps) ; leur import à froid est fait avant l'attente (aucun délai allongé).
    await Promise.all([RecoveryProgress.preload(), BodyProgress.preload(), import('./SectionNoticeProgress')]);
    open('progress');
    // PROG-0301a : Récup est le premier onglet, ouvert par défaut.
    expect(await within(await screen.findByRole('tabpanel', { name: 'Récup' })).findByRole('region', { name: 'Récupération : ce qui change ta Recovery' })).toBeInTheDocument();
    expect(screen.getByText(/Aucun jour renseigné/)).toBeInTheDocument();
  });

  it('progress : I6-06, la carte Cardio (quatre semaines) est chargée à la demande, sans faux zéro', async () => {
    await Promise.all([CardioProgress.preload(), import('./SectionNoticeProgress')]);
    open('progress');
    const panel = await openProgressTab('Activité');
    expect(await within(panel).findByRole('region', { name: 'Cardio' })).toBeInTheDocument();
    expect(await within(panel).findByText('Aucune séance de cardio sur les quatre dernières semaines.')).toBeInTheDocument();
  });

  it('progress : STR-01, la carte Strength Score est chargée à la demande ; sans profil, elle le dit et ne chiffre rien', async () => {
    // Import à froid fait avant l'attente (comme I6-02) : le bloc, ses normes et le catalogue ; aucun délai allongé.
    await Promise.all([import('../strength/StrengthScore'), import('../../../content/strength/standards.json'), import('../../../content/exercises/exercises.json'), import('./SectionNoticeProgress')]);
    open('progress');
    await openProgressTab('Force');
    expect(await screen.findByRole('region', { name: 'Strength Score' })).toBeInTheDocument();
    expect(await screen.findByText('Sexe non renseigné dans le profil : les normes dépendent du sexe.')).toBeInTheDocument();
    expect(screen.queryByText(/global ·/)).toBeNull();
  });

  it('progress : la section Corps (mensurations, photos de progression, I6-02) est chargée à la demande', async () => {
    await Promise.all([BodyProgress.preload(), import('./SectionNoticeProgress')]);
    open('progress');
    expect(await within(await openProgressTab('Corps', 'Mesures')).findByRole('region', { name: 'Mensurations' })).toBeInTheDocument();
    expect(await within(await openProgressTab('Corps', 'Photos')).findByRole('region', { name: 'Photos de progression' })).toBeInTheDocument();
  });

  it('PROG-0301a (D-719) : onglet et sous-onglet retenus quand Progrès est remonté ; un seul panneau rendu à la fois', async () => {
    await Promise.all([BodyProgress.preload(), import('./SectionNoticeProgress')]);
    open('progress');
    await openProgressTab('Corps', 'VISBODY');
    expect(screen.queryByRole('region', { name: 'Tendances sur 30 jours' })).toBeNull();
    cleanup();
    open('progress');
    expect((await screen.findByRole('tab', { name: 'Corps' })).getAttribute('aria-selected')).toBe('true');
    expect(await within(await screen.findByRole('tabpanel', { name: 'VISBODY' })).findByRole('region', { name: 'Bilans VISBODY' })).toBeInTheDocument();
    act(() => useNavigationStore.getState().goToTab('progress'));
    act(() => useNavigationStore.getState().goToTab('progress'));
    expect(await screen.findByRole('tabpanel', { name: 'Récup' })).toBeInTheDocument();
    expect(useNavigationStore.getState().progressView).toEqual({ tab: 'recovery', body: 'measures' });
  });

  it('Aujourd’hui : rend l’écran I0 (iPhone) ; sans profil, le bouton principal ouvre Profil et poids', async () => {
    // I6-02 (CI 43206818645) : l'import à froid des cartes d'Aujourd'hui dépassait la seconde de `findBy` sur un runner chargé ; il est fait avant l'attente (aucun délai allongé).
    await Promise.all([RecoveryToday.preload(), TodaySessionCard.preload(), NutritionRemainingCard.preload()]);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    // FIX-0116 (CI 43227901460, page complète mais attente expirée) : le premier rendu d'Aujourd'hui, sous couverture sur un runner chargé, bloque le fil plus d'une seconde ;
    // `findBy` expire alors pendant ce bloc, même si la page est prête. Un premier rendu à blanc (chauffe) puis le rendu mesuré dans `act` sortent ce travail de l'attente ; les délais ne bougent pas.
    open('today');
    await act(async () => undefined);
    cleanup();
    await act(async () => {
      open('today');
    });
    expect(screen.getByText('Aujourd’hui', { selector: 'h1' })).toBeInTheDocument();
    expect(await screen.findByText('Trois réglages, puis on s’entraîne.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Renseigner mon profil' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'body' });
  });
});
