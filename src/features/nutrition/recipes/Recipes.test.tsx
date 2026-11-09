import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RecipeDraft } from '../../../domain/nutrition';
import type { DeviceId, LocalDate } from '../../../domain/types';
import type { DataAccess, Repositories } from '../../../db/repositories/dataAccess';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';

/**
 * I4-07 point 2.2 / 2.5 : recettes (liste, création, modification, ajout au journal avec instantané, suppression avec confirmation, recherche
 * du Journal). Base SQLite réelle (wasm), lundi 9 novembre 2026. Un nutriment inconnu s'affiche « — » avec sa cause.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000d8' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
let db: TestDb;

function open(screenId: 'journal' | 'recipes' = 'recipes', data: DataAccess = db.data) {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition', screen: screenId } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data })}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
}
const region = () => screen.findByRole('region', { name: 'Nutrition' });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function seedFoods(): Promise<void> {
  const foods = await db.data.repos.foods();
  await foods.create({ source: 'custom', barcode: null, name: 'Riz test', brand: null, per100g: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbG: 28, fiberG: 0.4 }, fetchedAt: null });
  await foods.create({ source: 'custom', barcode: null, name: 'Sauce test', brand: null, per100g: { kcal: 100, proteinG: 1, fatG: 8, carbG: 6, fiberG: null }, fetchedAt: null });
}

const draft = (over: Partial<RecipeDraft> = {}): RecipeDraft => ({
  name: 'Bol de riz',
  servings: 2,
  cookedWeightG: null,
  ingredients: [
    { name: 'Riz test', source: 'custom', foodRef: null, grams: 200, per100g: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbG: 28, fiberG: 0.4 } },
    { name: 'Sauce test', source: 'custom', foodRef: null, grams: 50, per100g: { kcal: 100, proteinG: 1, fatG: 8, carbG: 6, fiberG: null } },
  ],
  ...over,
});

async function addIngredient(r: HTMLElement, search: string, hit: RegExp, grams: string): Promise<void> {
  fireEvent.click(within(r).getByRole('button', { name: 'Ajouter un ingrédient' }));
  fireEvent.change(await screen.findByRole('searchbox', { name: 'Chercher un ingrédient' }), { target: { value: search } });
  fireEvent.click(await screen.findByRole('button', { name: hit }));
  fireEvent.change(await screen.findByLabelText('Grammes'), { target: { value: grams } });
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter à la recette' }));
}

const entries = async () => (await db.data.repos.mealEntries()).listByDate(TODAY);

describe('I4-07 : Recettes (section de Nutrition)', () => {
  it('liste vide : message et « Nouvelle recette »', async () => {
    open();
    const r = await region();
    expect(await within(r).findByText('Aucune recette. Crée la première.')).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: 'Nouvelle recette' })).toBeInTheDocument();
  });

  it('parcours : créer (2 ingrédients dont un à fibres inconnues), ajouter au journal, modifier sans changer l’entrée, supprimer avec confirmation', async () => {
    await seedFoods();
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Nouvelle recette' }));
    fireEvent.change(await within(r).findByLabelText('Nom de la recette'), { target: { value: 'Bol de riz' } });
    fireEvent.change(within(r).getByLabelText('Nombre de portions'), { target: { value: '2' } });
    await addIngredient(r, 'riz test', /Riz test/, '200');
    await addIngredient(r, 'sauce test', /Sauce test/, '50');

    // Totaux : kcal connues, fibres inconnues dans la sauce -> « — » et la cause, jamais une somme partielle.
    const kcal = await within(r).findByRole('row', { name: /Énergie/ });
    expect(kcal).toHaveTextContent('310');
    expect(kcal).toHaveTextContent('155');
    const fiber = within(r).getByRole('row', { name: /Fibres/ });
    expect(fiber).toHaveTextContent('—');
    expect(fiber).toHaveTextContent('inconnu dans : Sauce test');
    expect(fiber).not.toHaveTextContent('0,8');
    // Rien n'est écrit avant l'enregistrement.
    expect(await (await db.data.repos.recipes()).list()).toHaveLength(0);
    fireEvent.click(within(r).getByRole('button', { name: 'Enregistrer la recette' }));

    const item = await within(r).findByRole('listitem', { name: /Bol de riz/ });
    expect(item).toHaveTextContent('2 portions');
    expect(item).toHaveTextContent('155 kcal / portion');
    const saved = (await (await db.data.repos.recipes()).list())[0];
    expect(saved?.ingredients).toHaveLength(2);

    // Ajout au journal par portion (défaut 1) : instantané de 155 kcal.
    fireEvent.click(within(r).getByRole('button', { name: 'Ajouter Bol de riz au journal' }));
    expect(await within(r).findByLabelText('Nombre de portions')).toHaveValue(1);
    fireEvent.click(within(r).getByRole('button', { name: 'Ajouter au journal' }));
    await waitFor(async () => expect(await entries()).toHaveLength(1));
    const [entry] = await entries();
    expect(entry).toMatchObject({ foodName: 'Bol de riz', source: 'custom', method: 'search', kcal: 155, grams: 125, foodId: `recipe:${saved?.id ?? ''}` });
    expect(await within(r).findByText('Ajouté au journal : Bol de riz.')).toBeInTheDocument();

    // Modification de la recette : l'entrée déjà écrite ne change pas.
    fireEvent.click(await within(r).findByRole('button', { name: 'Modifier Bol de riz' }));
    fireEvent.change(await within(r).findByLabelText('Nombre de portions'), { target: { value: '4' } });
    fireEvent.change(within(r).getByLabelText('Grammes de Riz test'), { target: { value: '400' } });
    fireEvent.click(within(r).getByRole('button', { name: 'Enregistrer la recette' }));
    expect(await within(r).findByText('4 portions')).toBeInTheDocument();
    const after = (await entries())[0];
    expect(after).toMatchObject({ kcal: 155, grams: 125, foodName: 'Bol de riz' });
    expect((await (await db.data.repos.recipes()).list())[0]).toMatchObject({ servings: 4 });

    // Suppression : annuler ne supprime rien, confirmer supprime la recette mais pas l'entrée.
    fireEvent.click(within(r).getByRole('button', { name: 'Supprimer Bol de riz' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Annuler' }));
    expect(await (await db.data.repos.recipes()).list()).toHaveLength(1);
    fireEvent.click(within(r).getByRole('button', { name: 'Supprimer Bol de riz' }));
    expect(await screen.findByText('Supprimer la recette « Bol de riz » ?')).toBeInTheDocument();
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
    expect(await within(r).findByText('Aucune recette. Crée la première.')).toBeInTheDocument();
    expect(await (await db.data.repos.recipes()).list()).toHaveLength(0);
    expect(await entries()).toHaveLength(1);
  });

  it('validation : chaque problème est dit en français, rien n’est écrit', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Nouvelle recette' }));
    fireEvent.click(await within(r).findByRole('button', { name: 'Enregistrer la recette' }));
    const alert = await within(r).findByRole('alert');
    expect(alert).toHaveTextContent('Donne un nom à la recette.');
    expect(alert).toHaveTextContent('Ajoute au moins un ingrédient.');
    expect(await (await db.data.repos.recipes()).list()).toHaveLength(0);
  });

  it('grammes d’un ingrédient corrigés à 0 : message nommant l’ingrédient, aucune écriture', async () => {
    await (await db.data.repos.recipes()).create(draft());
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Modifier Bol de riz' }));
    fireEvent.change(await within(r).findByLabelText('Grammes de Sauce test'), { target: { value: '0' } });
    fireEvent.click(within(r).getByRole('button', { name: 'Enregistrer la recette' }));
    expect(await within(r).findByRole('alert')).toHaveTextContent('Sauce test : indique des grammes');
    expect((await (await db.data.repos.recipes()).list())[0]?.ingredients[1]?.grams).toBe(50);
  });

  it('retirer un ingrédient : la liste et les totaux suivent', async () => {
    await (await db.data.repos.recipes()).create(draft());
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Modifier Bol de riz' }));
    fireEvent.click(await within(r).findByRole('button', { name: 'Retirer Sauce test' }));
    expect(within(r).queryByLabelText('Grammes de Sauce test')).toBeNull();
    // Sans la sauce, les fibres sont connues (0,8 g au total) : plus de cause.
    expect(within(r).getByRole('row', { name: /Fibres/ })).toHaveTextContent('0,8');
    expect(within(r).getByRole('row', { name: /Fibres/ })).not.toHaveTextContent('inconnu dans');
  });

  it('lecture en échec : message, « Réessayer » relit', async () => {
    await (await db.data.repos.recipes()).create(draft());
    let left = 1;
    const original = db.data.repos.recipes;
    const repos = {
      ...db.data.repos,
      recipes: async () => {
        const repo = await original();
        return {
          ...repo,
          list: () => {
            if (left > 0) {
              left -= 1;
              return Promise.reject(new Error('panne simulée'));
            }
            return repo.list();
          },
        };
      },
    } as unknown as Repositories;
    open('recipes', { ...db.data, repos });
    const r = await region();
    expect(await within(r).findByText('Les recettes n’ont pas pu être lues.')).toBeInTheDocument();
    fireEvent.click(within(r).getByRole('button', { name: 'Réessayer' }));
    expect(await within(r).findByText('Bol de riz')).toBeInTheDocument();
  });

  it('recette sans kcal connues : « — kcal / portion » dans la liste', async () => {
    await (await db.data.repos.recipes()).create(draft({ ingredients: [{ name: 'Sauce inconnue', source: 'custom', foodRef: null, grams: 50, per100g: { kcal: null, proteinG: 1, fatG: null, carbG: null, fiberG: null } }] }));
    open();
    const r = await region();
    expect(await within(r).findByRole('listitem', { name: /Bol de riz/ })).toHaveTextContent('— kcal / portion');
  });
});

describe('I4-07 : recettes dans la recherche du Journal', () => {
  it('une recette est trouvée avec son badge « Recette » ; par grammes, l’entrée garde l’instantané', async () => {
    await (await db.data.repos.recipes()).create(draft());
    open('journal');
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: 'bol' } });
    const hit = await screen.findByRole('button', { name: /Bol de riz/ });
    expect(within(hit).getByText('Recette')).toBeInTheDocument();
    fireEvent.click(hit);
    fireEvent.click(await screen.findByRole('radio', { name: 'Grammes' }));
    fireEvent.change(screen.getByLabelText('Grammes'), { target: { value: '250' } });
    // Le jour est celui du Journal affiché : pas de sélecteur de jour ici.
    expect(screen.queryByLabelText('Jour')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au journal' }));
    await waitFor(async () => expect(await entries()).toHaveLength(1));
    expect((await entries())[0]).toMatchObject({ foodName: 'Bol de riz', grams: 250, kcal: 310, method: 'search' });
    expect(await within(await region()).findByText('Bol de riz')).toBeInTheDocument();
  });

  it('filtre « Recettes » : seulement les recettes ; les autres filtres les masquent', async () => {
    await seedFoods();
    await (await db.data.repos.recipes()).create(draft({ name: 'Riz au curry' }));
    open('journal');
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: 'riz' } });
    await screen.findByRole('button', { name: /Riz au curry/ });
    expect(screen.getByRole('button', { name: /Riz test/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Recettes' }));
    expect(screen.queryByRole('button', { name: /Riz test/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Riz au curry/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Perso' }));
    expect(screen.queryByRole('button', { name: /Riz au curry/ })).toBeNull();
  });

  it('un récent issu d’une recette rouvre l’étape portions ou grammes', async () => {
    const recipe = await (await db.data.repos.recipes()).create(draft());
    await (await db.data.repos.mealEntries()).create({ date: TODAY, time: '08:00' as never, foodId: `recipe:${recipe.id}`, foodName: 'Bol de riz', source: 'custom', grams: 125, kcal: 155, proteinG: 10, fatG: 5, carbG: 29.5, method: 'search', confidence: null });
    open('journal');
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    fireEvent.click(await screen.findByRole('button', { name: /Bol de riz/ }));
    expect(await screen.findByLabelText('Nombre de portions')).toBeInTheDocument();
  });
});
