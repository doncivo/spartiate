import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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


describe('C-101 : erreurs dites (§ 18.3)', () => {
  it('récents illisibles : le dit, jamais « apparaîtront ici »', async () => {
    const original = db.data.repos.mealEntries.bind(db.data.repos);
    vi.spyOn(db.data.repos, 'mealEntries').mockImplementation(async () => ({ ...(await original()), recentFoods: () => Promise.reject(new Error('boom')) }));
    await openSearch();
    expect(await screen.findByRole('alert')).toHaveTextContent('Les aliments récents n’ont pas pu être lus.');
    expect(screen.queryByText('Les aliments que tu ajoutes apparaîtront ici.')).toBeNull();
  });

  it('recherche illisible : le dit, jamais « Aucun résultat » ni « Ciqual indisponible »', async () => {
    await openSearch();
    vi.spyOn(db.data.repos, 'foods').mockRejectedValue(new Error('boom'));
    await typeQuery('skyr');
    expect(await screen.findByRole('alert')).toHaveTextContent('La recherche n’a pas pu être faite.');
    expect(screen.queryByText(/Aucun résultat/)).toBeNull();
  });

  it('journal illisible : message et bouton Réessayer qui relit', async () => {
    const original = db.data.repos.mealEntries.bind(db.data.repos);
    const spy = vi.spyOn(db.data.repos, 'mealEntries').mockRejectedValueOnce(new Error('boom'));
    mount();
    const r = await screen.findByRole('region', { name: 'Nutrition' });
    expect(await within(r).findByRole('alert')).toHaveTextContent('Nutrition n’a pas pu être lu.');
    spy.mockImplementation(original);
    fireEvent.click(within(r).getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(within(r).queryByRole('alert')).toBeNull());
  });
});

describe('C-102 : heure invalide, fiche périmée, Échap', () => {
  it('heure vidée : « Indique une heure valide. », jamais « quantité invalide »', async () => {
    await addCustom('Skyr maison');
    await openSearch();
    await typeQuery('skyr');
    fireEvent.click(await screen.findByRole('button', { name: /Skyr maison/ }));
    fireEvent.change(await screen.findByLabelText('Heure'), { target: { value: '' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Indique une heure valide.');
    expect(screen.queryByText(/quantité en grammes/)).toBeNull();
  });

  it('fiche OFF périmée choisie dans la liste : l’avertissement « plus de 90 jours » est dit', async () => {
    await (await db.data.repos.foods()).cacheOff({ source: 'off', barcode: '4006381333931', name: 'Skyr périmé', brand: null, per100g: per, fetchedAt: '2026-06-01T08:00:00.000Z' as never });
    await openSearch();
    await typeQuery('skyr');
    fireEvent.click(await screen.findByRole('button', { name: /Skyr périmé/ }));
    expect(await screen.findByText(/Fiche de plus de 90 jours/)).toBeInTheDocument();
  });

  it('Échap sur la quantité revient à la recherche (elle ne se ferme pas)', async () => {
    await addCustom('Skyr maison');
    await openSearch();
    await typeQuery('skyr');
    fireEvent.click(await screen.findByRole('button', { name: /Skyr maison/ }));
    fireEvent.keyDown(await screen.findByLabelText('Quantité (g)'), { key: 'Escape' });
    expect(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' })).toBeInTheDocument();
  });
});

describe('BL-117 : assiette et go-tos', () => {
  const addToPlateFlow = async (name: string, query: string, grams: string) => {
    await typeQuery(query);
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
    fireEvent.change(await screen.findByLabelText('Quantité (g)'), { target: { value: grams } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter à l’assiette' }));
  };

  it('assiette gardée à la fermeture de la recherche', async () => {
    await addCustom('Skyr maison');
    const r = await openSearch();
    await addToPlateFlow('Skyr maison', 'skyr', '150');
    await screen.findByRole('region', { name: 'Assiette' });
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la recherche' }));
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    const plate = await screen.findByRole('region', { name: 'Assiette' });
    expect(within(plate).getByLabelText('Quantité de Skyr maison (g)')).toHaveValue('150');
  });

  it('grammes modifiables dans l’assiette : le total suit', async () => {
    await addCustom('Skyr maison');
    await openSearch();
    await addToPlateFlow('Skyr maison', 'skyr', '100');
    const plate = await screen.findByRole('region', { name: 'Assiette' });
    expect(plate).toHaveTextContent('60 kcal');
    fireEvent.change(within(plate).getByLabelText('Quantité de Skyr maison (g)'), { target: { value: '250' } });
    expect(screen.getByRole('region', { name: 'Assiette' })).toHaveTextContent('150 kcal');
  });

  it('heure propre à un aliment : l’entrée écrite la porte', async () => {
    await addCustom('Skyr maison');
    await openSearch();
    await addToPlateFlow('Skyr maison', 'skyr', '100');
    const plate = await screen.findByRole('region', { name: 'Assiette' });
    fireEvent.change(within(plate).getByLabelText('Heure de Skyr maison'), { target: { value: '08:15' } });
    fireEvent.click(within(plate).getByRole('button', { name: 'Ajouter l’assiette au journal' }));
    const repo = await db.data.repos.mealEntries();
    await waitFor(async () => expect((await repo.listBetween('2000-01-01' as never, '2100-01-01' as never)).map((e) => e.time)).toEqual(['08:15']));
  });

  it('assiette enregistrée en recette : une recette d’une portion, l’assiette reste', async () => {
    await addCustom('Skyr maison');
    await openSearch();
    await addToPlateFlow('Skyr maison', 'skyr', '150');
    const plate = await screen.findByRole('region', { name: 'Assiette' });
    fireEvent.change(within(plate).getByLabelText('Nom de la recette'), { target: { value: 'Petit-déj' } });
    fireEvent.click(within(plate).getByRole('button', { name: 'Enregistrer en recette' }));
    expect(await within(plate).findByText('Recette enregistrée.')).toBeInTheDocument();
    const [recipe] = await (await db.data.repos.recipes()).list();
    expect(recipe).toMatchObject({ name: 'Petit-déj', servings: 1 });
    expect(recipe?.ingredients.map((i) => [i.name, i.grams])).toEqual([['Skyr maison', 150]]);
  });

  it('go-tos : un aliment pris 3 fois apparaît sous « Habituels », jamais sous 2 prises', async () => {
    const skyr = await addCustom('Skyr maison');
    const other = await addCustom('Miel local');
    const meals = await db.data.repos.mealEntries();
    for (const [food, name, days] of [[skyr, 'Skyr maison', ['2026-11-02', '2026-11-04', '2026-11-06']], [other, 'Miel local', ['2026-11-02', '2026-11-04']]] as const) {
      for (const day of days) await meals.create({ date: day as never, time: '08:00' as never, foodId: food.id, foodName: name, source: 'custom', grams: 100, kcal: 60, proteinG: 1, fatG: 1, carbG: 1, method: 'search', confidence: null });
    }
    await openSearch();
    const section = await screen.findByRole('region', { name: 'Habituels' });
    expect(within(section).getByText('Skyr maison')).toBeInTheDocument();
    expect(within(section).queryByText('Miel local')).toBeNull();
  });
});

describe('BL-117 (relecture) : quantité de l’assiette hors bornes', () => {
  it.each(['0', '15000', 'abc'])('« %s » : champ invalide, message dit, ajout au journal bloqué ; une valeur valide rétablit', async (bad) => {
    await addCustom('Skyr maison');
    await openSearch();
    await typeQuery('skyr');
    fireEvent.click(await screen.findByRole('button', { name: /Skyr maison/ }));
    fireEvent.change(await screen.findByLabelText('Quantité (g)'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter à l’assiette' }));
    const plate = await screen.findByRole('region', { name: 'Assiette' });
    const field = within(plate).getByLabelText('Quantité de Skyr maison (g)');
    fireEvent.change(field, { target: { value: bad } });
    expect(within(plate).getByRole('alert')).toHaveTextContent('Quantité de Skyr maison : plus de 0 et au plus 10 000 g.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(within(plate).getByRole('button', { name: 'Ajouter l’assiette au journal' })).toBeDisabled();
    fireEvent.change(field, { target: { value: '120' } });
    expect(within(plate).queryByRole('alert')).toBeNull();
    expect(within(plate).getByRole('button', { name: 'Ajouter l’assiette au journal' })).toBeEnabled();
  });
});
