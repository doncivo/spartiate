import { afterEach, describe, expect, it } from 'vitest';
import { FAVORITES_MAX } from '../../../domain/nutrition/favorites';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * FIX-0181 (D-171, D-79 révisée par Ali le 12/11) : `FoodFavoriteRepository` (table `food_favorite`, migration 0015). Favoris PUBLIÉS, écrits par les
 * deux appareils ; identifiant naturel `favorite|<ref>`. Liste vivante la plus récente d'abord, bornée à 200 (le plus ancien sort, suppression
 * logique). Reprise des favoris locaux (`nutrition.favorites`) : une fois, sans perte, idempotente, jamais au-dessus d'une ligne existante.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000fb' as DeviceId;
const U = (n: number): string => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db: TestDb;
afterEach(async () => db.close());
const repo = async () => db.data.repos.foodFavorites();
const outbox = () => db.driver.select<{ row_id: string; field: string }>("SELECT row_id, field FROM sync_outbox WHERE table_name = 'food_favorite' ORDER BY seq");
const refs = async () => (await (await repo()).list()).map((f) => f.ref);

describe('FoodFavoriteRepository', () => {
  it('add : une ligne `favorite|ref` publiée en ligne entière, relue en tête ; déjà favori : aucune écriture', async () => {
    db = await openBaseDb(DEVICE, '2026-11-13T08:00:00.000Z');
    await (await repo()).add({ source: 'custom', ref: U(1) });
    db.clock.advance(1_000);
    await (await repo()).add({ source: 'ciqual', ref: 'ciqual:20' });
    expect(await (await repo()).list()).toEqual([{ source: 'ciqual', ref: 'ciqual:20' }, { source: 'custom', ref: U(1) }]);
    expect(await outbox()).toEqual([{ row_id: `favorite|${U(1)}`, field: '*' }, { row_id: 'favorite|ciqual:20', field: '*' }]);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    await (await repo()).add({ source: 'custom', ref: U(1) });
    expect(await outbox()).toEqual([]);
    expect(await refs()).toEqual(['ciqual:20', U(1)]);
  });

  it('remove : suppression logique (champ deleted_at publié) ; ajout suivant : ligne rétablie, en tête', async () => {
    db = await openBaseDb(DEVICE, '2026-11-13T08:00:00.000Z');
    await (await repo()).add({ source: 'custom', ref: U(1) });
    db.clock.advance(1_000);
    await (await repo()).add({ source: 'custom', ref: U(2) });
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    await (await repo()).remove(U(1));
    expect(await refs()).toEqual([U(2)]);
    expect(await outbox()).toEqual([{ row_id: `favorite|${U(1)}`, field: 'deleted_at' }]);
    await (await repo()).remove(U(1));
    await (await repo()).remove(U(9));
    expect(await outbox()).toEqual([{ row_id: `favorite|${U(1)}`, field: 'deleted_at' }]);
    db.clock.advance(1_000);
    await (await repo()).add({ source: 'custom', ref: U(1) });
    expect(await refs()).toEqual([U(1), U(2)]);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM food_favorite')).toEqual([{ n: 2 }]);
  });

  it('référence ou provenance invalide : refusée, rien n’est écrit', async () => {
    db = await openBaseDb(DEVICE);
    for (const bad of [{ source: 'custom', ref: 'ciqual:20' }, { source: 'ciqual', ref: U(1) }, { source: 'custom', ref: 'pas un id' }, { source: 'autre', ref: U(1) }]) {
      await expect((await repo()).add(bad as never), JSON.stringify(bad)).rejects.toMatchObject({ code: 'invalid' });
    }
    expect(await db.driver.select('SELECT 1 FROM food_favorite')).toEqual([]);
  });

  it(`borne : ${String(FAVORITES_MAX)} favoris vivants au plus, le plus ancien sort (suppression logique publiée)`, async () => {
    db = await openBaseDb(DEVICE, '2026-11-13T08:00:00.000Z');
    for (let i = 1; i <= FAVORITES_MAX + 1; i += 1) {
      db.clock.advance(1_000);
      await (await repo()).add({ source: 'custom', ref: U(i) });
    }
    const list = await refs();
    expect(list).toHaveLength(FAVORITES_MAX);
    expect(list[0]).toBe(U(FAVORITES_MAX + 1));
    expect(list).not.toContain(U(1));
    expect(await db.driver.select('SELECT deleted_at IS NOT NULL AS gone FROM food_favorite WHERE id = ?', [`favorite|${U(1)}`])).toEqual([{ gone: 1 }]);
  });

  it('ligne illisible (provenance inconnue venue d’une version plus récente) : écartée à la lecture, sans exception', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).add({ source: 'custom', ref: U(1) });
    await db.driver.execute('INSERT OR IGNORE INTO sync_guard (id) VALUES (1)');
    await db.driver.execute("INSERT INTO food_favorite (id, source, ref, added_at, created_at, updated_at, device_id, hlc) VALUES ('favorite|ciqual:30', 'futur', 'ciqual:30', '2026-11-13T09:00:00.000Z', '2026-11-13T09:00:00.000Z', '2026-11-13T09:00:00.000Z', ?, '001794300000000-0000-60000000-0000-4000-8000-0000000000fb')", [DEVICE]);
    await db.driver.execute('DELETE FROM sync_guard');
    expect(await refs()).toEqual([U(1)]);
  });

  describe('reprise des favoris locaux (nutrition.favorites, D-79 → D-171)', () => {
    it('une fois, sans perte : ordre gardé (le plus récent d’abord), publiée comme toute écriture ; deuxième passage : rien', async () => {
      db = await openBaseDb(DEVICE, '2026-11-13T08:00:00.000Z');
      const local = [{ source: 'custom', ref: U(3) }, { source: 'ciqual', ref: 'ciqual:20' }, { source: 'off', ref: U(1) }] as const;
      expect(await (await repo()).importLocal(local)).toBe(3);
      expect(await (await repo()).list()).toEqual(local);
      expect((await outbox()).map((r) => r.field)).toEqual(['*', '*', '*']);
      await db.driver.execute('DELETE FROM sync_outbox');
      db.clock.advance(1_000);
      expect(await (await repo()).importLocal(local)).toBe(0);
      expect(await outbox()).toEqual([]);
      expect(await (await repo()).list()).toEqual(local);
    });

    it('ne touche jamais une ligne existante : un favori déjà présent (même supprimé ailleurs) n’est ni dupliqué ni rétabli', async () => {
      db = await openBaseDb(DEVICE, '2026-11-13T08:00:00.000Z');
      await (await repo()).add({ source: 'custom', ref: U(1) });
      db.clock.advance(1_000);
      await (await repo()).add({ source: 'custom', ref: U(2) });
      db.clock.advance(1_000);
      await (await repo()).remove(U(2));
      db.clock.advance(1_000);
      expect(await (await repo()).importLocal([{ source: 'custom', ref: U(2) }, { source: 'custom', ref: U(1) }, { source: 'ciqual', ref: 'ciqual:20' }])).toBe(1);
      expect(await refs()).toEqual(['ciqual:20', U(1)]);
      expect(await db.driver.select('SELECT COUNT(*) AS n FROM food_favorite')).toEqual([{ n: 3 }]);
    });
  });
});
