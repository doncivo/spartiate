import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';
import { quickAddDraft } from '../useCases';

/**
 * I4-07 point 2.1 : contrôle « Journée complète » du Journal (Non déclarée / Complète / Incomplète). Base SQLite réelle (wasm), lundi 9
 * novembre 2026. La déclaration prime sur la déduction ; une journée sans entrée reste inconnue même déclarée complète.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000d7' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const YESTERDAY = '2026-11-08' as LocalDate;
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

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function seedTwoMeals(date: LocalDate): Promise<void> {
  const repo = await db.data.repos.mealEntries();
  await repo.create(quickAddDraft({ date, time: '13:00' as LocalTime, name: 'Déjeuner', kcal: 900, proteinG: 40, fatG: 30, carbG: 100 }));
  await repo.create(quickAddDraft({ date, time: '20:30' as LocalTime, name: 'Dîner', kcal: 1000, proteinG: 50, fatG: 30, carbG: 110 }));
}

const declared = async (date: LocalDate) => (await (await db.data.repos.dayCompleteness()).get(date))?.state ?? null;

describe('I4-07 : Journée complète (déclaration)', () => {
  it('trois états, « Non déclarée » par défaut ; la déduction s’applique tant que rien n’est déclaré', async () => {
    await seedTwoMeals(TODAY);
    open();
    const r = await region();
    const group = await within(r).findByRole('radiogroup', { name: 'Journée complète' });
    expect(within(group).getByRole('radio', { name: 'Non déclarée' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByRole('radio', { name: 'Complète' })).toHaveAttribute('aria-checked', 'false');
    expect(within(group).getByRole('radio', { name: 'Incomplète' })).toHaveAttribute('aria-checked', 'false');
    expect(await within(r).findByText('Journée partielle')).toBeInTheDocument();
  });

  it('deux prises à 13:00 et 20:30 déclarées complètes : couverture « déclarée », écrite en base, puis « Non déclarée » l’efface', async () => {
    await seedTwoMeals(TODAY);
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('radio', { name: 'Complète' }));
    expect(await within(r).findByText('Journée complète (déclarée)')).toBeInTheDocument();
    expect(within(r).queryByText('Journée partielle')).toBeNull();
    expect(await declared(TODAY)).toBe('complete');
    fireEvent.click(within(r).getByRole('radio', { name: 'Non déclarée' }));
    expect(await within(r).findByText('Journée partielle')).toBeInTheDocument();
    await waitFor(async () => expect(await declared(TODAY)).toBeNull());
  });

  it('déclarée incomplète : une journée qui serait déduite complète est dite incomplète (déclarée)', async () => {
    const repo = await db.data.repos.mealEntries();
    for (const time of ['07:00', '12:00', '19:00']) await repo.create(quickAddDraft({ date: TODAY, time: time as LocalTime, name: 'Prise', kcal: 600, proteinG: 30, fatG: 20, carbG: 70 }));
    open();
    const r = await region();
    expect(await within(r).findByText('Journée complète (déduite)')).toBeInTheDocument();
    fireEvent.click(within(r).getByRole('radio', { name: 'Incomplète' }));
    expect(await within(r).findByText('Journée incomplète (déclarée)')).toBeInTheDocument();
  });

  it('journée sans entrée déclarée complète : reste « Rien de saisi », nuance dite, aucun zéro', async () => {
    await (await db.data.repos.dayCompleteness()).declare(TODAY, 'complete');
    open();
    const r = await region();
    expect(await within(r).findByText('Rien de saisi aujourd’hui')).toBeInTheDocument();
    expect(within(r).getByText(/déclarée complète mais sans entrée/)).toBeInTheDocument();
    expect(within(r).getByRole('radio', { name: 'Complète' })).toHaveAttribute('aria-checked', 'true');
    expect(r.textContent ?? '').not.toMatch(/(^|\D)0 kcal/);
  });

  it('le dashboard reflète le jour déclaré (veille : partiel puis complet)', async () => {
    await seedTwoMeals(YESTERDAY);
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Jour précédent' }));
    fireEvent.click(await within(r).findByRole('radio', { name: 'Complète' }));
    expect(await within(r).findByText('Journée complète (déclarée)')).toBeInTheDocument();
    fireEvent.click(within(r).getByRole('radio', { name: 'Dashboard' }));
    expect(await within(r).findByText(/dim\. 8 nov\. : complet · 1 900 kcal/)).toBeInTheDocument();
  });
});
