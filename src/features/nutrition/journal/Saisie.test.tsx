import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { formatDayLong, tNutrition } from '../../../i18n/nutritionText';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';
import { quickAddDraft } from '../useCases';

/** FIX-SAISIE-NUTRI (C-095 à C-098) : base SQLite réelle (wasm), lundi 9 novembre 2026, valeurs synthétiques. */
const DEVICE = '60000000-0000-4000-8000-0000000000e8' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const TOMORROW = '2026-11-10' as LocalDate;
let db: TestDb;

const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
};
const region = () => screen.findByRole('region', { name: 'Nutrition' });
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

const listDay = async (date: LocalDate) => (await db.data.repos.mealEntries()).listByDate(date);

describe('C-095 : virgule décimale dans les champs numériques', () => {
  it('Quick Add : « 12,5 » g de protéines est enregistré 12,5 (jamais inconnu)', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: tNutrition('addQuick') }));
    expect(screen.getByLabelText(tNutrition('proteinLabel'))).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText(tNutrition('proteinLabel'))).toHaveAttribute('inputmode', 'decimal');
    type(tNutrition('kcalLabel'), '300');
    type(tNutrition('proteinLabel'), '12,5');
    fireEvent.click(screen.getByRole('button', { name: tNutrition('add') }));
    await waitFor(async () => expect((await listDay(TODAY)).map((e) => e.proteinG)).toEqual([12.5]));
  });
});

describe('C-096 : journal ouvert après minuit', () => {
  it('au retour au premier plan le journal affiche le jour courant et la saisie y est rattachée', async () => {
    open();
    const r = await region();
    expect(await within(r).findByText(formatDayLong(TODAY))).toBeInTheDocument();
    db.clock.advance(24 * 3_600_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await within(r).findByText(formatDayLong(TOMORROW))).toBeInTheDocument();
    fireEvent.click(await within(r).findByRole('button', { name: tNutrition('addQuick') }));
    type(tNutrition('kcalLabel'), '200');
    fireEvent.click(screen.getByRole('button', { name: tNutrition('add') }));
    await waitFor(async () => expect((await listDay(TOMORROW)).length).toBe(1));
    expect((await listDay(TODAY)).length).toBe(0);
  });
});

describe('C-097 : jour du formulaire figé', () => {
  it('Quick Add ouvert : « jour précédent » est désactivé et l’entrée va au jour affiché', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: tNutrition('addQuick') }));
    expect(within(r).getByRole('button', { name: tNutrition('previousDay') })).toBeDisabled();
    type(tNutrition('kcalLabel'), '150');
    fireEvent.click(screen.getByRole('button', { name: tNutrition('add') }));
    await waitFor(async () => expect((await listDay(TODAY)).length).toBe(1));
  });
});

describe('C-098 : supprimer une autre entrée', () => {
  it('la saisie de Quick Add en cours est conservée', async () => {
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: '08:00' as LocalTime, name: 'Petit-déjeuner', kcal: 400, proteinG: 20, fatG: 10, carbG: 50 }));
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: tNutrition('addQuick') }));
    type(tNutrition('kcalLabel'), '123');
    fireEvent.click(within(r).getByRole('button', { name: tNutrition('deleteEntry', { name: 'Petit-déjeuner' }) }));
    fireEvent.click(await screen.findByRole('button', { name: tNutrition('delete') }));
    await waitFor(async () => expect((await listDay(TODAY)).length).toBe(0));
    expect(screen.getByLabelText(tNutrition('kcalLabel'))).toHaveValue('123');
  });
});

describe('qa-test : cas limites', () => {
  it('Quick Add : 100 kcal et 5 000 g de protéines refusés avec un message dédié, rien d’écrit', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: tNutrition('addQuick') }));
    type(tNutrition('kcalLabel'), '100');
    type(tNutrition('proteinLabel'), '5000');
    fireEvent.click(screen.getByRole('button', { name: tNutrition('add') }));
    expect(await screen.findByText(tNutrition('macrosInconsistent'))).toBeInTheDocument();
    expect((await listDay(TODAY)).length).toBe(0);
  });

  it('supprimer l’entrée en cours de correction ferme la correction', async () => {
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: '08:00' as LocalTime, name: 'Petit-déjeuner', kcal: 400, proteinG: 20, fatG: 10, carbG: 50 }));
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: tNutrition('editEntry', { name: 'Petit-déjeuner' }) }));
    expect(await screen.findByLabelText(tNutrition('kcalLabel'))).toBeInTheDocument();
    fireEvent.click(within(r).getByRole('button', { name: tNutrition('deleteEntry', { name: 'Petit-déjeuner' }) }));
    fireEvent.click(await screen.findByRole('button', { name: tNutrition('delete') }));
    await waitFor(() => expect(screen.queryByLabelText(tNutrition('kcalLabel'))).toBeNull());
  });

  it('formulaire ouvert avant minuit : l’entrée reste rattachée au jour de l’ouverture', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: tNutrition('addQuick') }));
    db.clock.advance(24 * 3_600_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    type(tNutrition('kcalLabel'), '210');
    fireEvent.click(screen.getByRole('button', { name: tNutrition('add') }));
    await waitFor(async () => expect((await listDay(TODAY)).length).toBe(1));
    expect(await within(r).findByText(formatDayLong(TOMORROW))).toBeInTheDocument();
  });
});
