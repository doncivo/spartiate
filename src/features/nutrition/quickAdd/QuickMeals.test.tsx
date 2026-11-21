import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { MealEntryDraft } from '../../../domain/nutrition';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tNutrition } from '../../../i18n/nutritionText';
import { tQuick } from '../../../i18n/nutritionQuickText';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';

/** REPAS-029a : repas rapides (copie d'hier, récents, favoris), aperçu aux quantités modifiables, écriture tout ou rien. Base SQLite réelle. */
const DEVICE = '60000000-0000-4000-8000-0000000000e9' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const YESTERDAY = '2026-11-08' as LocalDate;
let db: TestDb;

const entry = (over: Partial<MealEntryDraft>): MealEntryDraft => ({
  date: YESTERDAY, time: '08:00' as LocalTime, foodId: 'ciqual:1000', foodName: 'Pain test', source: 'ciqual', grams: 100,
  kcal: 250, proteinG: 8, fatG: 2, carbG: 50, method: 'search', confidence: null, ...over,
});

function open(data = db.data) {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition', screen: 'journal' } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data })}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
}
const todayEntries = async () => (await db.data.repos.mealEntries()).listByDate(TODAY);

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function openPanel(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: tNutrition('quickMealsOpen') }));
}

describe('repas rapides (REPAS-029a)', () => {
  it('copier la journée d\'hier : aperçu, quantité modifiable, rien d\'écrit avant « Ajouter », puis tout écrit', async () => {
    const repo = await db.data.repos.mealEntries();
    await repo.createMany([entry({}), entry({ time: '12:30' as LocalTime, foodId: null, foodName: 'Café', source: 'manual', grams: null, method: 'quickadd', kcal: 5, proteinG: null, fatG: null, carbG: null })]);
    open();
    await openPanel();
    fireEvent.click(await screen.findByRole('button', { name: tQuick('copyDay') }));
    expect(await screen.findByText(tQuick('previewHint'))).toBeTruthy();
    expect(await todayEntries()).toHaveLength(0);
    fireEvent.change(screen.getByRole('textbox', { name: tQuick('gramsOf', { name: 'Pain test' }) }), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: tQuick('add') }));
    await waitFor(async () => expect(await todayEntries()).toHaveLength(2));
    const written = await todayEntries();
    expect(written.find((e) => e.foodName === 'Pain test')).toMatchObject({ grams: 50, kcal: 125, source: 'ciqual', method: 'search' });
    expect(written.find((e) => e.foodName === 'Café')).toMatchObject({ kcal: 5, fatG: null, method: 'quickadd' });
  });

  it('hier vide : message, jamais un repas vide', async () => {
    open();
    await openPanel();
    fireEvent.click(await screen.findByRole('button', { name: tQuick('copyDay') }));
    expect(await screen.findByText(tQuick('noDayYesterday'))).toBeTruthy();
    expect(screen.queryByText(tQuick('previewHint'))).toBeNull();
  });

  it('quantité invalide : « Ajouter » grisé, rien n\'est écrit', async () => {
    await (await db.data.repos.mealEntries()).createMany([entry({})]);
    open();
    await openPanel();
    fireEvent.click(await screen.findByRole('button', { name: tQuick('copyDay') }));
    fireEvent.change(await screen.findByRole('textbox', { name: tQuick('gramsOf', { name: 'Pain test' }) }), { target: { value: '0' } });
    expect((screen.getByRole('button', { name: tQuick('add') }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe(tQuick('invalid'));
    expect(await todayEntries()).toHaveLength(0);
  });

  it('favori : enregistré depuis l\'aperçu (nom obligatoire), rejoué à l\'heure courante, une entrée par aliment', async () => {
    await (await db.data.repos.mealEntries()).createMany([entry({}), entry({ foodId: 'ciqual:2000', foodName: 'Yaourt test', grams: 125, kcal: 80, proteinG: 5, fatG: 3, carbG: 6 })]);
    open();
    await openPanel();
    fireEvent.click(await screen.findByRole('button', { name: tQuick('copyDay') }));
    fireEvent.click(await screen.findByRole('button', { name: tQuick('favoriteSave') }));
    expect((await screen.findAllByRole('alert'))[0]?.textContent).toBe(tQuick('favoriteNameNeeded'));
    fireEvent.change(screen.getByLabelText(tQuick('favoriteName')), { target: { value: 'Petit-déj type' } });
    fireEvent.click(screen.getByRole('button', { name: tQuick('favoriteSave') }));
    expect(await screen.findByText(tQuick('favoriteSaved', { name: 'Petit-déj type' }))).toBeTruthy();
    expect((await (await db.data.repos.recipes()).list()).map((r) => [r.name, r.servings, r.ingredients.length])).toEqual([['Petit-déj type', 1, 2]]);
    fireEvent.click(screen.getByRole('button', { name: tQuick('back') }));
    fireEvent.click(await screen.findByRole('button', { name: tQuick('favoriteButton', { name: 'Petit-déj type' }) }));
    fireEvent.click(await screen.findByRole('button', { name: tQuick('add') }));
    await waitFor(async () => expect(await todayEntries()).toHaveLength(2));
    const written = await todayEntries();
    expect(new Set(written.map((e) => e.time)).size).toBe(1);
    expect(written.map((e) => e.foodName).sort()).toEqual(['Pain test', 'Yaourt test']);
    expect(written.every((e) => e.date === TODAY)).toBe(true);
  });

  it('récents : le repas d\'un jour passé se reprend en un geste après l\'aperçu', async () => {
    await (await db.data.repos.mealEntries()).createMany([entry({ date: '2026-11-05' as LocalDate })]);
    open();
    await openPanel();
    const button = await screen.findByRole('button', { name: /^Reprendre : / });
    fireEvent.click(button);
    fireEvent.click(await screen.findByRole('button', { name: tQuick('add') }));
    await waitFor(async () => expect(await todayEntries()).toHaveLength(1));
  });
});
