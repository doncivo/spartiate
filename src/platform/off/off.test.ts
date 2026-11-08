import { afterEach, describe, expect, it } from 'vitest';
import { createTauriOff, OFF_PRODUCT_COMMAND, OFF_SEARCH_COMMAND } from './tauriOff';
import { OffError, parseOffError, parseOffResponse, queryInput } from './parse';
import { resolveOffClient, setOffClient } from './index';
import { createFakeOff } from './testing';

/**
 * I4-05 : façade du client Open Food Facts (commandes Rust `off_product` et `off_search`). Aucun appel réseau : `invoke` est faux.
 * La réponse est validée à la main (jamais de confiance) ; seuls un code ou un texte partent vers Rust.
 */
const product = { code: '4006381333931', product_name: 'Skyr', brands: 'Marque', quantity: '150 g', nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11 } };

describe('parseOffResponse', () => {
  it('forme valide : found et produits, seules les dix clés connues de nutriments, valeurs numériques', () => {
    const r = parseOffResponse({
      found: true,
      products: [{ ...product, nutriments: { 'energy-kcal_100g': 63, 'proteins_100g': 11, 'salt_100g': 0.1, inconnu_100g: 5, fat_100g: 'x', 'sugars_100g': Number.NaN } }],
    });
    expect(r.found).toBe(true);
    expect(r.products).toHaveLength(1);
    expect(r.products[0]?.nutriments).toEqual({ 'energy-kcal_100g': 63, proteins_100g: 11, salt_100g: 0.1 });
  });
  it('texte absent ou de mauvais type : absent ; champs de texte plafonnés', () => {
    const r = parseOffResponse({ found: true, products: [{ code: '4006381333931', product_name: 12, brands: 'x'.repeat(5000), nutriments: {} }] });
    expect(r.products[0]?.product_name).toBeUndefined();
    expect(r.products[0]?.brands).toHaveLength(500);
  });
  it('found false et liste vide : valide', () => {
    expect(parseOffResponse({ found: false, products: [] })).toEqual({ found: false, products: [] });
  });
  it.each([
    ['null', null],
    ['texte', 'ok'],
    ['found absent', { products: [] }],
    ['found non booléen', { found: 'yes', products: [] }],
    ['products non liste', { found: true, products: {} }],
    ['produit non objet', { found: true, products: [3] }],
    ['code absent', { found: true, products: [{ nutriments: {} }] }],
    ['code non chiffres', { found: true, products: [{ code: 'abc', nutriments: {} }] }],
    ['nutriments non objet', { found: true, products: [{ code: '4006381333931', nutriments: 5 }] }],
    ['trop de produits', { found: true, products: Array.from({ length: 101 }, () => product) }],
  ])('réponse invalide (%s) : OffError bad-response', (_name, raw) => {
    expect(() => parseOffResponse(raw)).toThrowError(OffError);
    try {
      parseOffResponse(raw);
    } catch (error) {
      expect((error as OffError).kind).toBe('bad-response');
    }
  });
});

describe('parseOffError', () => {
  it('objet de Rust : nature, statut et attente reprises', () => {
    const e = parseOffError({ kind: 'rate-limited', retryAfterSeconds: 30 });
    expect([e.kind, e.retryAfterSeconds]).toEqual(['rate-limited', 30]);
    expect(parseOffError({ kind: 'http', status: 503 }).status).toBe(503);
    expect(parseOffError({ kind: 'offline' }).kind).toBe('offline');
  });
  it('forme inconnue, nature inconnue, valeurs absurdes : bad-response, sans propager de texte', () => {
    for (const raw of ['boom', null, 42, { kind: 'autre' }, { message: 'x' }]) expect(parseOffError(raw).kind, String(raw)).toBe('bad-response');
    const e = parseOffError({ kind: 'rate-limited', retryAfterSeconds: -5 });
    expect(e.retryAfterSeconds).toBeUndefined();
    expect(parseOffError({ kind: 'http', status: 'x' }).status).toBeUndefined();
    expect(parseOffError({ kind: 'offline', message: 'secret' }).message).not.toContain('secret');
  });
});

describe('createTauriOff', () => {
  it('product : commande off_product, charge utile { barcode } et rien d’autre, code normalisé', async () => {
    const calls: Array<[string, unknown]> = [];
    const client = createTauriOff(async (command, args) => {
      calls.push([command, args]);
      return { found: true, products: [product] };
    });
    const r = await client.product('036000291452');
    expect(calls).toEqual([[OFF_PRODUCT_COMMAND, { barcode: '0036000291452' }]]);
    expect(r.products[0]?.code).toBe('4006381333931');
  });
  it('search : commande off_search, charge utile { query } nettoyée (espaces compactés)', async () => {
    const calls: Array<[string, unknown]> = [];
    const client = createTauriOff(async (command, args) => {
      calls.push([command, args]);
      return { found: false, products: [] };
    });
    await client.search('  skyr   nature ');
    expect(calls).toEqual([[OFF_SEARCH_COMMAND, { query: 'skyr nature' }]]);
  });
  it('entrée invalide : invalid-input SANS appeler invoke', async () => {
    let called = 0;
    const client = createTauriOff(async () => {
      called += 1;
      return { found: false, products: [] };
    });
    await expect(client.product('123')).rejects.toMatchObject({ kind: 'invalid-input' });
    await expect(client.product('4006381333932')).rejects.toMatchObject({ kind: 'invalid-input' });
    await expect(client.search('a')).rejects.toMatchObject({ kind: 'invalid-input' });
    await expect(client.search('x'.repeat(101))).rejects.toMatchObject({ kind: 'invalid-input' });
    await expect(client.search('ab\u0000cd')).rejects.toMatchObject({ kind: 'invalid-input' });
    expect(called).toBe(0);
  });
  it('rejet de Rust : OffError typée ; réponse illisible : bad-response', async () => {
    const reject = createTauriOff(async () => Promise.reject({ kind: 'timeout' }));
    await expect(reject.search('skyr')).rejects.toMatchObject({ name: 'OffError', kind: 'timeout' });
    const garbage = createTauriOff(async () => ({ found: 'peut-être' }));
    await expect(garbage.product('4006381333931')).rejects.toMatchObject({ kind: 'bad-response' });
  });
});

describe('queryInput', () => {
  it('2 à 100 caractères, espaces compactés', () => {
    expect(queryInput(' yaourt   grec ')).toBe('yaourt grec');
    expect(queryInput('a')).toBeNull();
    expect(queryInput('é'.repeat(100))).not.toBeNull();
    expect(queryInput('é'.repeat(101))).toBeNull();
  });
});

describe('résolveur et faux client', () => {
  afterEach(() => setOffClient(null));
  it('navigateur (web) : aucun client ; client injecté : prioritaire', () => {
    expect(resolveOffClient('web')).toBeNull();
    const fake = createFakeOff();
    setOffClient(fake.client);
    expect(resolveOffClient('web')).toBe(fake.client);
  });
  it('tauri : un client réel (Rust), sans appel au chargement', () => {
    expect(resolveOffClient('tauri')).not.toBeNull();
  });
  it('faux client : réponses par code, appels notés, échec injectable', async () => {
    const fake = createFakeOff({ products: [product] });
    expect((await fake.client.product('4006381333931')).found).toBe(true);
    expect((await fake.client.product('4006381333931')).products).toHaveLength(1);
    expect((await fake.client.search('skyr')).products).toHaveLength(1);
    expect(fake.calls).toEqual([
      { kind: 'product', arg: '4006381333931' },
      { kind: 'product', arg: '4006381333931' },
      { kind: 'search', arg: 'skyr' },
    ]);
    fake.failWith = new OffError('offline');
    await expect(fake.client.search('skyr')).rejects.toMatchObject({ kind: 'offline' });
    expect(await createFakeOff().client.product('4006381333931')).toEqual({ found: false, products: [] });
  });
});
