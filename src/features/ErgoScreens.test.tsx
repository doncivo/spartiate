import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../domain/hlc';
import type { DeviceId, LocalDate } from '../domain/types';
import { openBaseDb, type TestDb } from '../db/repositories/sql/testSetup';
import { AppContainerProvider } from './app/AppContainerContext';
import { createAppContainer } from './app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from './app/navigation';
import { BodyProgress } from './bodyProgress/BodyProgress';
import { CardioProgress } from './cardio/CardioProgress';
import { NutritionScreen } from './nutrition/NutritionScreen';
import { saveManualTarget } from './nutrition/useCases';
import { OnboardingFlow } from './onboarding/OnboardingFlow';
import { RecoveryProgress } from './recovery/RecoveryProgress';
import { AppearanceScreen } from './settings/AppearanceScreen';
import { BodyScreen } from './settings/BodyScreen';
import { ExportImportScreen } from './settings/ExportImportScreen';
import { SettingsScreen } from './settings/SettingsScreen';
import { SettingsScreenPc } from './settings/SettingsScreenPc';
import { TrainingScreen } from './training/TrainingScreen';

/**
 * ERGO-01b (décision d'Ali du 13/11) : règles de tous les écrans non refaits par ERGO-01, iPhone 440 px et PC 1 440 px. Sur chaque écran
 * principal : une seule action rouge (bouton primaire), titres de section en petites capitales bronze (classe partagée), blocs à plat
 * (aucune carte bordée) ; chiffre héros là où le bloc a un chiffre de tête (Stratégie, Profil).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e9' as DeviceId;
/** Titres de section des écrans, avant ERGO-01b : chacun doit porter la classe partagée. */
const SCREEN_TITLES = ['.ct-settings__section', '.ct-training__eyebrow', '.ct-nutrition__eyebrow', '.ct-body__section', '.ct-appearance__section', '.ct-bodyprogress__heading', '.ct-cardio__heading', '.ct-today__eyebrow'].join(', ');
/** Cartes des écrans, avant ERGO-01b : chacune doit être à plat. */
const SCREEN_CARDS = ['.ct-settings__card', '.ct-training__card', '.ct-nutrition__card', '.ct-body__card', '.ct-today__card', '.ct-supplements__panel', '.ct-supplements__form'].join(', ');

let db: TestDb;

function mockViewport(width: number): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= 1024 && query.includes('min-width: 1024px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function mount(node: ReactNode, route?: Route): HTMLElement {
  if (route) act(() => useNavigationStore.getState().navigate(route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } });
  return render(<AppContainerProvider container={container}>{node}</AppContainerProvider>).container;
}

/**
 * Attend que l'écran soit chargé (`ready` : par défaut, le premier titre de section, ancienne ou nouvelle classe), puis vérifie les règles.
 * Un écran sans section (liste des recettes, premier écran de l'onboarding) n'a pas de titre à exiger : `ready` désigne alors son contenu.
 */
async function expectRules(root: HTMLElement, ready = `${SCREEN_TITLES}, .ct-section-title`): Promise<void> {
  await waitFor(() => expect(root.querySelectorAll(ready).length).toBeGreaterThan(0));
  const primaries = root.querySelectorAll('.ct-button--primary');
  expect(primaries.length, [...primaries].map((b) => b.textContent).join(' | ')).toBeLessThanOrEqual(1);
  for (const title of root.querySelectorAll(SCREEN_TITLES)) expect(title, title.textContent ?? '').toHaveClass('ct-section-title');
  // La carte « Séance » (TodaySessionCard, en tête d'Entraînement comme d'Aujourd'hui) a été refaite par ERGO-01 (chiffre héros, carte gardée
  // comme dans l'aperçu du 12/11) : hors du périmètre « cartes » d'ERGO-01b ; son titre suit la règle commune.
  for (const card of root.querySelectorAll(SCREEN_CARDS)) if (!card.classList.contains('ct-session-card')) expect(card, card.className).toHaveClass('ct-flat');
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe.each([440, 1440])('ERGO-01b à %i px', (width) => {
  beforeEach(() => mockViewport(width));

  it('Plus (accueil des réglages)', async () => {
    await expectRules(mount(width >= 1024 ? <SettingsScreenPc /> : <SettingsScreen />, { tab: 'more', screen: 'home' }));
  });

  it.each([
    ['Apparence', () => <AppearanceScreen />],
    ['Profil et poids', () => <BodyScreen />],
    ['Export / import', () => <ExportImportScreen />],
  ])('Plus › %s', async (_name, node) => {
    await expectRules(mount(node()));
  });

  it.each(['routines', 'library', 'equipment', 'history', 'cardio'] as const)('Entraînement › %s', async (screenId) => {
    await expectRules(mount(<TrainingScreen />, { tab: 'training', screen: screenId }));
  });

  it.each(['strategy', 'checkin', 'supplements'] as const)('Nutrition › %s', async (screenId) => {
    await expectRules(mount(<NutritionScreen />, { tab: 'nutrition', screen: screenId }));
  });

  it('Nutrition › recettes (liste sans section)', async () => {
    await expectRules(mount(<NutritionScreen />, { tab: 'nutrition', screen: 'recipes' }), '.ct-recipe__list, .ct-nutrition__card');
  });

  it.each([
    ['Corps', () => <BodyProgress pickPhoto={() => Promise.resolve(null)} />],
    ['Cardio', () => <CardioProgress timeZone="Europe/Paris" />],
    ['Récupération', () => <RecoveryProgress />],
  ])('Progrès › %s', async (_name, node) => {
    await expectRules(mount(node()));
  });

  it('Onboarding (premier écran)', async () => {
    await expectRules(mount(<OnboardingFlow mode="first-launch" onClose={() => undefined} />), '#ct-onb-title');
  });
});

describe('ERGO-01b : chiffre héros (un par bloc)', () => {
  beforeEach(() => mockViewport(440));

  it('Stratégie : la cible actuelle est le chiffre héros de son bloc, l’unité à part', async () => {
    await saveManualTarget(db.data, { weekStart: '2026-11-09' as LocalDate, target: { kcal: 2000, proteinG: 150, fatG: 60, carbG: 200 }, lowFloorConfirmed: false });
    const root = mount(<NutritionScreen />, { tab: 'nutrition', screen: 'strategy' });
    await waitFor(() => expect(root.querySelector('#ct-nutrition-current')).not.toBeNull());
    const block = root.querySelector('section[aria-labelledby="ct-nutrition-current"]');
    await waitFor(() => expect(block?.querySelectorAll('.ct-hero__num')).toHaveLength(1));
    expect(block?.querySelector('.ct-hero')).toHaveTextContent(/^2\s000 kcal par jour$/);
  });

  it('Profil : le dernier poids est le chiffre héros du bloc Poids', async () => {
    await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-05' as LocalDate, kg: 82.4, timezone: 'Europe/Paris' }, '2026-11-05' as LocalDate);
    const root = mount(<BodyScreen />);
    await waitFor(() => expect(root.querySelectorAll('.ct-hero__num')).toHaveLength(1));
    expect(root.querySelector('.ct-hero__num')).toHaveTextContent('82,4');
  });
});
