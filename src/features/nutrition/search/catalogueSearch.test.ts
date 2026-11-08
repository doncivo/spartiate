import { afterEach, describe, expect, it } from 'vitest';
import type { CiqualCatalogue } from '../../../domain/nutrition/ciqual';
import type { FoodDraft } from '../../../domain/nutrition/food';
import type { DeviceId, IsoDateTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { loadCiqual } from '../catalogue/ciqualCatalogue';
import { lookupBarcode, searchCatalogue } from './catalogueSearch';

/**
 * I4-02 : recherche locale (Perso / Ciqual / OFF en cache) et recherche par code-barres hors ligne. Aucun réseau : le cache OFF est
 * rempli par les tests. Un échec de lecture de Ciqual est dit (jamais silencieux) et la recherche Perso / cache reste utilisable ;
 * un code inconnu ne crée aucun repas.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000fb' as DeviceId;
const F1 = '7c4d3c2b-0000-4000-8000-000000000001';
const F2 = '7c4d3c2b-0000-4000-8000-000000000002';
const NOW = '2026-11-08T12:00:00.000Z' as IsoDateTime;
let db: TestDb;
afterEach(async () => {
  await (db as TestDb | undefined)?.close();
  db = undefined as unknown as TestDb;
});

const per = { kcal: 120, proteinG: 10, fatG: 5, carbG: 8, fiberG: 2 };
const custom = (name: string, over: Partial<FoodDraft> = {}): FoodDraft => ({ source: 'custom', barcode: null, name, brand: null, per100g: per, fetchedAt: null, ...over });
const off = (name: string, fetchedAt: string, barcode = '4006381333931'): FoodDraft => custom(name, { source: 'off', barcode, brand: 'Marque', fetchedAt: fetchedAt as IsoDateTime });

const tiny: CiqualCatalogue = {
  source: { name: 'synthétique', publisher: 'Anses', version: '2025-11-03', doi: '10.57745/RDMHWY', licence: 'Licence Ouverte Etalab 2.0', url: 'https://doi.org/10.57745/RDMHWY', attribution: 'Source : Anses.' },
  groups: [{ code: '01', nameFr: 'groupe' }],
  foods: [{ code: '9001', nameFr: 'Pomme, crue', group: '01', per100g: { kcal: 52, proteinG: 0.3, fatG: 0.2, carbG: 11.4, fiberG: 2.4 } }],
};

describe('loadCiqual : contenu embarqué, chargé à la demande', () => {
  it('le fichier officiel est lu et validé ; mis en mémoire (même objet à la deuxième demande)', async () => {
    const first = await loadCiqual();
    expect(first.foods.length).toBeGreaterThan(3000);
    expect(first.source.licence).toBe('Licence Ouverte Etalab 2.0');
    expect(await loadCiqual()).toBe(first);
    expect(first.foods.find((f) => f.code === '1000')?.per100g.kcal).toBe(274);
  });
});

describe('searchCatalogue', () => {
  it('Perso, Ciqual et cache OFF dans un même résultat, provenance sur chaque ligne', async () => {
    db = await openBaseDb(DEVICE);
    const foods = await db.data.repos.foods();
    await foods.create(custom('Pomme maison'), { id: F1 });
    await foods.cacheOff(off('Pomme en compote', '2026-11-01T08:00:00.000Z'), { id: F2 });
    const result = await searchCatalogue(foods, 'pomme', { now: NOW, loadCiqual: async () => tiny });
    expect(result.ciqual).toBe('ok');
    expect(result.hits.map((h) => [h.provenance, h.name])).toEqual([
      ['custom', 'Pomme maison'],
      ['ciqual', 'Pomme, crue'],
      ['off', 'Pomme en compote'],
    ]);
  });

  it('produit OFF expiré (plus de 90 jours) : encore proposé hors ligne mais signalé périmé', async () => {
    db = await openBaseDb(DEVICE);
    const foods = await db.data.repos.foods();
    await foods.cacheOff(off('Vieux produit', '2026-05-01T08:00:00.000Z'), { id: F2 });
    const result = await searchCatalogue(foods, 'vieux', { now: NOW, loadCiqual: async () => tiny });
    expect(result.hits.map((h) => h.name)).toEqual(['Vieux produit']);
    expect(result.staleOff).toEqual([F2]);
  });

  it('Ciqual illisible : dit (ciqual: unavailable), la recherche personnelle et le cache restent utilisables', async () => {
    db = await openBaseDb(DEVICE);
    const foods = await db.data.repos.foods();
    await foods.create(custom('Pomme maison'), { id: F1 });
    const result = await searchCatalogue(foods, 'pomme', {
      now: NOW,
      loadCiqual: async () => {
        throw new Error('contenu invalide');
      },
    });
    expect(result.ciqual).toBe('unavailable');
    expect(result.hits.map((h) => h.name)).toEqual(['Pomme maison']);
  });

  it('requête vide : aucun résultat, Ciqual non chargé', async () => {
    db = await openBaseDb(DEVICE);
    let loaded = 0;
    const result = await searchCatalogue(await db.data.repos.foods(), '  ', {
      now: NOW,
      loadCiqual: async () => {
        loaded += 1;
        return tiny;
      },
    });
    expect(result).toEqual({ hits: [], ciqual: 'ok', staleOff: [] });
    expect(loaded).toBe(0);
  });

  it('fiche supprimée : absente des résultats', async () => {
    db = await openBaseDb(DEVICE);
    const foods = await db.data.repos.foods();
    await foods.create(custom('Pomme maison'), { id: F1 });
    await foods.softDelete(F1);
    expect((await searchCatalogue(foods, 'pomme', { now: NOW, loadCiqual: async () => tiny })).hits.map((h) => h.name)).toEqual(['Pomme, crue']);
  });
});

describe('lookupBarcode : hors ligne, cache puis recours manuel', () => {
  it('code en cache valide : trouvé, origine OFF, cache valide', async () => {
    db = await openBaseDb(DEVICE);
    const foods = await db.data.repos.foods();
    await foods.cacheOff(off('Produit', '2026-11-01T08:00:00.000Z'), { id: F2 });
    expect(await lookupBarcode(foods, '4006381333931', NOW)).toMatchObject({ kind: 'found', origin: 'off', cache: 'fresh', food: { id: F2 } });
  });

  it('cache expiré : trouvé mais périmé (à rafraîchir quand le réseau revient)', async () => {
    db = await openBaseDb(DEVICE);
    const foods = await db.data.repos.foods();
    await foods.cacheOff(off('Produit', '2026-05-01T08:00:00.000Z'), { id: F2 });
    expect(await lookupBarcode(foods, '4006381333931', NOW)).toMatchObject({ kind: 'found', origin: 'off', cache: 'expired' });
  });

  it('fiche personnelle du même code : prioritaire, sans notion de cache', async () => {
    db = await openBaseDb(DEVICE);
    const foods = await db.data.repos.foods();
    await foods.cacheOff(off('Produit', '2026-11-01T08:00:00.000Z'), { id: F2 });
    await foods.create(custom('Ma version', { barcode: '4006381333931' }), { id: F1 });
    expect(await lookupBarcode(foods, '4006381333931', NOW)).toMatchObject({ kind: 'found', origin: 'custom', cache: null, food: { id: F1 } });
  });

  it('code inconnu : « non trouvé », recours manuel proposé, aucun repas créé ; code invalide : refusé', async () => {
    db = await openBaseDb(DEVICE);
    const foods = await db.data.repos.foods();
    expect(await lookupBarcode(foods, '4012345678901', NOW)).toEqual({ kind: 'not-found', manual: true });
    expect(await lookupBarcode(foods, '123', NOW)).toEqual({ kind: 'invalid-code' });
    expect(await db.driver.select('SELECT * FROM meal_entry')).toEqual([]);
  });
});
