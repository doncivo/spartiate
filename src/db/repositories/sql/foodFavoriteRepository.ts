import type { WriteStamper } from '../../../domain/hlc';
import { FAVORITES_MAX, toFavorite, type Favorite } from '../../../domain/nutrition/favorites';
import { favoriteId } from '../../../domain/sync/naturalIds';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { FoodFavoriteRepository } from '../foodFavoriteRepository';

interface FavoriteRow extends SqlRow {
  readonly id: string;
  readonly source: string;
  readonly ref: string;
  readonly deleted_at: string | null;
}

/** Ordre de la liste : le plus récent d'abord ; à égalité d'instant (même milliseconde), l'écriture la plus récente (HLC). */
const LIVE_ORDER = 'WHERE deleted_at IS NULL ORDER BY added_at DESC, hlc DESC';

/**
 * Favoris publiés (FIX-0181, D-171). Toute écriture prend son tampon HLC juste avant son `db.execute`. Validation par le domaine
 * (`toFavorite`) avant toute écriture ; les CHECK de la migration 0015 restent le dernier recours.
 */
export function createFoodFavoriteRepository(db: SqlExecutor, stamper: WriteStamper): FoodFavoriteRepository {
  const read = async (id: string): Promise<FavoriteRow | undefined> => (await db.select<FavoriteRow>('SELECT id, source, ref, deleted_at FROM food_favorite WHERE id = ?', [id]))[0];

  /** Au-delà de 200 favoris vivants, les plus anciens sortent (suppression logique, publiée). */
  async function trim(): Promise<void> {
    const live = await db.select<{ id: string }>(`SELECT id FROM food_favorite ${LIVE_ORDER}`);
    for (const { id } of live.slice(FAVORITES_MAX)) {
      const stamp = stamper.next();
      await db.execute('UPDATE food_favorite SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    }
  }

  return {
    async list() {
      const rows = await db.select<FavoriteRow>(`SELECT id, source, ref, deleted_at FROM food_favorite ${LIVE_ORDER}`);
      const out: Favorite[] = [];
      for (const row of rows) {
        const item = toFavorite(row.source, row.ref);
        if (item !== null && row.id === favoriteId(item.ref)) out.push(item);
        if (out.length === FAVORITES_MAX) break;
      }
      return out;
    },

    async add(item) {
      const valid = toFavorite(item.source, item.ref);
      if (valid === null) throw new RepositoryError('invalid', 'food_favorite', String(item.ref));
      const id = favoriteId(valid.ref);
      const row = await read(id);
      if (row && row.deleted_at === null) return;
      const stamp = stamper.next();
      if (row) {
        await db.execute('UPDATE food_favorite SET source = ?, added_at = ?, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [valid.source, stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
      } else {
        await db.execute('INSERT INTO food_favorite (id, source, ref, added_at, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, valid.source, valid.ref, stamp.at, stamp.at, stamp.at, stamp.deviceId, stamp.hlc]);
      }
      await trim();
    },

    async remove(ref) {
      const row = await read(favoriteId(ref));
      if (!row || row.deleted_at !== null) return;
      const stamp = stamper.next();
      await db.execute('UPDATE food_favorite SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, row.id]);
    },

    async importLocal(items) {
      const seen = new Set<string>();
      const valid: Favorite[] = [];
      for (const item of items) {
        const fav = toFavorite(item.source, item.ref);
        if (fav === null || seen.has(fav.ref)) continue;
        seen.add(fav.ref);
        valid.push(fav);
        if (valid.length === FAVORITES_MAX) break;
      }
      // Ordre gardé : le i-ème favori (0 = le plus récent) est daté i millisecondes avant le premier horodatage de la reprise.
      let base: number | null = null;
      let inserted = 0;
      for (const [i, fav] of valid.entries()) {
        const id = favoriteId(fav.ref);
        if (await read(id)) continue;
        const stamp = stamper.next();
        base ??= Date.parse(stamp.at);
        await db.execute('INSERT INTO food_favorite (id, source, ref, added_at, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, fav.source, fav.ref, new Date(base - i).toISOString(), stamp.at, stamp.at, stamp.deviceId, stamp.hlc]);
        inserted += 1;
      }
      if (inserted > 0) await trim();
      return inserted;
    },
  };
}
