import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';

/** Lot 0.29.2 (C-099 à C-102, BL-117) : recherche du journal, clavier, erreurs dites, méthode d'enregistrement. */
const DEVICE = '60000000-0000-4000-8000-0000000000c2' as DeviceId;
let db: TestDb;
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

const per = { kcal: 60, proteinG: 11, fatG: 0.2, carbG: 4, fiberG: null };
const addCustom = async (name: string) => (await db.data.repos.foods()).create({ source: 'custom', barcode: null, name, brand: null, per100g: per, fetchedAt: null });
const mount = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition' }));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
};
const openSearch = async () => {
  mount();
  const r = await screen.findByRole('region', { name: 'Nutrition' });
  fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
  return r;
};
const typeQuery = async (q: string) => fireEvent.change(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: q } });

describe('C-099 : flèches des filtres', () => {
  it('une flèche sur un filtre de provenance garde le focus sur le filtre voisin, jamais dans les résultats', async () => {
    await addCustom('Skyr maison');
    await openSearch();
    await typeQuery('skyr');
    await screen.findByRole('button', { name: /Skyr maison/ });
    const filter = within(screen.getByRole('radiogroup', { name: 'Provenance' })).getByRole('radio', { name: 'Tout' });
    filter.focus();
    fireEvent.keyDown(filter, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('role')).toBe('radio');
  });
});

