import type { WriteStamper } from '../../../domain/hlc';
import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import { isValidBarcode, offCacheState, validateFoodDraft, validatePortion, type FoodDraft, type FoodSource, type OffCacheState } from '../../../domain/nutrition/food';
import { isId, isIsoDateTime, type IsoDateTime } from '../../../domain/types';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { FoodPatch, FoodRecord, FoodRepository, PortionInput, PortionRecord } from '../foodRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface FoodRow extends SqlRow, SyncRow {
  readonly source: string;
  readonly barcode: string | null;
  readonly name: string;
  readonly brand: string | null;
  readonly kcal: number | null;
  readonly protein_g: number | null;
  readonly fat_g: number | null;
  readonly carb_g: number | null;
  readonly fiber_g: number | null;
  readonly fetched_at: string | null;
}

interface PortionRow extends SqlRow, SyncRow {
  readonly food_id: string;
  readonly label: string;
  readonly grams: number;
  readonly position: number;
}

const toFood = (row: FoodRow): FoodRecord => ({
  id: row.id,
  source: row.source as FoodSource,
  barcode: row.barcode,
  name: row.name,
  brand: row.brand,
  per100g: { kcal: row.kcal, proteinG: row.protein_g, fatG: row.fat_g, carbG: row.carb_g, fiberG: row.fiber_g },
  fetchedAt: row.fetched_at === null ? null : (row.fetched_at as IsoDateTime),
  ...readSyncMeta(row),
});

const toPortion = (row: PortionRow): PortionRecord => ({ id: row.id, foodId: row.food_id, label: row.label, grams: row.grams, position: row.position, ...readSyncMeta(row) });

/** Fiche normalisée avant écriture : nom et marque rognés, marque vide = absente. */
const normalized = (draft: FoodDraft): FoodDraft => ({ ...draft, name: draft.name.trim(), brand: draft.brand === null || draft.brand.trim() === '' ? null : draft.brand.trim() });

/** Récupération la plus récente d'abord ; une date illisible passe après toute date valide. */
const fetchedMs = (row: FoodRow): number => (row.fetched_at !== null && isIsoDateTime(row.fetched_at) ? Date.parse(row.fetched_at) : Number.NEGATIVE_INFINITY);
const newestFirst = (a: FoodRow, b: FoodRow): number => (fetchedMs(a) === fetchedMs(b) ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : fetchedMs(b) - fetchedMs(a));

export function createFoodRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): FoodRepository {
  const readFood = async (id: string): Promise<FoodRow | undefined> => (await db.select<FoodRow>('SELECT * FROM food WHERE id = ?', [id]))[0];
  const liveFood = async (id: string): Promise<FoodRow> => {
    const row = await readFood(id);
    if (!row || row.deleted_at !== null) throw new RepositoryError('not-found', 'food', id);
    return row;
  };
  const reloadFood = async (id: string): Promise<FoodRecord> => {
    const row = await readFood(id);
    if (!row) throw new RepositoryError('not-found', 'food', id);
    return toFood(row);
  };
  const readPortion = async (id: string): Promise<PortionRow | undefined> => (await db.select<PortionRow>('SELECT * FROM food_portion WHERE id = ?', [id]))[0];
  const livePortion = async (id: string): Promise<PortionRow> => {
    const row = await readPortion(id);
    if (!row || row.deleted_at !== null) throw new RepositoryError('not-found', 'food_portion', id);
    return row;
  };
  const reloadPortion = async (id: string): Promise<PortionRecord> => {
    const row = await readPortion(id);
    if (!row) throw new RepositoryError('not-found', 'food_portion', id);
    return toPortion(row);
  };
  const newId = async (requested: string | undefined, table: 'food' | 'food_portion'): Promise<string> => {
    const id = requested ?? ids.next();
    if (!isId(id)) throw new RepositoryError('invalid', table, id);
    const taken = table === 'food' ? await readFood(id) : await readPortion(id);
    if (taken !== undefined) throw new RepositoryError('conflict', table, id);
    return id;
  };
  const offRows = async (barcode: string): Promise<FoodRow[]> =>
    (await db.select<FoodRow>("SELECT * FROM food WHERE barcode = ? AND source = 'off' AND deleted_at IS NULL", [barcode])).sort(newestFirst);

  const writeValues = (draft: FoodDraft): (string | number | null)[] => [
    draft.source,
    draft.barcode,
    draft.name,
    draft.brand,
    draft.per100g.kcal,
    draft.per100g.proteinG,
    draft.per100g.fatG,
    draft.per100g.carbG,
    draft.per100g.fiberG,
    draft.fetchedAt,
  ];

  async function insertFood(draft: FoodDraft, requested: string | undefined): Promise<FoodRecord> {
    const id = await newId(requested, 'food');
    const stamp = stamper.next();
    await db.execute(
      `INSERT INTO food (id, source, barcode, name, brand, kcal, protein_g, fat_g, carb_g, fiber_g, fetched_at, created_at, updated_at, device_id, hlc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ...writeValues(draft), stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
    );
    return reloadFood(id);
  }

  return {
    async create(draft, options) {
      const clean = normalized(draft);
      // Seule une fiche personnelle se crée ici ; un produit Open Food Facts entre par `cacheOff`.
      if (clean.source !== 'custom' || validateFoodDraft(clean).length > 0) throw new RepositoryError('invalid', 'food', options?.id ?? '');
      return insertFood(clean, options?.id);
    },

    async update(id, patch: FoodPatch) {
      const row = await liveFood(id);
      if (row.source !== 'custom') throw new RepositoryError('invalid', 'food', id);
      const current = toFood(row);
      const merged = normalized({
        source: 'custom',
        barcode: patch.barcode === undefined ? current.barcode : patch.barcode,
        name: patch.name ?? current.name,
        brand: patch.brand === undefined ? current.brand : patch.brand,
        per100g: patch.per100g ?? current.per100g,
        fetchedAt: null,
      });
      if (validateFoodDraft(merged).length > 0) throw new RepositoryError('invalid', 'food', id);
      const stamp = stamper.next();
      await db.execute(
        `UPDATE food SET barcode = ?, name = ?, brand = ?, kcal = ?, protein_g = ?, fat_g = ?, carb_g = ?, fiber_g = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
        [merged.barcode, merged.name, merged.brand, merged.per100g.kcal, merged.per100g.proteinG, merged.per100g.fatG, merged.per100g.carbG, merged.per100g.fiberG, stamp.at, stamp.deviceId, stamp.hlc, id],
      );
      return reloadFood(id);
    },

    async softDelete(id) {
      await liveFood(id);
      const stamp = stamper.next();
      await db.execute('UPDATE food_portion SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE food_id = ? AND deleted_at IS NULL', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
      await db.execute('UPDATE food SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },

    async get(id, options) {
      const row = await readFood(id);
      if (!row || (row.deleted_at !== null && options?.includeDeleted !== true)) return null;
      return toFood(row);
    },

    async list(options) {
      const where = options?.source === undefined ? '' : 'AND source = ?';
      const rows = await db.select<FoodRow>(`SELECT * FROM food WHERE deleted_at IS NULL ${where} ORDER BY name COLLATE NOCASE, id`, options?.source === undefined ? [] : [options.source]);
      return rows.map(toFood);
    },

    async findByBarcode(barcode) {
      if (!isValidBarcode(barcode)) return null;
      const own = (await db.select<FoodRow>("SELECT * FROM food WHERE barcode = ? AND source = 'custom' AND deleted_at IS NULL ORDER BY updated_at DESC, id LIMIT 1", [barcode]))[0];
      if (own) return toFood(own);
      const off = (await offRows(barcode))[0];
      return off ? toFood(off) : null;
    },

    async cacheOff(draft, options) {
      const clean = normalized(draft);
      if (clean.source !== 'off' || validateFoodDraft(clean).length > 0 || clean.barcode === null) throw new RepositoryError('invalid', 'food', options?.id ?? '');
      const existing = (await offRows(clean.barcode))[0];
      if (!existing) return insertFood(clean, options?.id);
      const stamp = stamper.next();
      await db.execute(
        `UPDATE food SET name = ?, brand = ?, kcal = ?, protein_g = ?, fat_g = ?, carb_g = ?, fiber_g = ?, fetched_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
        [clean.name, clean.brand, clean.per100g.kcal, clean.per100g.proteinG, clean.per100g.fatG, clean.per100g.carbG, clean.per100g.fiberG, clean.fetchedAt, stamp.at, stamp.deviceId, stamp.hlc, existing.id],
      );
      return reloadFood(existing.id);
    },

    async offCacheStateOf(barcode, now) {
      if (!isValidBarcode(barcode)) return null;
      const row = (await offRows(barcode))[0];
      if (!row) return null;
      const state: OffCacheState = offCacheState(row.fetched_at ?? '', now);
      return { food: toFood(row), state };
    },

    async expireOffCache(now) {
      const rows = await db.select<FoodRow>("SELECT * FROM food WHERE source = 'off' AND deleted_at IS NULL");
      let expired = 0;
      for (const row of rows) {
        if (offCacheState(row.fetched_at ?? '', now) === 'fresh') continue;
        const stamp = stamper.next();
        await db.execute('UPDATE food SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, row.id]);
        expired += 1;
      }
      return expired;
    },

    async addPortion(foodId, input: PortionInput, options) {
      await liveFood(foodId);
      const [last] = await db.select<{ next: number }>('SELECT COALESCE(MAX(position) + 1, 0) AS next FROM food_portion WHERE food_id = ? AND deleted_at IS NULL', [foodId]);
      const portion = { label: input.label.trim(), grams: input.grams, position: input.position ?? last?.next ?? 0 };
      if (validatePortion(portion).length > 0) throw new RepositoryError('invalid', 'food_portion', options?.id ?? '');
      const id = await newId(options?.id, 'food_portion');
      const stamp = stamper.next();
      await db.execute('INSERT INTO food_portion (id, food_id, label, grams, position, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        id,
        foodId,
        portion.label,
        portion.grams,
        portion.position,
        stamp.at,
        stamp.at,
        stamp.deviceId,
        stamp.hlc,
      ]);
      return reloadPortion(id);
    },

    async updatePortion(id, patch) {
      const current = toPortion(await livePortion(id));
      const merged = { label: (patch.label ?? current.label).trim(), grams: patch.grams ?? current.grams, position: patch.position ?? current.position };
      if (validatePortion(merged).length > 0) throw new RepositoryError('invalid', 'food_portion', id);
      const stamp = stamper.next();
      await db.execute('UPDATE food_portion SET label = ?, grams = ?, position = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [
        merged.label,
        merged.grams,
        merged.position,
        stamp.at,
        stamp.deviceId,
        stamp.hlc,
        id,
      ]);
      return reloadPortion(id);
    },

    async removePortion(id) {
      await livePortion(id);
      const stamp = stamper.next();
      await db.execute('UPDATE food_portion SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },

    async listPortions(foodId) {
      const rows = await db.select<PortionRow>('SELECT * FROM food_portion WHERE food_id = ? AND deleted_at IS NULL ORDER BY position, id', [foodId]);
      return rows.map(toPortion);
    },
  };
}
