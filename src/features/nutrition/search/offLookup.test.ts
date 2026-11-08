import { afterEach, describe, expect, it } from 'vitest';
import type { FoodDraft } from '../../../domain/nutrition/food';
import type { OffRawProduct } from '../../../domain/nutrition/offProduct';
import type { DeviceId, IsoDateTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { OffError } from '../../../platform/off/parse';
import { createFakeOff } from '../../../platform/off/testing';
import { chooseOnline, resolveBarcode, searchOnline, type OffDeps } from './offLookup';

/**
 * I4-05 : lecture par code-barres (cache d'abord, réseau seulement au-delà de 90 jours ou sans fiche), recherche en ligne explicite,
 * dégradés dits (hors ligne, délai, trop de requêtes, produit inconnu, fiche inutilisable). Base SQLite réelle, faux client : aucun réseau.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000a5' as DeviceId;
const NOW = '2026-11-09T11:00:00.000Z' as IsoDateTime;
const CODE = '4006381333931';
let db: TestDb;
afterEach(async () => {
  await (db as TestDb | undefined)?.close();
  db = undefined as unknown as TestDb;
});

const rawSkyr = (over: Partial<OffRawProduct> = {}): OffRawProduct => ({
  code: CODE,
  product_name: 'Skyr nature',
  brands: 'Marque A',
  nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, fat_100g: 0.2, carbohydrates_100g: 4 },
  ...over,
});
const cached = (fetchedAt: string, name = 'Skyr en cache'): FoodDraft => ({
  source: 'off',
  barcode: CODE,
  name,
  brand: null,
  per100g: { kcal: 60, proteinG: 10, fatG: 0, carbG: 4, fiberG: null },
  fetchedAt: fetchedAt as IsoDateTime,
});

async function setup(fake = createFakeOff()) {
  db = await openBaseDb(DEVICE, NOW);
  const foods = await db.data.repos.foods();
  const deps: OffDeps = { foods, client: async () => fake.client, now: NOW };
  return { foods, fake, deps };
}

describe('resolveBarcode : cache d’abord', () => {
  it('code invalide : aucun accès au réseau', async () => {
    const { deps, fake } = await setup();
    expect(await resolveBarcode(deps, '4006381333932')).toEqual({ kind: 'invalid-code' });
    expect(fake.calls).toEqual([]);
  });

  it('fiche en cache de moins de 90 jours : lue sans réseau', async () => {
    const { deps, fake, foods } = await setup();
    await foods.cacheOff(cached('2026-10-20T08:00:00.000Z'));
    const r = await resolveBarcode(deps, CODE);
    expect(r).toMatchObject({ kind: 'found', via: 'cache' });
    expect(r.kind === 'found' && r.food.name).toBe('Skyr en cache');
    expect(fake.calls).toEqual([]);
  });

  it('fiche perso du même code : prime, aucun réseau', async () => {
    const { deps, fake, foods } = await setup();
    await foods.create({ ...cached('2026-10-20T08:00:00.000Z'), source: 'custom', fetchedAt: null, name: 'Mon skyr' });
    const r = await resolveBarcode(deps, CODE);
    expect(r).toMatchObject({ kind: 'found', via: 'custom' });
    expect(fake.calls).toEqual([]);
  });

  it('code UPC-A saisi : cherché sous sa forme à 13 chiffres', async () => {
    const { deps, fake, foods } = await setup(createFakeOff({ products: [rawSkyr({ code: '0036000291452' })] }));
    const r = await resolveBarcode(deps, '036000291452');
    expect(r).toMatchObject({ kind: 'found', via: 'network' });
    expect(fake.calls).toEqual([{ kind: 'product', arg: '0036000291452' }]);
    expect((await foods.findByBarcode('0036000291452'))?.source).toBe('off');
  });
});

describe('resolveBarcode : réseau et dépôt dans le cache', () => {
  it('sans fiche : appel, fiche convertie et enregistrée (source off, code, date), puis lue du cache sans réseau', async () => {
    const { deps, fake, foods } = await setup(createFakeOff({ products: [rawSkyr()] }));
    const r = await resolveBarcode(deps, CODE);
    expect(r).toMatchObject({ kind: 'found', via: 'network', missing: ['fiberG'] });
    const stored = await foods.findByBarcode(CODE);
    expect(stored).toMatchObject({ source: 'off', barcode: CODE, name: 'Skyr nature', brand: 'Marque A', fetchedAt: NOW });
    expect(stored?.per100g).toEqual({ kcal: 63, proteinG: 11, fatG: 0.2, carbG: 4, fiberG: null });
    expect(await resolveBarcode(deps, CODE)).toMatchObject({ kind: 'found', via: 'cache' });
    expect(fake.calls).toHaveLength(1);
  });

  it('fiche de plus de 90 jours : nouvel appel, fiche rafraîchie en place (une seule ligne)', async () => {
    const { deps, fake, foods } = await setup(createFakeOff({ products: [rawSkyr()] }));
    await foods.cacheOff(cached('2026-07-01T08:00:00.000Z'));
    const r = await resolveBarcode(deps, CODE);
    expect(r).toMatchObject({ kind: 'found', via: 'network' });
    expect(fake.calls).toHaveLength(1);
    const all = await foods.list({ source: 'off' });
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: 'Skyr nature', fetchedAt: NOW });
  });

  it('fiche périmée et réseau en échec : la fiche périmée est proposée, marquée comme telle, avec la cause', async () => {
    const fake = createFakeOff();
    fake.failWith = new OffError('offline');
    const { deps, foods } = await setup(fake);
    await foods.cacheOff(cached('2026-07-01T08:00:00.000Z'));
    const r = await resolveBarcode(deps, CODE);
    expect(r).toMatchObject({ kind: 'found', via: 'stale', refreshFailure: { kind: 'offline' } });
    expect(r.kind === 'found' && r.food.name).toBe('Skyr en cache');
  });

  it('fiche périmée et plus de client (navigateur) : proposée aussi', async () => {
    const { foods, deps } = await setup();
    await foods.cacheOff(cached('2026-07-01T08:00:00.000Z'));
    const r = await resolveBarcode({ ...deps, client: async () => null }, CODE);
    expect(r).toMatchObject({ kind: 'found', via: 'stale', refreshFailure: { kind: 'unavailable' } });
  });

  it('fiche incomplète : acceptée, les valeurs inconnues restent null (jamais 0) et sont listées', async () => {
    const { deps, foods } = await setup(createFakeOff({ products: [rawSkyr({ nutriments: { 'energy-kcal_100g': 63 } })] }));
    const r = await resolveBarcode(deps, CODE);
    expect(r).toMatchObject({ kind: 'found', missing: ['proteinG', 'fatG', 'carbG', 'fiberG'] });
    expect((await foods.findByBarcode(CODE))?.per100g).toEqual({ kcal: 63, proteinG: null, fatG: null, carbG: null, fiberG: null });
  });
});

describe('resolveBarcode : cas dégradés', () => {
  it('produit inconnu d’OFF : not-found avec le code, rien écrit', async () => {
    const { deps, foods } = await setup(createFakeOff());
    expect(await resolveBarcode(deps, CODE)).toEqual({ kind: 'not-found', code: CODE });
    expect(await foods.list()).toEqual([]);
  });

  it('fiche sans énergie ni macros : refusée avec son motif, rien écrit', async () => {
    const { deps, foods } = await setup(createFakeOff({ products: [rawSkyr({ nutriments: {} })] }));
    expect(await resolveBarcode(deps, CODE)).toEqual({ kind: 'refused', code: CODE, reason: 'no-nutrition' });
    expect(await foods.list()).toEqual([]);
  });

  it.each([
    [new OffError('offline'), { kind: 'offline' }],
    [new OffError('timeout'), { kind: 'timeout' }],
    [new OffError('rate-limited', { retryAfterSeconds: 42 }), { kind: 'rate-limited', retryAfterSeconds: 42 }],
    [new OffError('http', { status: 503 }), { kind: 'http', status: 503 }],
    [new OffError('bad-response'), { kind: 'bad-response' }],
  ])('sans fiche et réseau en échec (%s) : failed, jamais silencieux', async (error, failure) => {
    const fake = createFakeOff();
    fake.failWith = error;
    const { deps } = await setup(fake);
    expect(await resolveBarcode(deps, CODE)).toEqual({ kind: 'failed', code: CODE, failure });
  });

  it('erreur inattendue (pas une OffError) : bad-response, sans texte propagé', async () => {
    const { deps } = await setup();
    const r = await resolveBarcode({ ...deps, client: async () => ({ product: () => Promise.reject(new Error('secret')), search: () => Promise.reject(new Error('secret')) }) }, CODE);
    expect(r).toEqual({ kind: 'failed', code: CODE, failure: { kind: 'bad-response' } });
  });

  it('pas de client (navigateur) et pas de fiche : failed unavailable', async () => {
    const { deps } = await setup();
    expect(await resolveBarcode({ ...deps, client: async () => null }, CODE)).toEqual({ kind: 'failed', code: CODE, failure: { kind: 'unavailable' } });
  });
});

describe('resolveBarcode : réponses incohérentes et écriture du cache', () => {
  it('OFF renvoie un autre code valide que celui demandé : not-found, rien écrit', async () => {
    const { deps, foods } = await setup({
      client: {
        product: async () => ({ found: true, products: [rawSkyr({ code: '96385074' })] }),
        search: async () => ({ found: false, products: [] }),
      },
      calls: [],
      failWith: null,
    });
    expect(await resolveBarcode(deps, CODE)).toEqual({ kind: 'not-found', code: CODE });
    expect(await foods.list()).toEqual([]);
  });

  it('échec d’écriture du cache : nature dédiée write-failed (pas « réponse illisible »)', async () => {
    const { deps, foods } = await setup(createFakeOff({ products: [rawSkyr()] }));
    const failing = { ...foods, findByBarcode: foods.findByBarcode.bind(foods), cacheOff: () => Promise.reject(new Error('disque')) } as typeof foods;
    expect(await resolveBarcode({ ...deps, foods: failing }, CODE)).toEqual({ kind: 'failed', code: CODE, failure: { kind: 'write-failed' } });
  });
});

describe('searchOnline : codes et produits écartés', () => {
  it('un produit au code à clé invalide est refusé (compté), les autres restent', async () => {
    const { deps } = await setup(createFakeOff({ products: [rawSkyr(), rawSkyr({ code: '4006381333932', product_name: 'Faux' })] }));
    const r = await searchOnline(deps, 'skyr');
    expect(r.kind === 'ok' && r.items.map((i) => i.draft.name)).toEqual(['Skyr nature']);
    expect(r.kind === 'ok' && r.refused).toBe(1);
  });

  it('produits écartés par la façade (skipped) ajoutés au compte des refusés', async () => {
    const { deps } = await setup({ client: { product: async () => ({ found: false, products: [] }), search: async () => ({ found: true, products: [rawSkyr()], skipped: 2 }) }, calls: [], failWith: null });
    const r = await searchOnline(deps, 'skyr');
    expect(r.kind === 'ok' && r.refused).toBe(2);
  });
});

describe('searchOnline : seulement sur appel explicite', () => {
  it('convertit les produits utilisables, compte les refusés, n’écrit rien', async () => {
    const { deps, foods, fake } = await setup(
      createFakeOff({ products: [rawSkyr(), rawSkyr({ code: '96385074', product_name: 'Skyr vanille' }), rawSkyr({ code: '4001686301556', product_name: 'Vide', nutriments: {} })] }),
    );
    const r = await searchOnline(deps, 'skyr');
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.items.map((i) => i.draft.name)).toEqual(['Skyr nature', 'Skyr vanille']);
    expect(r.refused).toBe(1);
    expect(r.items[0]?.draft.fetchedAt).toBe(NOW);
    expect(fake.calls).toEqual([{ kind: 'search', arg: 'skyr' }]);
    expect(await foods.list()).toEqual([]);
  });

  it('requête trop courte : invalid-query sans réseau', async () => {
    const { deps, fake } = await setup();
    expect(await searchOnline(deps, ' a ')).toEqual({ kind: 'invalid-query' });
    expect(fake.calls).toEqual([]);
  });

  it('échec réseau : failed avec la nature ; pas de client : unavailable', async () => {
    const fake = createFakeOff();
    fake.failWith = new OffError('rate-limited', { retryAfterSeconds: 12 });
    const { deps } = await setup(fake);
    expect(await searchOnline(deps, 'skyr')).toEqual({ kind: 'failed', failure: { kind: 'rate-limited', retryAfterSeconds: 12 } });
    expect(await searchOnline({ ...deps, client: async () => null }, 'skyr')).toEqual({ kind: 'failed', failure: { kind: 'unavailable' } });
  });

  it('chooseOnline : la fiche choisie est enregistrée (source off), puis trouvée par texte et par code hors ligne', async () => {
    const { deps, foods } = await setup(createFakeOff({ products: [rawSkyr()] }));
    const r = await searchOnline(deps, 'skyr');
    if (r.kind !== 'ok' || r.items[0] === undefined) throw new Error('attendu');
    const record = await chooseOnline(foods, r.items[0].draft);
    expect(record).toMatchObject({ source: 'off', barcode: CODE });
    const { searchCatalogue } = await import('./catalogueSearch');
    const hits = await searchCatalogue(foods, 'skyr nature', { now: NOW, loadCiqual: async () => ({ source: {} as never, groups: [], foods: [] }) });
    expect(hits.hits.map((h) => [h.provenance, h.barcode])).toEqual([['off', CODE]]);
  });
});
