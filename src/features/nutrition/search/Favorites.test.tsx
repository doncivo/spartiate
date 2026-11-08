import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';

/** I4-06 : favoris de la recherche (D-79), stockage local dans `settings`, base SQLite réelle (wasm). */
const DEVICE = '60000000-0000-4000-8000-0000000000a7' as DeviceId;
const GONE_ID = '20000000-0000-4000-8000-000000000009';
let db: TestDb;

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

function mount(): void {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition' }));
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
}
async function openSearch(): Promise<void> {
  const r = await screen.findByRole('region', { name: 'Nutrition' });
  fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
  await screen.findByRole('searchbox', { name: 'Nom de l’aliment' });
}
async function seedSkyr(): Promise<string> {
  const record = await (await db.data.repos.foods()).create({ source: 'custom', barcode: null, name: 'Skyr maison', brand: null, per100g: { kcal: 60, proteinG: 11, fatG: 0.2, carbG: 4, fiberG: null }, fetchedAt: null });
  return record.id;
}
async function pickSkyr(): Promise<void> {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: 'skyr' } });
  fireEvent.click(await screen.findByRole('button', { name: /Skyr maison/ }));
}

describe('I4-06 : favoris', () => {
  it('étoile de la fiche : nom accessible, aria-pressed, valeur locale { v: 1, items }', async () => {
    const id = await seedSkyr();
    mount();
    await openSearch();
    await pickSkyr();
    const star = await screen.findByRole('button', { name: 'Ajouter aux favoris' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(star);
    const pressed = await screen.findByRole('button', { name: 'Retirer des favoris' });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    await waitFor(async () => expect(await db.data.repos.settings.get('nutrition.favorites')).toEqual({ v: 1, items: [{ source: 'custom', ref: id }] }));
    fireEvent.click(pressed);
    await waitFor(async () => expect(await db.data.repos.settings.get('nutrition.favorites')).toEqual({ v: 1, items: [] }));
    expect(screen.getByRole('button', { name: 'Ajouter aux favoris' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('requête vide : « Favoris » en tête, avant « Récents », avec provenance ; le choix ouvre la quantité', async () => {
    const id = await seedSkyr();
    await db.data.repos.settings.set('nutrition.favorites', { v: 1, items: [{ source: 'custom', ref: id }] });
    mount();
    await openSearch();
    const favorites = await screen.findByRole('heading', { name: 'Favoris' });
    const recents = screen.getByRole('heading', { name: 'Récents' });
    expect(favorites.compareDocumentPosition(recents) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const section = favorites.closest('section') as HTMLElement;
    const hit = within(section).getByRole('button', { name: /Skyr maison/ });
    expect(within(hit).getByText('Perso')).toBeInTheDocument();
    fireEvent.click(hit);
    expect(await screen.findByLabelText('Quantité (g)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retirer des favoris' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('pas de section Favoris quand la requête n’est pas vide', async () => {
    const id = await seedSkyr();
    await db.data.repos.settings.set('nutrition.favorites', { v: 1, items: [{ source: 'custom', ref: id }] });
    mount();
    await openSearch();
    await screen.findByRole('heading', { name: 'Favoris' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: 'skyr' } });
    await screen.findByRole('button', { name: /Skyr maison/ });
    expect(screen.queryByRole('heading', { name: 'Favoris' })).toBeNull();
  });

  it('aliment disparu : le favori n’apparaît pas, aucune erreur, nettoyé à l’écriture suivante', async () => {
    const id = await seedSkyr();
    await db.data.repos.settings.set('nutrition.favorites', { v: 1, items: [{ source: 'custom', ref: GONE_ID }, { source: 'ciqual', ref: 'ciqual:99999999' }] });
    mount();
    await openSearch();
    await screen.findByRole('heading', { name: 'Récents' });
    expect(screen.queryByRole('heading', { name: 'Favoris' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await pickSkyr();
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter aux favoris' }));
    await waitFor(async () => expect(await db.data.repos.settings.get('nutrition.favorites')).toEqual({ v: 1, items: [{ source: 'custom', ref: id }] }));
  });

  it('valeur corrompue : recherche utilisable, aucune section, aucune erreur', async () => {
    await db.data.repos.settings.set('nutrition.favorites', 'n’importe quoi');
    mount();
    await openSearch();
    await screen.findByRole('heading', { name: 'Récents' });
    expect(screen.queryByRole('heading', { name: 'Favoris' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
