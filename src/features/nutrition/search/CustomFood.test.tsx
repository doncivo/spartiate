import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';

/**
 * I4-03 critère 2 : fiche personnelle (provenance « Perso ») créée depuis la recherche quand rien n'est trouvé. Valeurs facultatives
 * laissées vides = inconnues (jamais 0) ; au moins une valeur nutritive ; portion facultative ; rien n'est écrit si la fiche est invalide.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000d4' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
let db: TestDb;

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition' }));
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function openCreate(query: string): Promise<void> {
  const r = await screen.findByRole('region', { name: 'Nutrition' });
  fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
  fireEvent.change(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: query } });
  fireEvent.click(await screen.findByRole('button', { name: 'Créer une fiche perso' }));
}

describe('I4-03 : Créer une fiche perso', () => {
  it('nom prérempli, valeurs vides inconnues, portion facultative ; la fiche est ensuite proposée à la quantité', async () => {
    await openCreate('zzzqqq');
    expect(await screen.findByLabelText('Nom de la fiche')).toHaveValue('zzzqqq');
    fireEvent.change(screen.getByLabelText('Calories pour 100 g (kcal)'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Protéines pour 100 g (g)'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Portion (facultatif) : nom'), { target: { value: 'pot' } });
    fireEvent.change(screen.getByLabelText('Portion : grammes'), { target: { value: '125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la fiche' }));
    expect(await screen.findByLabelText('Quantité (g)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pot · 125 g' })).toBeInTheDocument();
    const foods = await (await db.data.repos.foods()).list();
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ source: 'custom', name: 'zzzqqq', per100g: { kcal: 120, proteinG: 8, fatG: null, carbG: null, fiberG: null } });
    expect(await (await db.data.repos.foods()).listPortions(foods[0]?.id ?? '')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au journal' }));
    await waitFor(async () => expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(1));
    expect((await (await db.data.repos.mealEntries()).listByDate(TODAY))[0]).toMatchObject({ source: 'custom', foodName: 'zzzqqq', grams: 100 });
  });

  it('aucune valeur nutritive : refus dit, rien n’est écrit', async () => {
    await openCreate('zzzqqq');
    await screen.findByLabelText('Nom de la fiche');
    fireEvent.click(screen.getByRole('button', { name: 'Créer la fiche' }));
    expect(await screen.findByText('Renseigne au moins une valeur nutritive.')).toBeInTheDocument();
    expect(await (await db.data.repos.foods()).list()).toHaveLength(0);
  });

  it('nom vide : refus dit', async () => {
    await openCreate('zzzqqq');
    fireEvent.change(await screen.findByLabelText('Nom de la fiche'), { target: { value: '  ' } });
    fireEvent.change(screen.getByLabelText('Calories pour 100 g (kcal)'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la fiche' }));
    expect(await screen.findByText('Indique un nom.')).toBeInTheDocument();
    expect(await (await db.data.repos.foods()).list()).toHaveLength(0);
  });

  it('valeur hors limites (plus de 900 kcal pour 100 g) : refus dit', async () => {
    await openCreate('zzzqqq');
    fireEvent.change(await screen.findByLabelText('Calories pour 100 g (kcal)'), { target: { value: '1200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la fiche' }));
    expect(await screen.findByText('Une valeur n’est pas valide : 0 à 100 g pour 100 g, énergie jusqu’à 900 kcal.')).toBeInTheDocument();
    expect(await (await db.data.repos.foods()).list()).toHaveLength(0);
  });
});
