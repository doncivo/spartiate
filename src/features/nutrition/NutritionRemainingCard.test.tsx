import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate, LocalTime } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { quickAddDraft, saveManualTarget } from './useCases';
import { NutritionRemainingCard } from './NutritionRemainingCard';

/**
 * I4-03 critère 7 : « nutrition restante » sur Aujourd'hui. Seuls les restes de la cible et l'état utile ; bloc à la demande. Aucune cible :
 * on le dit, on ne montre pas de reste. Journée sans entrée : cible entière restante, jamais « 0 saisi ».
 */
const DEVICE = '60000000-0000-4000-8000-0000000000d3' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
let db: TestDb;
/** Testing Library normalise les espaces du DOM (fines insécables comprises) : même normalisation côté attendu. */
const fr = (n: number): string => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
/** ERGO-01 : la ligne est un chiffre h\u00e9ros et son unit\u00e9 (deux \u00e9l\u00e9ments) ; on lit le texte complet de la ligne, inchang\u00e9. */
const heroLine =
  (text: string) =>
  (_: string, el: Element | null): boolean =>
    (el?.classList.contains('ct-hero') ?? false) && (el?.textContent ?? '').replace(/[\u202f\u00a0]/g, ' ') === text;
const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <NutritionRemainingCard />
    </AppContainerProvider>,
  );

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('I4-03 : NutritionRemainingCard', () => {
  it('sans cible : l’état est dit et mène à la stratégie, aucun chiffre', async () => {
    mount();
    expect(await screen.findByText('Aucune cible définie')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/\d/);
    fireEvent.click(screen.getByRole('button', { name: 'Définir une cible' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'nutrition', screen: 'strategy' });
  });

  it('avec cible et une entrée : calories restantes, journée partielle, ouverture du journal', async () => {
    await saveManualTarget(db.data, { weekStart: '2026-11-01' as LocalDate, target: { kcal: 2400, proteinG: 170, fatG: 75, carbG: 261 }, lowFloorConfirmed: false });
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: '08:00' as LocalTime, name: 'Petit-déjeuner', kcal: 500, proteinG: 30, fatG: 10, carbG: 60 }));
    mount();
    expect(await screen.findByText(heroLine(`${fr(1900)} kcal restantes`))).toBeInTheDocument();
    expect(screen.getByText('Journée partielle')).toBeInTheDocument();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le journal' })));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'nutrition', screen: 'journal' });
  });

  it('journée déclarée incomplète avec trois prises sur 8 h : « partielle » sur la carte, comme dans le Journal (I4-07)', async () => {
    await saveManualTarget(db.data, { weekStart: '2026-11-01' as LocalDate, target: { kcal: 2400, proteinG: 170, fatG: 75, carbG: 261 }, lowFloorConfirmed: false });
    const repo = await db.data.repos.mealEntries();
    for (const time of ['07:00', '11:00', '15:00']) await repo.create(quickAddDraft({ date: TODAY, time: time as LocalTime, name: 'Prise', kcal: 500, proteinG: 30, fatG: 10, carbG: 60 }));
    await (await db.data.repos.dayCompleteness()).declare(TODAY, 'incomplete');
    mount();
    expect(await screen.findByText('Journée partielle')).toBeInTheDocument();
    expect(screen.queryByText('Journée complète (déduite)')).toBeNull();
  });

  it('journée sans entrée avec cible : cible entière restante et « rien de saisi » (pas de zéro)', async () => {
    await saveManualTarget(db.data, { weekStart: '2026-11-01' as LocalDate, target: { kcal: 2400, proteinG: 170, fatG: 75, carbG: 261 }, lowFloorConfirmed: false });
    mount();
    expect(await screen.findByText(heroLine(`${fr(2400)} kcal restantes`))).toBeInTheDocument();
    expect(screen.getByText('Rien de saisi aujourd’hui')).toBeInTheDocument();
  });
});

describe('PROG-01 : type de jour sur Aujourd’hui (D-270)', () => {
  const record = async (rest: boolean) =>
    (await db.data.repos.nutritionTargets()).record({
      weekStart: TODAY,
      target: { kcal: 2600, proteinG: 150, fatG: 80, carbG: 320 },
      source: 'manual',
      accepted: true,
      engineVersion: null,
      lowFloorConfirmed: false,
      // Lundi 9 novembre 2026 : jour d'entraînement si lundi est coché, repos sinon.
      ...(rest ? { restPlan: { rest: { kcal: 2400, proteinG: 150, fatG: 80, carbG: 270 }, trainingDays: [2, 4, 5, 6] as const } } : {}),
    } as never);

  it('avec une cible de repos, lundi non coché : « Jour de repos » et la cible de repos (2 400 kcal restantes)', async () => {
    await record(true);
    mount();
    expect(await screen.findByText('Jour de repos')).toBeInTheDocument();
    expect(screen.getByText(heroLine(`${fr(2400)} kcal restantes`))).toBeInTheDocument();
  });

  it('sans cible de repos : aucune mention, cible unique', async () => {
    await record(false);
    mount();
    expect(await screen.findByText(heroLine(`${fr(2600)} kcal restantes`))).toBeInTheDocument();
    expect(screen.queryByText('Jour de repos')).toBeNull();
    expect(screen.queryByText('Jour d’entraînement')).toBeNull();
  });
});
