import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { NutritionRemainingCard } from './NutritionRemainingCard';
import { NutritionScreen } from './NutritionScreen';
import { saveManualTarget } from './useCases';

/**
 * ERGO-01b P2 (D-238, maquette docs/maquettes/propositions/ergo-01-structure/P2-Nutrition-ajout-direct.svg) : « Ajouter un repas » sur
 * Aujourd'hui ouvre le Journal recherche ouverte, champ actif (paramètre de route `search`) : 3 taps au lieu de 4.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f2' as DeviceId;
let db: TestDb;
const mount = (node: React.ReactNode) => {
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(<AppContainerProvider container={container}>{node}</AppContainerProvider>);
};

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
  await saveManualTarget(db.data, { weekStart: '2026-11-09' as LocalDate, target: { kcal: 2000, proteinG: 150, fatG: 60, carbG: 200 }, lowFloorConfirmed: false });
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('ERGO-01b P2 : ajouter un repas en 3 taps', () => {
  it('Aujourd’hui : « Ajouter un repas » mène au Journal avec la recherche ouverte ; « Ouvrir le journal » reste', async () => {
    mount(<NutritionRemainingCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un repas' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'nutrition', screen: 'journal', search: true });
    expect(screen.getByRole('button', { name: 'Ouvrir le journal' })).toBeInTheDocument();
  });

  it('Journal ouvert avec `search` : le champ de recherche est là et actif, sans tap de plus', async () => {
    act(() => useNavigationStore.getState().navigate({ tab: 'nutrition', screen: 'journal', search: true } as Route));
    mount(<NutritionScreen />);
    const field = await screen.findByRole('searchbox', { name: 'Nom de l’aliment' });
    expect(field).toHaveFocus();
  });

  it('Journal ouvert sans `search` : inchangé (aucune recherche ouverte d’office)', async () => {
    act(() => useNavigationStore.getState().navigate({ tab: 'nutrition', screen: 'journal' } as Route));
    mount(<NutritionScreen />);
    expect(await screen.findByRole('button', { name: 'Rechercher un aliment' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Nom de l’aliment')).toBeNull();
  });
});
