import { PROFILE_ID, WEIGHT_MAX_KG, validateProfile, weightId } from '../../../domain/bodyProfile';
import { TRAINING_EXPORT_TABLES, trainingColumns, type ExportData, type ExportProfile, type ExportWeight, type TrainingRow, type TrainingTable, type TrainingValue } from '../../../domain/exportImport/archive';
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

  /**
   * Bases des horloges de champ, LUES AVANT le tampon (Y-04, seconde revue, point 2 : après la prise du tampon, la première attente est une
   * écriture). La base suit la règle des déclencheurs de capture, que la garde neutralise pendant l'import : si le champ (ou la ligne
   * entière) attend déjà dans la file, la base existante est gardée ; sinon l'horloge actuelle du champ, celle de la ligne (« * »), ou
   * le hlc de la ligne avant l'import.
   */
  async function readBases(t: SyncTable, id: string, fields: readonly string[], oldHlc: string | null): Promise<Map<string, string | null>> {
    const bases = new Map<string, string | null>();
    if (oldHlc === null) {
      for (const field of fields) bases.set(field, null);
      return bases;
    }
    const star = (await db.select<{ hlc: string }>("SELECT hlc FROM sync_field_clock WHERE table_name = ? AND row_id = ? AND field = '*'", [t.name, id]))[0];
    for (const field of fields) {
      const queued = (await db.select('SELECT 1 FROM sync_outbox WHERE table_name = ? AND row_id = ? AND field IN (?, ?)', [t.name, id, field, '*'])).length > 0;
      const own = (await db.select<{ hlc: string; base_hlc: string | null }>('SELECT hlc, base_hlc FROM sync_field_clock WHERE table_name = ? AND row_id = ? AND field = ?', [t.name, id, field]))[0];
      bases.set(field, queued ? (own?.base_hlc ?? null) : (own?.hlc ?? star?.hlc ?? oldHlc));
    }
    return bases;
  }

  /** Écrit les horloges de champ à l'HLC de l'importateur (écritures seules). */
  async function writeClocks(t: SyncTable, id: string, bases: ReadonlyMap<string, string | null>, hlc: string, oldHlc: string | null): Promise<void> {
    if (oldHlc !== null && oldHlc !== hlc) {
      await db.execute("INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc) VALUES (?, ?, '*', ?, NULL) ON CONFLICT (table_name, row_id, field) DO NOTHING", [t.name, id, oldHlc]);
    }
    for (const [field, base] of bases) {
      await db.execute(
        'INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc) VALUES (?, ?, ?, ?, ?) ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc',
        [t.name, id, field, hlc, base],
      );
    }
  }

  /** Condition SQL « ligne publiable » du catalogue (D-27 : séance close, série d'une séance close), ou null si toute ligne l'est. */
  const publishSql = (t: SyncTable, alias: string): string | null => {
    const rule = t.publishWhen;
    if (!rule) return null;
    if ('notNull' in rule) return `${alias}.${rule.notNull} IS NOT NULL`;
    const parent = t.parents.find((p) => p.column === rule.parent);
    const pt = parent ? catalogue.table(parent.table) : undefined;
    if (!parent || !pt) return '0';
    const inner = `${alias}_p`;
    const nested = publishSql(pt, inner);
    return `EXISTS (SELECT 1 FROM ${pt.name} ${inner} WHERE ${inner}.id = ${alias}.${parent.column}${nested === null ? '' : ` AND ${nested}`})`;
  };
  const isPublishable = async (t: SyncTable, id: string): Promise<boolean> => {
    const cond = publishSql(t, 'x');
    return cond === null || (await db.select(`SELECT 1 FROM ${t.name} x WHERE x.id = ? AND ${cond}`, [id])).length > 0;
  };

  /**
   * Crée ou remplace une ligne (rétablit une ligne supprimée) : ligne entière remise dans la file. REV-01 constat 1 : une ligne que la
   * synchro ne publie pas encore (séance ouverte et ses séries, D-27) est écrite SANS horloge ni file ; la clôture la mettra en file.
   */
  async function upsert(t: SyncTable, id: string, values: Readonly<Record<string, SqlValue>>): Promise<void> {
    const existing = (await db.select<Row>(`SELECT id, hlc, deleted_at FROM ${t.name} WHERE id = ?`, [id]))[0];
    const columns = dataColumns(t);
    const params = columns.map((c) => values[c] ?? null);
    const fields = existing ? [...columns, ...(existing.deleted_at ? ['deleted_at'] : [])] : [...columns, 'created_at', 'deleted_at'];
    const bases = await readBases(t, id, fields, existing?.hlc ?? null);
    const stamp = stamper.next();
    if (existing) {
      await db.execute(`UPDATE ${t.name} SET ${columns.map((c) => `${c} = ?`).join(', ')}, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`, [...params, stamp.at, stamp.deviceId, stamp.hlc, id]);
    } else {
      await db.execute(
        `INSERT INTO ${t.name} (id, ${columns.join(', ')}, created_at, updated_at, device_id, hlc) VALUES (?, ${columns.map(() => '?').join(', ')}, ?, ?, ?, ?)`,
        [id, ...params, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
      );
      await db.execute('DELETE FROM sync_tombstone WHERE table_name = ? AND row_id = ?', [t.name, id]);
    }
    if (!(await isPublishable(t, id))) return;
    await writeClocks(t, id, bases, stamp.hlc, existing?.hlc ?? null);
    await db.execute('DELETE FROM sync_outbox WHERE table_name = ? AND row_id = ?', [t.name, id]);
    await db.execute("INSERT INTO sync_outbox (table_name, row_id, field) VALUES (?, ?, '*')", [t.name, id]);
    if (existing?.deleted_at) await db.execute("INSERT INTO sync_outbox (table_name, row_id, field) VALUES (?, ?, '+')", [t.name, id]);
  }

  /** Suppression logique publiée comme toute suppression du moteur : `deleted_at`, horloge de ce champ, entrée outbox `deleted_at`. */
  async function softDelete(t: SyncTable, id: string): Promise<void> {
    const existing = (await db.select<Row>(`SELECT id, hlc, deleted_at FROM ${t.name} WHERE id = ? AND deleted_at IS NULL`, [id]))[0];
    if (!existing) return;
    const bases = await readBases(t, id, ['deleted_at'], existing.hlc);
    const stamp = stamper.next();
    await db.execute(`UPDATE ${t.name} SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`, [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    await writeClocks(t, id, bases, stamp.hlc, existing.hlc);
    await db.execute("DELETE FROM sync_outbox WHERE table_name = ? AND row_id = ? AND field = 'deleted_at'", [t.name, id]);
    await db.execute("INSERT INTO sync_outbox (table_name, row_id, field) VALUES (?, ?, 'deleted_at')", [t.name, id]);
  }

  const invalidWeight = (x: ExportWeight): boolean =>
    !isLocalDate(x.date) ||
    x.id !== weightId(x.date, x.source) ||
    !(Number.isFinite(x.kg) && x.kg > 0 && x.kg <= WEIGHT_MAX_KG) ||
    x.timezone.length === 0 ||
    (x.source === 'health' && x.measuredAt === null);

  /** Condition SQL « ligne exportable » : non supprimée, parent exportable (la séance ouverte est exportée, D-57 ; elle n'est pas publiée, D-27). */
  const exportableSql = (t: SyncTable, alias: string): string => {
    const parts = [`${alias}.deleted_at IS NULL`];
    const rule = t.publishWhen;
    // REV-01 constat 1 : la sauvegarde contient aussi les séances ouvertes (D-57) ; seule la règle « parent présent » est gardée.
    if (rule && 'parent' in rule) {
      const parent = t.parents.find((p) => p.column === rule.parent);
      const pt = parent ? catalogue.table(parent.table) : undefined;
      if (!parent || !pt) return '0';
      const inner = `${alias}_p`;
      parts.push(`EXISTS (SELECT 1 FROM ${pt.name} ${inner} WHERE ${inner}.id = ${alias}.${parent.column} AND ${exportableSql(pt, inner)})`);
    }
    return parts.join(' AND ');
  };

  /** Lignes d'entraînement exportables ; un enfant dont le parent n'est pas exporté est écarté (archive cohérente). */
  async function readTraining(): Promise<Partial<Record<TrainingTable, TrainingRow[]>>> {
    const out: Partial<Record<TrainingTable, TrainingRow[]>> = {};
    const exported = new Map<string, Set<string>>();
    for (const name of TRAINING_EXPORT_TABLES) {
      const t = tableOf(name);
      const columns = trainingColumns(name);
      const rows = await db.select<SqlRow>(`SELECT p.id, ${columns.map((c) => `p.${c}`).join(', ')} FROM ${t.name} p WHERE ${exportableSql(t, 'p')} ORDER BY p.id`);
      const kept: TrainingRow[] = [];
      for (const r of rows) {
        if (t.parents.some((p) => r[p.column] !== null && r[p.column] !== undefined && !exported.get(p.table)?.has(String(r[p.column])))) continue;
        kept.push({ id: String(r['id']), values: Object.fromEntries(columns.map((c) => [c, (r[c] ?? null) as TrainingValue])) });
      }
      exported.set(name, new Set(kept.map((r) => r.id)));
      if (kept.length > 0) out[name] = kept;
    }
    return out;
  }

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
      // Sans ligne d'entraînement, la clé est absente : même forme qu'avant la 0.2.3 (et même archive canonique).
      const training = await readTraining();
      return Object.keys(training).length > 0 ? { ...exported, training } : exported;
    },

    async applyImport(plan: ImportPlan, currentYear: number) {
      const { profile, deleteProfile, weights, deleteWeightIds, training, deleteTraining } = plan.writes;
      if (profile && validateProfile(profile, currentYear).length > 0) throw new RepositoryError('invalid', 'profile', PROFILE_ID);
      for (const x of weights) if (invalidWeight(x)) throw new RepositoryError('invalid', 'body_weight', x.id);
      for (const { table, row } of training) {
        const t = tableOf(table);
        if (!catalogue.isValidRowId(t, row.id)) throw new RepositoryError('invalid', table, row.id);
        for (const col of t.columns) {
          if (col.name === 'created_at' || col.name === 'deleted_at') continue;
          if (!catalogue.isValidValue(col, row.values[col.name] ?? null)) throw new RepositoryError('invalid', table, row.id);
        }
      }
      if (!profile && !deleteProfile && weights.length === 0 && deleteWeightIds.length === 0 && training.length === 0 && deleteTraining.length === 0) return;
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
        // Entraînement : parents d'abord à l'écriture, enfants d'abord à la suppression (ordre déjà donné par le plan).
        for (const { table, row } of training) await upsert(tableOf(table), row.id, row.values);
        for (const { table, id } of deleteTraining) await softDelete(tableOf(table), id);
      } finally {
        await db.execute('DELETE FROM sync_guard');
      }
    },
  };
}
