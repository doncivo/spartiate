import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import ciqual from '../../../../content/food/ciqual.json';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';

/** BL-107 (C-187, licence Ouverte Etalab 2.0) : l'attribution Ciqual est affichée sous des résultats Ciqual, et seulement alors. */
const DEVICE = '60000000-0000-4000-8000-0000000000b7' as DeviceId;
const ATTRIBUTION = (ciqual as { source: { attribution: string } }).source.attribution;
let db: TestDb;
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

const search = async (query: string) => {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition' }));
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
  const r = await screen.findByRole('region', { name: 'Nutrition' });
  fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
  fireEvent.change(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: query } });
};

describe('BL-107 : attribution Ciqual', () => {
  it('résultats Ciqual : l’attribution du catalogue embarqué est écrite sous la liste', async () => {
    expect(ATTRIBUTION).toMatch(/Ciqual 2025/);
    await search('banane');
    expect(await screen.findByText(ATTRIBUTION)).toBeInTheDocument();
  });

  it('aucun résultat Ciqual (fiche perso seule) : pas d’attribution', async () => {
    await (await db.data.repos.foods()).create({ source: 'custom', barcode: null, name: 'Zzyxq maison', brand: null, per100g: { kcal: 60, proteinG: 11, fatG: 0.2, carbG: 4, fiberG: null }, fetchedAt: null });
    await search('zzyxq');
    expect(await screen.findByRole('button', { name: /Zzyxq maison/ })).toBeInTheDocument();
    expect(screen.queryByText(ATTRIBUTION)).toBeNull();
  });
});
