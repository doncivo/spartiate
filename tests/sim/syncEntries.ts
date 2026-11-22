import type { WriteStamp } from '../../src/domain/hlc';
import type { Task } from '../../src/domain/model';
import type { IsoDateTime, LocalDate, LocalTime, SpaceId, TaskId } from '../../src/domain/types';
import type { SqlDriver, SqlRow, SqlValue } from '../../src/db/driver';

/**
 * CLEAN-03 (D-201) : « entrées simulées » des appareils au schéma Spartiate. Les scénarios de synchro hérités (tâche à titre, note, date, heure,
 * état, suppression) gardent leur forme et leurs assertions, mais écrivent une table PUBLIÉE de production : `meal_entry` (deux appareils
 * écrivains, ni parent, ni identité naturelle, ni condition de publication). Écriture SQL directe et horodatée (`updated_at`, `device_id`,
 * `hlc`), comme un dépôt : les déclencheurs de la migration réelle capturent chaque champ modifié (`sync_outbox`, `sync_field_clock`).
 *
 * Correspondance (fixe, réversible) : titre = `food_name` ; note = `food_id` (chaîne vide = NULL) ; état `todo` = `method` `search`, `done` =
 * `quickadd` ; date = `date` ; heure = `time` (sans heure = `00:00`). Note vide : le banc legacy écrit `''`, ici NULL ; les lectures du banc
 * (`SIM_ENTRY_SELECT`, `get`) rendent `''` dans les deux cas, et vider une note non vide est capturé comme une écriture du champ (BL-133). Tout autre champ de tâche demandé est refusé (erreur), jamais ignoré :
 * un scénario qui en dépend reste sur le banc legacy.
 */
export const SIM_ENTRY_TABLE = 'meal_entry';
const DONE = 'quickadd';
const TODO = 'search';
const NO_TIME = '00:00';
export const SIM_ENTRY_SELECT = `id, food_name AS title, COALESCE(food_id, '') AS note, CASE method WHEN '${DONE}' THEN 'done' ELSE 'todo' END AS status, date`;
const MAPPED = new Set(['id', 'title', 'note', 'date', 'time', 'status']);
const SPACE = '00000000-0000-4000-8000-000000000001' as SpaceId;

interface EntryRow extends SqlRow {
  readonly id: string;
  readonly title: string;
  readonly note: string;
  readonly status: 'todo' | 'done';
  readonly date: string;
  readonly time: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
  readonly device_id: string;
  readonly hlc: string;
}

function refuseUnmapped(fields: object, schema: string): void {
  const extra = Object.keys(fields).filter((key) => !MAPPED.has(key));
  if (extra.length > 0) throw new Error(`banc ${schema} : champ(s) de tâche sans équivalent dans ${SIM_ENTRY_TABLE} : ${extra.join(', ')}`);
}

function fieldsOf(patch: Partial<Task>): Record<string, SqlValue> {
  const out: Record<string, SqlValue> = {};
  if (patch.title !== undefined) out.food_name = patch.title;
  if (patch.note !== undefined) out.food_id = patch.note === '' ? null : patch.note;
  if (patch.status !== undefined) out.method = patch.status === 'done' ? DONE : TODO;
  if (patch.date !== undefined) {
    if (patch.date === null) throw new Error(`${SIM_ENTRY_TABLE} : date obligatoire`);
    out.date = patch.date;
  }
  if (patch.time !== undefined) out.time = patch.time ?? NO_TIME;
  return out;
}

/** Ligne lue -> forme `Task` (champs non portés : valeurs par défaut d'une tâche locale du banc). */
function toTask(row: EntryRow): Task {
  return {
    id: row.id as TaskId,
    spaceId: SPACE,
    projectId: null,
    title: row.title,
    note: row.note,
    date: row.date as LocalDate,
    time: row.time === NO_TIME ? null : (row.time as LocalTime),
    status: row.status,
    doneAt: null,
    sortOrder: 0,
    carriedOver: false,
    recurrenceId: null,
    seriesIndex: null,
    seriesTemplate: null,
    goalId: null,
    icon: null,
    someday: false,
    source: 'local',
    externalId: null,
    appleListId: null,
    appleRecurring: false,
    externalEventId: null,
    createdAt: row.created_at as IsoDateTime,
    updatedAt: row.updated_at as IsoDateTime,
    deletedAt: row.deleted_at as IsoDateTime | null,
    deviceId: row.device_id as Task['deviceId'],
    hlc: row.hlc as Task['hlc'],
  };
}

export interface SimEntries {
  create(id: TaskId, title: string, extra: Partial<Task>): Promise<Task>;
  update(id: TaskId, patch: Partial<Task>): Promise<Task>;
  remove(id: TaskId): Promise<void>;
  /** BL-133 : annule une suppression (même écriture que `tasks.restore` du banc legacy : `deleted_at` remis à NULL, tampon neuf). */
  restore(id: TaskId): Promise<Task | null>;
  get(id: TaskId): Promise<Task | null>;
}

export function createSimEntries(driver: SqlDriver, schemaOf: () => string, stamp: () => WriteStamp): SimEntries {
  const get = async (id: TaskId): Promise<Task | null> => {
    const rows = await driver.select<EntryRow>(`SELECT ${SIM_ENTRY_SELECT}, time, created_at, updated_at, deleted_at, device_id, hlc FROM ${SIM_ENTRY_TABLE} WHERE id = ?`, [id]);
    return rows[0] ? toTask(rows[0]) : null;
  };
  const must = async (id: TaskId): Promise<Task> => {
    const task = await get(id);
    if (!task) throw new Error(`${SIM_ENTRY_TABLE} : ${id} introuvable`);
    return task;
  };
  return {
    async create(id, title, extra) {
      refuseUnmapped(extra, schemaOf());
      const given = fieldsOf(extra);
      const value = (column: string, fallback: SqlValue): SqlValue => (column in given ? (given[column] ?? null) : fallback);
      const s = stamp();
      await driver.execute(
        `INSERT INTO ${SIM_ENTRY_TABLE} (id, date, time, food_id, food_name, source, method, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?)`,
        [id, value('date', '2026-10-05'), value('time', NO_TIME), value('food_id', null), value('food_name', title), value('method', TODO), s.at, s.at, s.deviceId, s.hlc],
      );
      return must(id);
    },
    async update(id, patch) {
      refuseUnmapped(patch, schemaOf());
      const fields = Object.entries(fieldsOf(patch));
      await must(id);
      // BL-133 : tampon posé même sans champ (le dépôt de tâches du banc legacy écrit toujours `updated_at`, `device_id` et `hlc`).
      const s = stamp();
      const sets = fields.map(([column]) => `${column} = ?, `).join('');
      await driver.execute(`UPDATE ${SIM_ENTRY_TABLE} SET ${sets}updated_at = ?, device_id = ?, hlc = ? WHERE id = ? AND deleted_at IS NULL`, [...fields.map(([, value]) => value), s.at, s.deviceId, s.hlc, id]);
      return must(id);
    },
    async remove(id) {
      const s = stamp();
      await driver.execute(`UPDATE ${SIM_ENTRY_TABLE} SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ? AND deleted_at IS NULL`, [s.at, s.at, s.deviceId, s.hlc, id]);
    },
    async restore(id) {
      const s = stamp();
      await driver.execute(`UPDATE ${SIM_ENTRY_TABLE} SET deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ? AND deleted_at IS NOT NULL`, [s.at, s.deviceId, s.hlc, id]);
      return get(id);
    },
    get,
  };
}
