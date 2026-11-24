import { afterEach, describe, expect, it } from 'vitest';
import type { FoodDraft } from '../../../domain/nutrition/food';
import type { DeviceId, IsoDateTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** NUTRI-0292 (C-045) : un UPC-A sur 12 chiffres et son EAN-13 (zéro en tête) désignent le même produit dans le cache. Fixtures synthétiques. */
const DEVICE = '60000000-0000-4000-8000-0000000000f8' as DeviceId;
const F1 = '7d3c2b1a-0000-4000-8000-000000000011';
const F2 = '7d3c2b1a-0000-4000-8000-000000000012';
const UPCA = '036000291452';
const EAN13 = '0036000291452';
let db: TestDb;
afterEach(async () => db.close());

const off = (barcode: string): FoodDraft => ({ source: 'off', barcode, name: 'Produit', brand: null, per100g: { kcal: 100, proteinG: 1, fatG: 1, carbG: 1, fiberG: null }, fetchedAt: '2026-11-20T08:00:00.000Z' as IsoDateTime });

describe('C-045 : UPC-A et EAN-13 équivalents', () => {
  it('fiche gardée sous 12 chiffres, code lu sur 13 : retrouvée', async () => {
    db = await openBaseDb(DEVICE);
    const r = await db.data.repos.foods();
    await r.cacheOff(off(UPCA), { id: F1 });
    expect((await r.findByBarcode(EAN13))?.id).toBe(F1);
    expect((await r.offCacheStateOf(EAN13, '2026-11-24T08:00:00.000Z' as IsoDateTime))?.food.id).toBe(F1);
  });

  it('fiche gardée sous 13 chiffres, code saisi sur 12 : retrouvée ; la mise à jour du cache n\'ajoute pas de doublon', async () => {
    db = await openBaseDb(DEVICE);
    const r = await db.data.repos.foods();
    await r.cacheOff(off(EAN13), { id: F2 });
    expect((await r.findByBarcode(UPCA))?.id).toBe(F2);
    await r.cacheOff(off(UPCA));
    expect((await r.list({ source: 'off' })).length).toBe(1);
  });
});
