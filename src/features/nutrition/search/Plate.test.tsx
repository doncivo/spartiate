import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tNutrition } from '../../../i18n/nutritionText';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';

/** NUTRI-c (§ 15.3) : l'assiette dans la recherche du Journal ; rien n'est écrit avant « Ajouter l'assiette au journal ». */
const DEVICE = '60000000-0000-4000-8000-0000000000c1' as DeviceId;
let db: TestDb;
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

const all = async () => (await db.data.repos.mealEntries()).listBetween('2000-01-01' as never, '2100-01-01' as never);

async function pick(name: string, query: string, grams: string): Promise<void> {
  fireEvent.change(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: query } });
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  fireEvent.change(await screen.findByRole('textbox', { name: tNutrition('quantityLabel') }), { target: { value: grams } });
  fireEvent.click(screen.getByRole('button', { name: tNutrition('plateAdd') }));
}

describe('NUTRI-c : assiette', () => {
  it('compose deux aliments, montre le total, écrit deux entrées seulement à la confirmation', async () => {
    const foods = await db.data.repos.foods();
    await foods.create({ source: 'custom', barcode: null, name: 'Skyr maison', brand: null, per100g: { kcal: 60, proteinG: 11, fatG: 0.2, carbG: 4, fiberG: null }, fetchedAt: null });
    await foods.create({ source: 'custom', barcode: null, name: 'Miel local', brand: null, per100g: { kcal: 300, proteinG: 0.3, fatG: 0, carbG: 80, fiberG: null }, fetchedAt: null });
    act(() => useNavigationStore.getState().navigate({ tab: 'nutrition' }));
    render(
      <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
        <NutritionScreen />
      </AppContainerProvider>,
    );
    const r = await screen.findByRole('region', { name: 'Nutrition' });
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    await pick('Skyr maison', 'skyr', '150');
    await pick('Miel local', 'miel', '20');
    const plate = await screen.findByRole('region', { name: tNutrition('plateTitle') });
    expect(within(plate).getByText(/Skyr maison/)).toBeTruthy();
    expect(within(plate).getByText(/Miel local/)).toBeTruthy();
    expect(within(plate).getByText(/150 kcal/)).toBeTruthy();
    expect(await all()).toHaveLength(0);
    fireEvent.click(within(plate).getByRole('button', { name: tNutrition('plateCommit') }));
    await waitFor(async () => expect(await all()).toHaveLength(2));
    const entries = await all();
    expect(entries.map((e) => e.foodName).sort()).toEqual(['Miel local', 'Skyr maison']);
    expect(entries.every((e) => e.method === 'search')).toBe(true);
  });

  it('double appui sur « Ajouter l’assiette au journal » : une seule écriture', async () => {
    const foods = await db.data.repos.foods();
    await foods.create({ source: 'custom', barcode: null, name: 'Skyr maison', brand: null, per100g: { kcal: 60, proteinG: 11, fatG: 0.2, carbG: 4, fiberG: null }, fetchedAt: null });
    const repo = await db.data.repos.mealEntries();
    const real = repo.createMany.bind(repo);
    const spy = vi.spyOn(repo, 'createMany').mockImplementation(async (drafts) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return real(drafts);
    });
    act(() => useNavigationStore.getState().navigate({ tab: 'nutrition' }));
    render(
      <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
        <NutritionScreen />
      </AppContainerProvider>,
    );
    const r = await screen.findByRole('region', { name: 'Nutrition' });
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    await pick('Skyr maison', 'skyr', '150');
    const button = within(await screen.findByRole('region', { name: tNutrition('plateTitle') })).getByRole('button', { name: tNutrition('plateCommit') });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(async () => expect(await all()).toHaveLength(1));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
