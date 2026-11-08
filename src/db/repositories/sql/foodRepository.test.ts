import { afterEach, describe, expect, it } from 'vitest';
import type { FoodDraft, Per100g } from '../../../domain/nutrition/food';
import type { DeviceId, IsoDateTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I4-02 : `FoodRepository` (tables `food` et `food_portion`, migration 0008) : fiches personnelles et cache Open Food Facts validés à
 * l'écriture, portions, provenance, code-barres, expiration à 90 jours, capture de synchro. Fixtures synthétiques.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f8' as DeviceId;
const F1 = '7d3c2b1a-0000-4000-8000-000000000001';
const F2 = '7d3c2b1a-0000-4000-8000-000000000002';
const F3 = '7d3c2b1a-0000-4000-8000-000000000003';
const P1 = '7d3c2b1a-0000-4000-8000-0000000000a1';
const P2 = '7d3c2b1a-0000-4000-8000-0000000000a2';
const EAN = '4006381333931';
const EAN2 = '96385074';
let db: TestDb;
afterEach(async () => db.close());

const per = (over: Partial<Per100g> = {}): Per100g => ({ kcal: 120, proteinG: 10, fatG: 5, carbG: 8, fiberG: 2, ...over });
const custom = (over: Partial<FoodDraft> = {}): FoodDraft => ({ source: 'custom', barcode: null, name: 'Fiche synthétique', brand: null, per100g: per(), fetchedAt: null, ...over });
const offDraft = (over: Partial<FoodDraft> = {}): FoodDraft => custom({ source: 'off', barcode: EAN, name: 'Produit synthétique', brand: 'Marque', fetchedAt: '2026-10-01T08:00:00.000Z' as IsoDateTime, ...over });
const repo = async () => db.data.repos.foods();
const outbox = () => db.driver.select<{ table_name: string; row_id: string; field: string }>("SELECT table_name, row_id, field FROM sync_outbox WHERE table_name IN ('food', 'food_portion') ORDER BY seq");

describe('FoodRepository : fiches personnelles', () => {
  it('create : relue telle quelle, provenance « custom », inconnu conservé null, mise en file en ligne entière', async () => {
    db = await openBaseDb(DEVICE);
    const created = await (await repo()).create(custom({ name: '  Fiche  ', per100g: per({ fiberG: null }) }), { id: F1 });
    expect(created).toMatchObject({ id: F1, source: 'custom', name: 'Fiche', barcode: null, brand: null, fetchedAt: null, deletedAt: null, deviceId: DEVICE, per100g: per({ fiberG: null }) });
    expect(await (await repo()).get(F1)).toEqual(created);
    expect(await outbox()).toEqual([{ table_name: 'food', row_id: F1, field: '*' }]);
  });

  it('create : fiche invalide refusée sans rien écrire (nom, valeurs, code-barres, fiche vide, source Ciqual)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    for (const bad of [
      custom({ name: ' ' }),
      custom({ per100g: per({ kcal: -1 }) }),
      custom({ per100g: per({ kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null }) }),
      custom({ barcode: '1234567890123' }),
      { ...custom(), source: 'ciqual' as never },
    ])
      await expect(r.create(bad, { id: F1 })).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT * FROM food')).toEqual([]);
    expect(await outbox()).toEqual([]);
  });

  it('create : identifiant non UUID ou déjà pris (même supprimé) refusé', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await expect(r.create(custom(), { id: 'pomme' })).rejects.toMatchObject({ code: 'invalid' });
    await r.create(custom(), { id: F1 });
    await expect(r.create(custom(), { id: F1 })).rejects.toMatchObject({ code: 'conflict' });
    await r.softDelete(F1);
    await expect(r.create(custom(), { id: F1 })).rejects.toMatchObject({ code: 'conflict' });
  });

  it('identifiant fabriqué (UUID) quand il est omis', async () => {
    db = await openBaseDb(DEVICE);
    const created = await (await repo()).create(custom());
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('update : champs fournis seulement, validés ensemble ; la modification est publiée champ par champ', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.create(custom({ barcode: EAN }), { id: F1 });
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const updated = await r.update(F1, { name: 'Nouveau nom', per100g: per({ kcal: 130 }) });
    expect(updated).toMatchObject({ name: 'Nouveau nom', barcode: EAN, per100g: per({ kcal: 130 }) });
    expect((await outbox()).map((o) => o.field).sort()).toEqual(['kcal', 'name']);
    await expect(r.update(F1, { per100g: per({ kcal: 950 }) })).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.update(F2, { name: 'x' })).rejects.toMatchObject({ code: 'not-found' });
    expect((await r.get(F1))?.per100g.kcal).toBe(130);
  });

  it('une fiche issue d’Open Food Facts n’est pas modifiable (la corriger = créer une fiche personnelle du même code)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.cacheOff(offDraft(), { id: F1 });
    await expect(r.update(F1, { name: 'Autre' })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('softDelete : fiche et portions supprimées ensemble (mêmes déclencheurs de suppression), get() la masque', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.create(custom(), { id: F1 });
    await r.addPortion(F1, { label: '1 tranche', grams: 30 }, { id: P1 });
    await db.data.transaction(async (repos) => (await repos.foods()).softDelete(F1));
    expect(await r.get(F1)).toBeNull();
    expect((await r.get(F1, { includeDeleted: true }))?.deletedAt).not.toBeNull();
    expect(await r.listPortions(F1)).toEqual([]);
    expect((await db.driver.select<{ deleted_at: string | null }>('SELECT deleted_at FROM food_portion WHERE id = ?', [P1]))[0]?.deleted_at).not.toBeNull();
    await expect(r.softDelete(F1)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('list : par nom sans accent ni casse ; filtre de provenance ; supprimées masquées', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.create(custom({ name: 'banane' }), { id: F1 });
    await r.create(custom({ name: 'Abricot' }), { id: F2 });
    await r.cacheOff(offDraft({ name: 'Yaourt' }), { id: F3 });
    expect((await r.list()).map((f) => f.name)).toEqual(['Abricot', 'banane', 'Yaourt']);
    expect((await r.list({ source: 'off' })).map((f) => f.id)).toEqual([F3]);
    await r.softDelete(F2);
    expect((await r.list({ source: 'custom' })).map((f) => f.id)).toEqual([F1]);
  });
});

describe('FoodRepository : portions', () => {
  it('ajout, lecture ordonnée, modification, retrait ; validées', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.create(custom(), { id: F1 });
    await r.addPortion(F1, { label: 'Grande', grams: 60, position: 1 }, { id: P2 });
    await r.addPortion(F1, { label: 'Petite', grams: 30, position: 0 }, { id: P1 });
    expect((await r.listPortions(F1)).map((p) => [p.id, p.label, p.grams, p.position])).toEqual([
      [P1, 'Petite', 30, 0],
      [P2, 'Grande', 60, 1],
    ]);
    expect(await r.updatePortion(P1, { grams: 35 })).toMatchObject({ label: 'Petite', grams: 35 });
    await expect(r.updatePortion(P1, { grams: 0 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.addPortion(F1, { label: '', grams: 10 })).rejects.toMatchObject({ code: 'invalid' });
    await r.removePortion(P2);
    expect((await r.listPortions(F1)).map((p) => p.id)).toEqual([P1]);
    await expect(r.removePortion(P2)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('portion d’une fiche absente ou supprimée : refusée (aucune portion orpheline créée ici)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await expect(r.addPortion(F1, { label: 'x', grams: 10 })).rejects.toMatchObject({ code: 'not-found' });
    await r.create(custom(), { id: F1 });
    await r.softDelete(F1);
    await expect(r.addPortion(F1, { label: 'x', grams: 10 })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('position omise : à la suite des portions existantes', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.create(custom(), { id: F1 });
    expect((await r.addPortion(F1, { label: 'a', grams: 10 })).position).toBe(0);
    expect((await r.addPortion(F1, { label: 'b', grams: 20 })).position).toBe(1);
  });
});

describe('FoodRepository : code-barres et cache Open Food Facts (aucun appel réseau ici)', () => {
  const NOW = '2026-11-08T12:00:00.000Z' as IsoDateTime;

  it('findByBarcode : fiche personnelle avant le cache OFF ; code inconnu ou invalide : null (jamais de repas créé)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.cacheOff(offDraft(), { id: F1 });
    expect((await r.findByBarcode(EAN))?.source).toBe('off');
    await r.create(custom({ barcode: EAN, name: 'Ma version corrigée' }), { id: F2 });
    expect((await r.findByBarcode(EAN))?.id).toBe(F2);
    expect(await r.findByBarcode(EAN2)).toBeNull();
    expect(await r.findByBarcode('pas un code')).toBeNull();
  });

  it('cacheOff : un seul enregistrement par code, rafraîchi en place ; deux lignes concurrentes : la plus récente gagne', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const first = await r.cacheOff(offDraft({ fetchedAt: '2026-09-01T08:00:00.000Z' as IsoDateTime }), { id: F1 });
    db.clock.advance(1_000);
    const again = await r.cacheOff(offDraft({ name: 'Produit corrigé par OFF', fetchedAt: '2026-11-01T08:00:00.000Z' as IsoDateTime }), { id: F2 });
    expect(again.id).toBe(first.id);
    expect(again).toMatchObject({ name: 'Produit corrigé par OFF', fetchedAt: '2026-11-01T08:00:00.000Z' });
    expect(await db.driver.select("SELECT id FROM food WHERE source = 'off'")).toEqual([{ id: F1 }]);
    // Ligne reçue d'un autre appareil pour le même code (aucun index unique : les deux existent) : la plus récemment récupérée est lue.
    await db.driver.execute(
      "INSERT INTO food (id, source, barcode, name, kcal, protein_g, fat_g, carb_g, fiber_g, fetched_at, created_at, updated_at, device_id, hlc) SELECT ?, source, barcode, 'Plus récente', kcal, protein_g, fat_g, carb_g, fiber_g, ?, created_at, updated_at, device_id, hlc FROM food WHERE id = ?",
      [F3, '2026-11-05T08:00:00.000Z', F1],
    );
    expect((await r.findByBarcode(EAN))?.id).toBe(F3);
  });

  it('cacheOff : produit invalide refusé (fiche Perso déguisée, date absente, code invalide, aucune valeur)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    for (const bad of [custom(), offDraft({ fetchedAt: null }), offDraft({ barcode: '1234567890123' }), offDraft({ per100g: per({ kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null }) })])
      await expect(r.cacheOff(bad, { id: F1 })).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT * FROM food')).toEqual([]);
  });

  it('état du cache à la lecture : valide, expiré, invalide', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.cacheOff(offDraft({ fetchedAt: '2026-10-20T08:00:00.000Z' as IsoDateTime }), { id: F1 });
    await r.cacheOff(offDraft({ barcode: EAN2, fetchedAt: '2026-06-01T08:00:00.000Z' as IsoDateTime }), { id: F2 });
    expect(await r.offCacheStateOf(EAN, NOW)).toEqual({ food: expect.objectContaining({ id: F1 }), state: 'fresh' });
    expect(await r.offCacheStateOf(EAN2, NOW)).toEqual({ food: expect.objectContaining({ id: F2 }), state: 'expired' });
    expect(await r.offCacheStateOf('4012345678901', NOW)).toBeNull();
    // Date illisible reçue d'une autre version : jamais « valide ».
    await db.driver.execute("UPDATE food SET fetched_at = 'hier' WHERE id = ?", [F1]);
    expect((await r.offCacheStateOf(EAN, NOW))?.state).toBe('invalid');
  });

  it('expireOffCache : supprime (logiquement) les produits au-delà de 90 jours, jamais une fiche personnelle', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.cacheOff(offDraft({ fetchedAt: '2026-10-20T08:00:00.000Z' as IsoDateTime }), { id: F1 });
    await r.cacheOff(offDraft({ barcode: EAN2, fetchedAt: '2026-06-01T08:00:00.000Z' as IsoDateTime }), { id: F2 });
    await r.create(custom({ barcode: '036000291452' }), { id: F3 });
    expect(await r.expireOffCache(NOW)).toBe(1);
    expect((await r.list()).map((f) => f.id).sort()).toEqual([F1, F3]);
    expect(await r.expireOffCache(NOW)).toBe(0);
  });
});
