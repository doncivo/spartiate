import {
  PROFILE_ID,
  validateManualWeight,
  validateProfile,
  weightId,
  type BodyGoal,
  type BodyWeight,
  type Experience,
  type Profile,
  type ProfileInput,
  type Sex,
  type Units,
  type WeightSource,
} from '../../../domain/bodyProfile';
import type { WriteStamper } from '../../../domain/hlc';
import { isIsoDateTime, type IsoDateTime, type LocalDate } from '../../../domain/types';
import { isValidTimeZone, utcToLocal } from '../../../domain/timeZone';
import type { SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { BodyWeightRepository, ProfileRepository } from '../bodyRepositories';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface ProfileRow extends SqlRow, SyncRow {
  readonly sex: string | null;
  readonly birth_year: number | null;
  readonly height_cm: number | null;
  readonly goal: string | null;
  readonly experience: string | null;
  readonly units: string | null;
}

interface WeightRow extends SqlRow, SyncRow {
  readonly date: string;
  readonly kg: number;
  readonly source: string;
  readonly timezone: string;
  readonly health_uuid: string | null;
  readonly measured_at: string | null;
}

const rowToProfile = (row: ProfileRow): Profile => ({
  id: PROFILE_ID,
  sex: row.sex as Sex | null,
  birthYear: row.birth_year,
  heightCm: row.height_cm,
  goal: row.goal as BodyGoal | null,
  experience: row.experience as Experience | null,
  units: row.units as Units | null,
  ...readSyncMeta(row),
});

const rowToWeight = (row: WeightRow): BodyWeight => ({
  id: row.id,
  date: row.date as LocalDate,
  kg: row.kg,
  source: row.source as WeightSource,
  timezone: row.timezone,
  healthUuid: row.health_uuid,
  measuredAt: row.measured_at as IsoDateTime | null,
  ...readSyncMeta(row),
});

const COLUMNS = { sex: 'sex', birthYear: 'birth_year', heightCm: 'height_cm', goal: 'goal', experience: 'experience', units: 'units' } as const;

export function createProfileRepository(db: SqlExecutor, stamper: WriteStamper): ProfileRepository {
  const read = async (): Promise<ProfileRow | undefined> => (await db.select<ProfileRow>('SELECT * FROM profile WHERE id = ?', [PROFILE_ID]))[0];
  return {
    async get() {
      const row = await read();
      return row && row.deleted_at === null ? rowToProfile(row) : null;
    },
    async save(input, currentYear) {
      const current = await read();
      // Valeurs finales : l'existant, recouvert par ce qui est fourni (null efface, omis garde).
      const merged: ProfileInput = {
        sex: current ? (current.sex as Sex | null) : null,
        birthYear: current ? current.birth_year : null,
        heightCm: current ? current.height_cm : null,
        goal: current ? (current.goal as BodyGoal | null) : null,
        experience: current ? (current.experience as Experience | null) : null,
        units: current ? (current.units as Units | null) : null,
        ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
      };
      if (validateProfile(merged, currentYear).length > 0) throw new RepositoryError('invalid', 'profile', PROFILE_ID);
      const stamp = stamper.next();
      const values = (Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]).map((key) => merged[key] ?? null);
      if (!current) {
        await db.execute(
          'INSERT INTO profile (id, sex, birth_year, height_cm, goal, experience, units, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [PROFILE_ID, ...values, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
        );
      } else {
        await db.execute(
          `UPDATE profile SET ${Object.values(COLUMNS).map((c) => `${c} = ?`).join(', ')}, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
          [...values, stamp.at, stamp.deviceId, stamp.hlc, PROFILE_ID],
        );
      }
      const saved = await read();
      if (!saved) throw new RepositoryError('not-found', 'profile', PROFILE_ID);
      return rowToProfile(saved);
    },
  };
}

export function createBodyWeightRepository(db: SqlExecutor, stamper: WriteStamper): BodyWeightRepository {
  return {
    async saveManual(input, today) {
      const { date, kg, timezone } = input;
      const id = weightId(date, 'manual');
      if (validateManualWeight({ date, kg }, today).length > 0 || timezone.length === 0) throw new RepositoryError('invalid', 'body_weight', id);
      const exists = (await db.select('SELECT 1 FROM body_weight WHERE id = ?', [id])).length > 0;
      const stamp = stamper.next();
      if (exists) {
        await db.execute('UPDATE body_weight SET kg = ?, timezone = ?, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [kg, timezone, stamp.at, stamp.deviceId, stamp.hlc, id]);
      } else {
        await db.execute(
          "INSERT INTO body_weight (id, date, kg, source, timezone, health_uuid, measured_at, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, 'manual', ?, NULL, NULL, ?, ?, ?, ?)",
          [id, date, kg, timezone, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
        );
      }
      const row = (await db.select<WeightRow>('SELECT * FROM body_weight WHERE id = ?', [id]))[0];
      if (!row) throw new RepositoryError('not-found', 'body_weight', id);
      return rowToWeight(row);
    },
    async saveHealth(input, today) {
      if (!isIsoDateTime(input.measuredAt) || !isValidTimeZone(input.timezone) || input.healthUuid.trim() === '') {
        throw new RepositoryError('invalid', 'body_weight', 'health');
      }
      const date = utcToLocal(input.measuredAt, input.timezone).date;
      const id = weightId(date, 'health');
      if (validateManualWeight({ date, kg: input.kg }, today).length > 0) {
        throw new RepositoryError('invalid', 'body_weight', id);
      }
      const existing = (await db.select<WeightRow>('SELECT * FROM body_weight WHERE id = ?', [id]))[0];
      if (
        existing &&
        existing.deleted_at === null &&
        existing.kg === input.kg &&
        existing.timezone === input.timezone &&
        existing.health_uuid === input.healthUuid &&
        existing.measured_at === input.measuredAt
      ) {
        return rowToWeight(existing);
      }
      const stamp = stamper.next();
      if (existing) {
        await db.execute(
          'UPDATE body_weight SET kg = ?, timezone = ?, health_uuid = ?, measured_at = ?, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?',
          [input.kg, input.timezone, input.healthUuid, input.measuredAt, stamp.at, stamp.deviceId, stamp.hlc, id],
        );
      } else {
        await db.execute(
          "INSERT INTO body_weight (id, date, kg, source, timezone, health_uuid, measured_at, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, 'health', ?, ?, ?, ?, ?, ?, ?)",
          [id, date, input.kg, input.timezone, input.healthUuid, input.measuredAt, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
        );
      }
      const row = (await db.select<WeightRow>('SELECT * FROM body_weight WHERE id = ?', [id]))[0];
      if (!row) throw new RepositoryError('not-found', 'body_weight', id);
      return rowToWeight(row);
    },
    async softDelete(date, source) {
      const id = weightId(date, source);
      const row = (await db.select<WeightRow>('SELECT * FROM body_weight WHERE id = ? AND deleted_at IS NULL', [id]))[0];
      if (!row) throw new RepositoryError('not-found', 'body_weight', id);
      const stamp = stamper.next();
      await db.execute('UPDATE body_weight SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },
    async listRecent(limit) {
      const rows = await db.select<WeightRow>('SELECT * FROM body_weight WHERE deleted_at IS NULL ORDER BY date DESC, COALESCE(measured_at, \'\') DESC, source LIMIT ?', [Math.max(1, Math.floor(limit))]);
      return rows.map(rowToWeight);
    },
  };
}
