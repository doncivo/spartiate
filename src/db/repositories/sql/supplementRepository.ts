import type { WriteStamper } from '../../../domain/hlc';
import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import { parseSupplementTimes, validateSupplementDraft, type Supplement, type SupplementDraft, type SupplementIntake } from '../../../domain/nutrition/supplements';
import { intakeId, isIntakeId } from '../../../domain/sync/naturalIds';
import { isLocalDate, type LocalDate, type LocalTime } from '../../../domain/types';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { SupplementRepository } from '../supplementRepository';

interface SupplementRow extends SqlRow {
  readonly id: string;
  readonly name: string;
  readonly dose: number | null;
  readonly unit: string | null;
  readonly times: string;
  readonly days: number;
  readonly active: number;
  readonly created_at: string;
}

interface IntakeRow extends SqlRow {
  readonly id: string;
  readonly supplement_id: string;
  readonly date: string;
  readonly moment: string;
  readonly deleted_at: string | null;
}

const pad = (n: number): string => String(n).padStart(2, '0');
/** Jour LOCAL de l'instant de création (aucune prise due avant). */
function localDay(iso: string): LocalDate {
  const d = new Date(iso);
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as LocalDate;
}

/** Ligne lue → complément ; ligne illisible (version plus récente, saisie hors app) : écartée, jamais effacée. */
function toSupplement(row: SupplementRow): Supplement | null {
  const times = parseSupplementTimes(row.times);
  if (times === null) return null;
  const valid = validateSupplementDraft({ name: row.name, dose: row.dose, unit: row.unit, times, days: row.days, active: row.active === 1 });
  return valid.ok ? { id: row.id, since: localDay(row.created_at), ...valid.value } : null;
}

const COLUMNS = 'id, name, dose, unit, times, days, active, created_at';

/**
 * Compléments publiés (I6-05, D-210). Toute écriture prend son tampon HLC juste avant son `db.execute`. Validation par le domaine avant toute
 * écriture ; les CHECK de la migration restent le dernier recours.
 */
export function createSupplementRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): SupplementRepository {
  const valid = (input: Parameters<SupplementRepository['create']>[0], id: string): SupplementDraft => {
    const result = validateSupplementDraft(input);
    if (!result.ok) throw new RepositoryError('invalid', 'supplement', id);
    return result.value;
  };
  const liveRow = async (id: string): Promise<SupplementRow | undefined> => (await db.select<SupplementRow>(`SELECT ${COLUMNS} FROM supplement WHERE id = ? AND deleted_at IS NULL`, [id]))[0];

  return {
    async list() {
      const rows = await db.select<SupplementRow>(`SELECT ${COLUMNS} FROM supplement WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE, id`);
      return rows.map(toSupplement).filter((s): s is Supplement => s !== null);
    },

    async create(input) {
      const id = ids.next();
      const draft = valid(input, id);
      const stamp = stamper.next();
      await db.execute('INSERT INTO supplement (id, name, dose, unit, times, days, active, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        id,
        draft.name,
        draft.dose,
        draft.unit,
        JSON.stringify(draft.times),
        draft.days,
        draft.active ? 1 : 0,
        stamp.at,
        stamp.at,
        stamp.deviceId,
        stamp.hlc,
      ]);
      return { id, since: localDay(stamp.at), ...draft };
    },

    async update(id, input) {
      const row = await liveRow(id);
      if (!row) throw new RepositoryError('not-found', 'supplement', id);
      const draft = valid(input, id);
      const next = { name: draft.name, dose: draft.dose, unit: draft.unit, times: JSON.stringify(draft.times), days: draft.days, active: draft.active ? 1 : 0 };
      const changed = (Object.keys(next) as (keyof typeof next)[]).filter((key) => row[key] !== next[key]);
      if (changed.length === 0) return;
      const stamp = stamper.next();
      await db.execute(`UPDATE supplement SET ${changed.map((key) => `${key} = ?`).join(', ')}, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`, [
        ...changed.map((key) => next[key]),
        stamp.at,
        stamp.deviceId,
        stamp.hlc,
        id,
      ]);
    },

    async remove(id) {
      if (!(await liveRow(id))) return;
      const stamp = stamper.next();
      await db.execute('UPDATE supplement SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },

    async intakes(from, to) {
      const rows = await db.select<IntakeRow>('SELECT id, supplement_id, date, moment, deleted_at FROM supplement_intake WHERE deleted_at IS NULL AND date >= ? AND date <= ? ORDER BY date, moment, supplement_id', [from, to]);
      return rows
        .filter((r) => isIntakeId(r.id) && isLocalDate(r.date))
        .map((r): SupplementIntake => ({ supplementId: r.supplement_id, date: r.date as LocalDate, moment: r.moment as LocalTime }));
    },

    async setTaken(supplementId, date, moment, taken) {
      const id = intakeId(supplementId, date, moment);
      if (!isIntakeId(id)) throw new RepositoryError('invalid', 'supplement_intake', id);
      if (!(await liveRow(supplementId))) throw new RepositoryError('not-found', 'supplement', supplementId);
      const row = (await db.select<IntakeRow>('SELECT id, supplement_id, date, moment, deleted_at FROM supplement_intake WHERE id = ?', [id]))[0];
      if (taken) {
        if (row && row.deleted_at === null) return;
        const stamp = stamper.next();
        if (row) {
          await db.execute('UPDATE supplement_intake SET taken_at = ?, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
        } else {
          await db.execute('INSERT INTO supplement_intake (id, supplement_id, date, moment, taken_at, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            id,
            supplementId,
            date,
            moment,
            stamp.at,
            stamp.at,
            stamp.at,
            stamp.deviceId,
            stamp.hlc,
          ]);
        }
        return;
      }
      if (!row || row.deleted_at !== null) return;
      const stamp = stamper.next();
      await db.execute('UPDATE supplement_intake SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },
  };
}
