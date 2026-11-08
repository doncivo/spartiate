import type { WriteStamper } from '../../../domain/hlc';
import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import type { EntrySource } from '../../../domain/nutrition/food';
import { validateMealEntry, type EntryMethod, type MealEntryDraft } from '../../../domain/nutrition/mealEntry';
import { isId, type LocalDate, type LocalTime } from '../../../domain/types';
import type { SqlDriver, SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { MealEntryRecord, MealEntryRepository, RecentFood } from '../mealEntryRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface EntryRow extends SqlRow, SyncRow {
  readonly date: string;
  readonly time: string;
  readonly food_id: string | null;
  readonly food_name: string;
  readonly source: string;
  readonly grams: number | null;
  readonly kcal: number | null;
  readonly protein_g: number | null;
  readonly fat_g: number | null;
  readonly carb_g: number | null;
  readonly method: string;
  readonly confidence: number | null;
}

const toRecord = (row: EntryRow): MealEntryRecord => ({
  id: row.id,
  date: row.date as LocalDate,
  time: row.time as LocalTime,
  foodId: row.food_id,
  foodName: row.food_name,
  source: row.source as EntrySource,
  grams: row.grams,
  kcal: row.kcal,
  proteinG: row.protein_g,
  fatG: row.fat_g,
  carbG: row.carb_g,
  method: row.method as EntryMethod,
  confidence: row.confidence,
  ...readSyncMeta(row),
});

const ORDER = 'ORDER BY date, time, created_at, id';

export function createMealEntryRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): MealEntryRepository {
  const atomic = <T>(work: (inTx: MealEntryRepository) => Promise<T>): Promise<T> | null =>
    typeof (db as Partial<SqlDriver>).transaction === 'function' ? (db as SqlDriver).transaction((tx) => work(createMealEntryRepository(tx, stamper, ids))) : null;
  const read = async (id: string): Promise<EntryRow | undefined> => (await db.select<EntryRow>('SELECT * FROM meal_entry WHERE id = ?', [id]))[0];
  const live = async (id: string): Promise<EntryRow> => {
    const row = await read(id);
    if (!row || row.deleted_at !== null) throw new RepositoryError('not-found', 'meal_entry', id);
    return row;
  };
  const reload = async (id: string): Promise<MealEntryRecord> => {
    const row = await read(id);
    if (!row) throw new RepositoryError('not-found', 'meal_entry', id);
    return toRecord(row);
  };
  /** Valide et normalise (nom rogné) ; refus `'invalid'`. */
  const check = (draft: MealEntryDraft, id: string): MealEntryDraft => {
    const clean = { ...draft, foodName: draft.foodName.trim() };
    if (validateMealEntry(clean).length > 0) throw new RepositoryError('invalid', 'meal_entry', id);
    return clean;
  };
  const insert = async (clean: MealEntryDraft, id: string): Promise<void> => {
    const stamp = stamper.next();
    await db.execute(
      `INSERT INTO meal_entry (id, date, time, food_id, food_name, source, grams, kcal, protein_g, fat_g, carb_g, method, confidence, created_at, updated_at, device_id, hlc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, clean.date, clean.time, clean.foodId, clean.foodName, clean.source, clean.grams, clean.kcal, clean.proteinG, clean.fatG, clean.carbG, clean.method, clean.confidence, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
    );
  };
  const freshId = async (requested: string | undefined): Promise<string> => {
    const id = requested ?? ids.next();
    if (!isId(id)) throw new RepositoryError('invalid', 'meal_entry', id);
    if ((await read(id)) !== undefined) throw new RepositoryError('conflict', 'meal_entry', id);
    return id;
  };

  return {
    async create(draft, options) {
      const id = await freshId(options?.id);
      const clean = check(draft, id);
      await insert(clean, id);
      return reload(id);
    },

    async createMany(drafts) {
      // Appelé sur le driver, ouvre sa propre transaction ; dans `DataAccess.transaction`, écrit directement (motif `atomic` du workoutRepository).
      const outer = atomic((r) => r.createMany(drafts));
      if (outer) return outer;
      // Tout est validé avant la première écriture : une entrée invalide n'en écrit aucune.
      const planned: { id: string; clean: MealEntryDraft }[] = [];
      for (const draft of drafts) {
        const id = ids.next();
        planned.push({ id, clean: check(draft, id) });
      }
      const out: MealEntryRecord[] = [];
      for (const { id, clean } of planned) {
        await insert(clean, id);
        out.push(await reload(id));
      }
      return out;
    },

    async update(id, patch) {
      const row = await live(id);
      const current = toRecord(row);
      const merged: MealEntryDraft = {
        date: patch.date ?? current.date,
        time: patch.time ?? current.time,
        foodId: patch.foodId === undefined ? current.foodId : patch.foodId,
        foodName: patch.foodName ?? current.foodName,
        source: patch.source ?? current.source,
        grams: patch.grams === undefined ? current.grams : patch.grams,
        kcal: patch.kcal === undefined ? current.kcal : patch.kcal,
        proteinG: patch.proteinG === undefined ? current.proteinG : patch.proteinG,
        fatG: patch.fatG === undefined ? current.fatG : patch.fatG,
        carbG: patch.carbG === undefined ? current.carbG : patch.carbG,
        method: patch.method ?? current.method,
        confidence: patch.confidence === undefined ? current.confidence : patch.confidence,
      };
      const clean = check(merged, id);
      const stamp = stamper.next();
      await db.execute(
        `UPDATE meal_entry SET date = ?, time = ?, food_id = ?, food_name = ?, source = ?, grams = ?, kcal = ?, protein_g = ?, fat_g = ?, carb_g = ?, method = ?, confidence = ?,
           updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
        [clean.date, clean.time, clean.foodId, clean.foodName, clean.source, clean.grams, clean.kcal, clean.proteinG, clean.fatG, clean.carbG, clean.method, clean.confidence, stamp.at, stamp.deviceId, stamp.hlc, id],
      );
      return reload(id);
    },

    async softDelete(id) {
      await live(id);
      const stamp = stamper.next();
      await db.execute('UPDATE meal_entry SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },

    async get(id, options) {
      const row = await read(id);
      if (!row || (row.deleted_at !== null && options?.includeDeleted !== true)) return null;
      return toRecord(row);
    },

    async listByDate(date) {
      return (await db.select<EntryRow>(`SELECT * FROM meal_entry WHERE date = ? AND deleted_at IS NULL ${ORDER}`, [date])).map(toRecord);
    },

    async listBetween(from, to) {
      return (await db.select<EntryRow>(`SELECT * FROM meal_entry WHERE date >= ? AND date <= ? AND deleted_at IS NULL ${ORDER}`, [from, to])).map(toRecord);
    },

    async recentFoods(limit) {
      const rows = await db.select<EntryRow>(
        `SELECT m.* FROM meal_entry m
         WHERE m.deleted_at IS NULL AND m.food_id IS NOT NULL AND m.method <> 'quickadd' AND m.grams IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM meal_entry n
             WHERE n.deleted_at IS NULL AND n.food_id = m.food_id AND n.method <> 'quickadd' AND n.grams IS NOT NULL
               AND (n.date > m.date OR (n.date = m.date AND (n.time > m.time OR (n.time = m.time AND (n.created_at > m.created_at OR (n.created_at = m.created_at AND n.id > m.id)))))))
         ORDER BY m.date DESC, m.time DESC, m.created_at DESC, m.id DESC LIMIT ?`,
        [Math.max(0, Math.floor(limit))],
      );
      return rows.map(
        (row): RecentFood => ({
          foodId: row.food_id ?? '',
          foodName: row.food_name,
          source: row.source as EntrySource,
          lastGrams: row.grams ?? 0,
          lastDate: row.date as LocalDate,
          lastTime: row.time as LocalTime,
          lastMethod: row.method as EntryMethod,
        }),
      );
    },
  };
}
