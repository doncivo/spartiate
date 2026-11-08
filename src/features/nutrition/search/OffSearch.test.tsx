import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { FoodDraft } from '../../../domain/nutrition/food';
import type { OffRawProduct } from '../../../domain/nutrition/offProduct';
import type { DeviceId, IsoDateTime, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { setBarcodeScanner } from '../../../platform/barcode';
import { createFakeScanner, type FakeScanner } from '../../../platform/barcode/testing';
import { setOffClient } from '../../../platform/off';
import { OffError } from '../../../platform/off/parse';
import { createFakeOff, type FakeOff } from '../../../platform/off/testing';
import { setSystemSettings } from '../../../platform/systemSettings';
import { createFakeSystemSettings } from '../../../platform/systemSettings/testing';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';

/**
 * I4-05 : Open Food Facts et scan dans la recherche (§ 15.3-15.4). Base SQLite réelle (wasm), faux client OFF, faux scanner : aucun
 * réseau, aucune caméra. L'appel en ligne n'a lieu que sur l'action « Chercher en ligne » ou une saisie / un scan de code.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000a6' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const CODE = '4006381333931';
let db: TestDb;
let off: FakeOff;
let scanner: FakeScanner;

const skyr = (over: Partial<OffRawProduct> = {}): OffRawProduct => ({
  code: CODE,
  product_name: 'Skyr nature',
  brands: 'Marque A',
  nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, fat_100g: 0.2, carbohydrates_100g: 4 },
  ...over,
});

async function mount(platform: AppContainer['platform'] = { runtime: 'web', os: 'other' }, products: OffRawProduct[] = [skyr()]): Promise<void> {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
  off = createFakeOff({ products });
  setOffClient(off.client);
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition' }));
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform })}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
}
beforeEach(() => {
  scanner = createFakeScanner({ content: CODE });
});
afterEach(async () => {
  cleanup();
  setOffClient(null);
  setBarcodeScanner(null);
  setSystemSettings(null);
  await db.close();
});

async function openSearch(): Promise<void> {
  const r = await screen.findByRole('region', { name: 'Nutrition' });
  fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
  await screen.findByRole('searchbox', { name: 'Nom de l’aliment' });
}
const type = (query: string): void => {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: query } });
};
const enterCode = (code: string): void => {
  fireEvent.change(screen.getByLabelText('Code-barres'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Chercher ce code' }));
};
const cacheStale = async (): Promise<void> => {
  const draft: FoodDraft = { source: 'off', barcode: CODE, name: 'Skyr périmé', brand: null, per100g: { kcal: 60, proteinG: 10, fatG: 0, carbG: 4, fiberG: null }, fetchedAt: '2026-06-01T08:00:00.000Z' as IsoDateTime };
  await (await db.data.repos.foods()).cacheOff(draft);
};

describe('I4-05 : « Disponible plus tard » retiré', () => {
  it('le journal n’annonce plus le scan comme futur', async () => {
    await mount();
    const r = await screen.findByRole('region', { name: 'Nutrition' });
    await within(r).findByRole('button', { name: 'Rechercher un aliment' });
    expect(r.textContent ?? '').not.toContain('disponible plus tard');
  });
});

describe('I4-05 : recherche en ligne sur action explicite', () => {
  it('aucun appel au montage ni à la frappe ; « Chercher en ligne » appelle une fois, résultats avec provenance et attribution', async () => {
    await mount();
    await openSearch();
    type('skyr');
    await screen.findByRole('button', { name: 'Créer une fiche perso' });
    expect(off.calls).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Chercher en ligne' }));
    const row = await screen.findByRole('button', { name: /Skyr nature/ });
    expect(off.calls).toEqual([{ kind: 'search', arg: 'skyr' }]);
    expect(within(row).getByText('Open Food Facts')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Résultats en ligne' })).toBeInTheDocument();
    expect(await (await db.data.repos.foods()).list()).toEqual([]);
  });

  it('le bouton n’existe pas sans texte saisi', async () => {
    await mount();
    await openSearch();
    expect(screen.queryByRole('button', { name: 'Chercher en ligne' })).toBeNull();
  });

  it('choisir un résultat : fiche enregistrée (cache), attribution et valeurs manquantes dites, entrée en source off', async () => {
    await mount();
    await openSearch();
    type('skyr');
    fireEvent.click(await screen.findByRole('button', { name: 'Chercher en ligne' }));
    fireEvent.click(await screen.findByRole('button', { name: /Skyr nature/ }));
    expect(await screen.findByLabelText('Quantité (g)')).toBeInTheDocument();
    expect(screen.getByText(/Source : Open Food Facts/)).toBeInTheDocument();
    expect(screen.getByText(/Valeurs manquantes chez Open Food Facts : fibres/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Quantité (g)'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au journal' }));
    await waitFor(async () => expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(1));
    expect((await (await db.data.repos.mealEntries()).listByDate(TODAY))[0]).toMatchObject({ source: 'off', foodName: 'Skyr nature', grams: 150, kcal: 94.5 });
    expect(await (await db.data.repos.foods()).findByBarcode(CODE)).toMatchObject({ source: 'off' });
  });

  it('hors ligne : message français, la recherche locale reste utilisable', async () => {
    await mount();
    await (await db.data.repos.foods()).create({ source: 'custom', barcode: null, name: 'Skyr maison', brand: null, per100g: { kcal: 60, proteinG: 10, fatG: 0, carbG: 4, fiberG: null }, fetchedAt: null });
    off.failWith = new OffError('offline');
    await openSearch();
    type('skyr');
    fireEvent.click(await screen.findByRole('button', { name: 'Chercher en ligne' }));
    expect(await screen.findByText(/Pas de connexion/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Skyr maison/ })).toBeInTheDocument();
  });

  it.each([
    [new OffError('timeout'), /met trop de temps à répondre/],
    [new OffError('rate-limited', { retryAfterSeconds: 42 }), /Trop de requêtes.* 42 s/],
    [new OffError('http', { status: 503 }), /erreur \(503\)/],
    [new OffError('bad-response'), /réponse d’Open Food Facts est illisible/],
  ])('échec (%s) : message dit', async (error, message) => {
    await mount();
    off.failWith = error;
    await openSearch();
    type('skyr');
    fireEvent.click(await screen.findByRole('button', { name: 'Chercher en ligne' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('navigateur sans client : dit que la recherche en ligne n’est pas disponible', async () => {
    await mount();
    setOffClient(null);
    await openSearch();
    type('skyr');
    fireEvent.click(await screen.findByRole('button', { name: 'Chercher en ligne' }));
    expect(await screen.findByText('La recherche en ligne n’est pas disponible ici.')).toBeInTheDocument();
  });

  it('aucun produit : message dit', async () => {
    await mount(undefined, []);
    await openSearch();
    type('zzzqq');
    fireEvent.click(await screen.findByRole('button', { name: 'Chercher en ligne' }));
    expect(await screen.findByText(/ne connaît aucun produit pour « zzzqq »/)).toBeInTheDocument();
  });
});

describe('I4-05 : champ Code-barres (saisie manuelle)', () => {
  it('code valide : produit trouvé, fiche enregistrée, quantité proposée avec provenance Open Food Facts', async () => {
    await mount();
    await openSearch();
    enterCode(CODE);
    expect(await screen.findByLabelText('Quantité (g)')).toBeInTheDocument();
    expect(screen.getByText('Open Food Facts')).toBeInTheDocument();
    expect(off.calls).toEqual([{ kind: 'product', arg: CODE }]);
  });

  it('code invalide : message, aucun appel', async () => {
    await mount();
    await openSearch();
    enterCode('4006381333932');
    expect(await screen.findByText(/Ce code-barres n’est pas valide/)).toBeInTheDocument();
    expect(off.calls).toEqual([]);
  });

  it('deuxième saisie du même code : lue du cache, sans réseau', async () => {
    await mount();
    await openSearch();
    enterCode(CODE);
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir un autre aliment' }));
    enterCode(CODE);
    expect(await screen.findByLabelText('Quantité (g)')).toBeInTheDocument();
    expect(off.calls).toHaveLength(1);
  });

  it('produit inconnu : message et création d’une fiche perso pré-remplie avec le code', async () => {
    await mount(undefined, []);
    await openSearch();
    enterCode(CODE);
    expect(await screen.findByText(/Aucun produit pour le code 4006381333931/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Créer une fiche perso avec ce code' }));
    expect(await screen.findByLabelText('Code-barres de la fiche')).toHaveValue(CODE);
    fireEvent.change(screen.getByLabelText('Nom de la fiche'), { target: { value: 'Mon produit' } });
    fireEvent.change(screen.getByLabelText('Calories pour 100 g (kcal)'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la fiche' }));
    expect(await screen.findByLabelText('Quantité (g)')).toBeInTheDocument();
    expect(await (await db.data.repos.foods()).findByBarcode(CODE)).toMatchObject({ source: 'custom', name: 'Mon produit', barcode: CODE });
  });

  it('fiche sans énergie ni macros : refus dit, avec le recours à la fiche perso', async () => {
    await mount(undefined, [skyr({ nutriments: {} })]);
    await openSearch();
    enterCode(CODE);
    expect(await screen.findByText(/sans énergie ni protéines, lipides ou glucides/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer une fiche perso avec ce code' })).toBeInTheDocument();
  });

  it('hors ligne avec une fiche périmée : proposée, marquée périmée', async () => {
    await mount();
    await cacheStale();
    off.failWith = new OffError('offline');
    await openSearch();
    enterCode(CODE);
    expect(await screen.findByLabelText('Quantité (g)')).toBeInTheDocument();
    expect(screen.getByText(/Fiche de plus de 90 jours, non rafraîchie/)).toBeInTheDocument();
    expect(screen.getByText('Skyr périmé')).toBeInTheDocument();
  });

  it('hors ligne sans fiche : message dit, saisie conservée', async () => {
    await mount();
    off.failWith = new OffError('offline');
    await openSearch();
    enterCode(CODE);
    expect(await screen.findByText(/Pas de connexion/)).toBeInTheDocument();
    expect(screen.getByLabelText('Code-barres')).toHaveValue(CODE);
  });
});

describe('I4-05 : courses et doubles appuis', () => {
  it('résultat tardif d’un code : ne remplace pas la fiche perso que Ali est en train de créer', async () => {
    await mount();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setOffClient({ product: async () => { await gate; return { found: true, products: [skyr()] }; }, search: off.client.search });
    await openSearch();
    type('zzzqq');
    await screen.findByRole('button', { name: 'Créer une fiche perso' });
    enterCode(CODE);
    fireEvent.click(screen.getByRole('button', { name: 'Créer une fiche perso' }));
    await screen.findByLabelText('Nom de la fiche');
    release();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(screen.getByLabelText('Nom de la fiche')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await screen.findByLabelText('Code-barres');
    expect(screen.queryByLabelText('Quantité (g)')).toBeNull();
  });

  it('double appui sur un résultat en ligne : une seule écriture du cache', async () => {
    await mount();
    const foods = await db.data.repos.foods();
    let writes = 0;
    const original = foods.cacheOff.bind(foods);
    foods.cacheOff = (draft, options) => {
      writes += 1;
      return original(draft, options);
    };
    await openSearch();
    type('skyr');
    fireEvent.click(await screen.findByRole('button', { name: 'Chercher en ligne' }));
    const row = await screen.findByRole('button', { name: /Skyr nature/ });
    fireEvent.click(row);
    fireEvent.click(row);
    expect(await screen.findByLabelText('Quantité (g)')).toBeInTheDocument();
    expect(writes).toBe(1);
  });

  it('tous les produits refusés : « Produits ignorés » seul, sans « ne connaît aucun produit »', async () => {
    await mount(undefined, [skyr({ nutriments: {} })]);
    await openSearch();
    type('skyr');
    fireEvent.click(await screen.findByRole('button', { name: 'Chercher en ligne' }));
    expect(await screen.findByText(/Produits ignorés/)).toBeInTheDocument();
    expect(screen.queryByText(/ne connaît aucun produit/)).toBeNull();
  });

  it('écriture du cache en échec lors d’un code : message d’écriture local, pas « réponse illisible »', async () => {
    await mount();
    const foods = await db.data.repos.foods();
    foods.cacheOff = () => Promise.reject(new Error('disque'));
    await openSearch();
    enterCode(CODE);
    expect(await screen.findByText(/enregistrer|écriture/i)).toBeInTheDocument();
    expect(screen.queryByText(/illisible/)).toBeNull();
  });
});

describe('I4-05 : scan (iPhone seulement)', () => {
  it('PC et navigateur : aucun bouton « Scanner »', async () => {
    await mount({ runtime: 'tauri', os: 'windows' });
    await openSearch();
    expect(screen.queryByRole('button', { name: 'Scanner' })).toBeNull();
    expect(screen.getByLabelText('Code-barres')).toBeInTheDocument();
  });

  it('iPhone : Scanner lit le code, cherche le produit et propose la quantité', async () => {
    setBarcodeScanner(async () => scanner.scanner);
    await mount({ runtime: 'tauri', os: 'ios' });
    await openSearch();
    fireEvent.click(screen.getByRole('button', { name: 'Scanner' }));
    expect(await screen.findByLabelText('Quantité (g)')).toBeInTheDocument();
    expect(scanner.scans).toHaveLength(1);
    expect(off.calls).toEqual([{ kind: 'product', arg: CODE }]);
  });

  it('annulation : retour à la recherche, scanner annulé, aucun message d’erreur', async () => {
    scanner = createFakeScanner({ hold: true });
    setBarcodeScanner(async () => scanner.scanner);
    await mount({ runtime: 'tauri', os: 'ios' });
    await openSearch();
    fireEvent.click(screen.getByRole('button', { name: 'Scanner' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler le scan' }));
    expect(await screen.findByLabelText('Code-barres')).toBeInTheDocument();
    expect(scanner.cancelled).toBe(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(off.calls).toEqual([]);
  });

  it('caméra refusée : explication avec le chemin Réglages > Spartiate > Appareil photo et bouton vers les réglages', async () => {
    scanner = createFakeScanner({ permission: 'denied' });
    setBarcodeScanner(async () => scanner.scanner);
    const settings = createFakeSystemSettings();
    setSystemSettings(settings);
    await mount({ runtime: 'tauri', os: 'ios' });
    await openSearch();
    fireEvent.click(screen.getByRole('button', { name: 'Scanner' }));
    expect(await screen.findByText(/Réglages > Spartiate > Appareil photo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir les réglages' }));
    await waitFor(() => expect(settings.opened).toBe(1));
    expect(screen.getByLabelText('Code-barres')).toBeInTheDocument();
  });

  it('caméra refusée sans accès aux réglages : pas de bouton, le chemin reste dit', async () => {
    scanner = createFakeScanner({ permission: 'denied' });
    setBarcodeScanner(async () => scanner.scanner);
    await mount({ runtime: 'tauri', os: 'ios' });
    await openSearch();
    fireEvent.click(screen.getByRole('button', { name: 'Scanner' }));
    expect(await screen.findByText(/Réglages > Spartiate > Appareil photo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ouvrir les réglages' })).toBeNull();
  });

  it('ouverture des réglages en échec : dit, jamais silencieux', async () => {
    scanner = createFakeScanner({ permission: 'denied' });
    setBarcodeScanner(async () => scanner.scanner);
    setSystemSettings(createFakeSystemSettings(true));
    await mount({ runtime: 'tauri', os: 'ios' });
    await openSearch();
    fireEvent.click(screen.getByRole('button', { name: 'Scanner' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir les réglages' }));
    expect(await screen.findByText(/Impossible d’ouvrir les réglages/)).toBeInTheDocument();
  });

  it('échec du plugin et code illisible : messages dits', async () => {
    scanner = createFakeScanner({ scanFails: true });
    setBarcodeScanner(async () => scanner.scanner);
    await mount({ runtime: 'tauri', os: 'ios' });
    await openSearch();
    fireEvent.click(screen.getByRole('button', { name: 'Scanner' }));
    expect(await screen.findByText(/Le scan n’a pas abouti/)).toBeInTheDocument();
  });

  it('scan hors ligne : fiche en cache lue sans réseau', async () => {
    setBarcodeScanner(async () => scanner.scanner);
    await mount({ runtime: 'tauri', os: 'ios' });
    await (await db.data.repos.foods()).cacheOff({ source: 'off', barcode: CODE, name: 'Skyr en cache', brand: null, per100g: { kcal: 60, proteinG: 10, fatG: 0, carbG: 4, fiberG: null }, fetchedAt: '2026-11-01T08:00:00.000Z' as IsoDateTime });
    off.failWith = new OffError('offline');
    await openSearch();
    fireEvent.click(screen.getByRole('button', { name: 'Scanner' }));
    expect(await screen.findByText('Skyr en cache')).toBeInTheDocument();
    expect(off.calls).toEqual([]);
  });
});
