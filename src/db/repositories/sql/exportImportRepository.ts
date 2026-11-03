import { PROFILE_ID, WEIGHT_MAX_KG, validateProfile, weightId } from '../../../domain/bodyProfile';
import type { ExportData, ExportProfile, ExportWeight } from '../../../domain/exportImport/archive';
import type { ImportPlan } from '../../../domain/exportImport/plan';
import type { WriteStamper } from '../../../domain/hlc';
import type { SyncCatalogue, SyncTable } from '../../../domain/sync/syncTables';
import { isLocalDate } from '../../../domain/types';
import type { SqlExecutor, SqlRow, SqlValue } from '../../driver';
import { RepositoryError } from '../common';
import type { ExportImportRepository } from '../exportImportRepository';

interface Row extends SqlRow {
  readonly id: string;
  readonly hlc: string;
  readonly deleted_at: string | null;
}

/** Colonnes publiées d'une table sans `created_at` ni `deleted_at` (écrites à part). */
const dataColumns = (t: SyncTable): string[] => t.columns.map((c) => c.name).filter((n) => n !== 'created_at' && n !== 'deleted_at');

export function createExportImportRepository(db: SqlExecutor, stamper: WriteStamper, catalogue: SyncCatalogue): ExportImportRepository {
  const tableOf = (name: string): SyncTable => {
    const t = catalogue.table(name);
    if (!t) throw new RepositoryError('invalid', name, '');
    return t;
  };

  /** Horloge de champ : `base` suit la règle des déclencheurs de capture (que la garde neutralise pendant l'import). */
  async function stampClocks(t: SyncTable, id: string, fields: readonly string[], hlc: string, oldHlc: string | null): Promise<void> {
    if (oldHlc !== null && oldHlc !== hlc) {
      await db.execute("INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc) VALUES (?, ?, '*', ?, NULL) ON CONFLICT (table_name, row_id, field) DO NOTHING", [t.name, id, oldHlc]);
    }
    for (const field of fields) {
      const queued = (await db.select('SELECT 1 FROM sync_outbox WHERE table_name = ? AND row_id = ? AND field IN (?, ?)', [t.name, id, field, '*'])).length > 0;
      const own = (await db.select<{ hlc: string; base_hlc: string | null }>('SELECT hlc, base_hlc FROM sync_field_clock WHERE table_name = ? AND row_id = ? AND field = ?', [t.name, id, field]))[0];
      const star = (await db.select<{ hlc: string }>("SELECT hlc FROM sync_field_clock WHERE table_name = ? AND row_id = ? AND field = '*'", [t.name, id]))[0];
      const base: string | null = queued ? (own?.base_hlc ?? null) : (own?.hlc ?? star?.hlc ?? oldHlc);
      await db.execute(
        'INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc) VALUES (?, ?, ?, ?, ?) ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc',
        [t.name, id, field, hlc, base],
      );
    }
  }

  /** Crée ou remplace une ligne (rétablit une ligne supprimée) : ligne entière remise dans la file. */
  async function upsert(t: SyncTable, id: string, values: Readonly<Record<string, SqlValue>>): Promise<void> {
    const existing = (await db.select<Row>(`SELECT id, hlc, deleted_at FROM ${t.name} WHERE id = ?`, [id]))[0];
    const stamp = stamper.next();
    const columns = dataColumns(t);
    const params = columns.map((c) => values[c] ?? null);
    if (existing) {
      await stampClocks(t, id, [...columns, ...(existing.deleted_at ? ['deleted_at'] : [])], stamp.hlc, existing.hlc);
      await db.execute(`UPDATE ${t.name} SET ${columns.map((c) => `${c} = ?`).join(', ')}, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`, [...params, stamp.at, stamp.deviceId, stamp.hlc, id]);
    } else {
      await db.execute(
        `INSERT INTO ${t.name} (id, ${columns.join(', ')}, created_at, updated_at, device_id, hlc) VALUES (?, ${columns.map(() => '?').join(', ')}, ?, ?, ?, ?)`,
        [id, ...params, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
      );
      await db.execute('DELETE FROM sync_tombstone WHERE table_name = ? AND row_id = ?', [t.name, id]);
      await stampClocks(t, id, [...columns, 'created_at', 'deleted_at'], stamp.hlc, null);
    }
    await db.execute('DELETE FROM sync_outbox WHERE table_name = ? AND row_id = ?', [t.name, id]);
    await db.execute("INSERT INTO sync_outbox (table_name, row_id, field) VALUES (?, ?, '*')", [t.name, id]);
    if (existing?.deleted_at) await db.execute("INSERT INTO sync_outbox (table_name, row_id, field) VALUES (?, ?, '+')", [t.name, id]);
  }

  /** Suppression logique publiée comme toute suppression du moteur : `deleted_at`, horloge de ce champ, entrée outbox `deleted_at`. */
  async function softDelete(t: SyncTable, id: string): Promise<void> {
    const existing = (await db.select<Row>(`SELECT id, hlc, deleted_at FROM ${t.name} WHERE id = ? AND deleted_at IS NULL`, [id]))[0];
    if (!existing) return;
    const stamp = stamper.next();
    await stampClocks(t, id, ['deleted_at'], stamp.hlc, existing.hlc);
    await db.execute(`UPDATE ${t.name} SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`, [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    await db.execute("DELETE FROM sync_outbox WHERE table_name = ? AND row_id = ? AND field = 'deleted_at'", [t.name, id]);
    await db.execute("INSERT INTO sync_outbox (table_name, row_id, field) VALUES (?, ?, 'deleted_at')", [t.name, id]);
  }

  const invalidWeight = (x: ExportWeight): boolean =>
    !isLocalDate(x.date) ||
    x.id !== weightId(x.date, x.source) ||
    !(Number.isFinite(x.kg) && x.kg > 0 && x.kg <= WEIGHT_MAX_KG) ||
    x.timezone.length === 0 ||
    (x.source === 'health' && x.measuredAt === null);

  return {
    async readExportData() {
      const profile = (await db.select<SqlRow>('SELECT * FROM profile WHERE id = ? AND deleted_at IS NULL', [PROFILE_ID]))[0];
      const weights = await db.select<SqlRow>('SELECT * FROM body_weight WHERE deleted_at IS NULL ORDER BY id');
      const exported: ExportData = {
        profile: profile
          ? ({
              id: PROFILE_ID,
              sex: profile['sex'],
              birthYear: profile['birth_year'],
              heightCm: profile['height_cm'],
              goal: profile['goal'],
              experience: profile['experience'],
              units: profile['units'],
            } as ExportProfile)
          : null,
        weights: weights.map(
          (r): ExportWeight => ({
            id: String(r['id']),
            date: String(r['date']),
            kg: Number(r['kg']),
            source: r['source'] as ExportWeight['source'],
            timezone: String(r['timezone']),
            healthUuid: r['health_uuid'] as string | null,
            measuredAt: r['measured_at'] as string | null,
          }),
        ),
        settings: {},
      };
      return exported;
    },

    async applyImport(plan: ImportPlan, currentYear: number) {
      const { profile, deleteProfile, weights, deleteWeightIds } = plan.writes;
      if (profile && validateProfile(profile, currentYear).length > 0) throw new RepositoryError('invalid', 'profile', PROFILE_ID);
      for (const x of weights) if (invalidWeight(x)) throw new RepositoryError('invalid', 'body_weight', x.id);
      if (!profile && !deleteProfile && weights.length === 0 && deleteWeightIds.length === 0) return;
      await db.execute('INSERT OR IGNORE INTO sync_guard (id) VALUES (1)');
      try {
        if (profile) {
          await upsert(tableOf('profile'), PROFILE_ID, { sex: profile.sex, birth_year: profile.birthYear, height_cm: profile.heightCm, goal: profile.goal, experience: profile.experience, units: profile.units });
        }
        if (deleteProfile) await softDelete(tableOf('profile'), PROFILE_ID);
        const bodyWeight = tableOf('body_weight');
        for (const x of weights) {
          await upsert(bodyWeight, x.id, { date: x.date, kg: x.kg, source: x.source, timezone: x.timezone, health_uuid: x.healthUuid, measured_at: x.measuredAt });
        }
        for (const id of deleteWeightIds) await softDelete(bodyWeight, id);
      } finally {
        await db.execute('DELETE FROM sync_guard');
      }
    },
  };
}
