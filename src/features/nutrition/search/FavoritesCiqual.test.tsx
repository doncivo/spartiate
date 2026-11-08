import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';

vi.mock('../catalogue/ciqualCatalogue', () => ({
  loadCiqual: async () => {
    throw new Error('catalogue illisible');
  },
}));

/** I4-06 : un catalogue Ciqual illisible n'est pas « aliment disparu » : les favoris Ciqual sont conservés (D-79 point 3). */
const DEVICE = '60000000-0000-4000-8000-0000000000a8' as DeviceId;
let db: TestDb;
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('I4-06 : favoris Ciqual et catalogue en échec', () => {
  it('l’étoile suivante conserve les favoris Ciqual', async () => {
    const record = await (await db.data.repos.foods()).create({ source: 'custom', barcode: null, name: 'Skyr maison', brand: null, per100g: { kcal: 60, proteinG: 11, fatG: 0.2, carbG: 4, fiberG: null }, fetchedAt: null });
    await db.data.repos.settings.set('nutrition.favorites', { v: 1, items: [{ source: 'ciqual', ref: 'ciqual:20' }] });
    act(() => useNavigationStore.getState().navigate({ tab: 'nutrition' }));
    render(
      <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
        <NutritionScreen />
      </AppContainerProvider>,
    );
    const r = await screen.findByRole('region', { name: 'Nutrition' });
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: 'skyr' } });
    fireEvent.click(await screen.findByRole('button', { name: /Skyr maison/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Favori' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Favori' }));
    await waitFor(async () =>
      expect(await db.data.repos.settings.get('nutrition.favorites')).toEqual({ v: 1, items: [{ source: 'custom', ref: record.id }, { source: 'ciqual', ref: 'ciqual:20' }] }),
    );
  });
});
