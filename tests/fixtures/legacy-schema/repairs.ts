import type { WriteStamper } from '../../../src/domain/hlc';
import { focusSessionsToClose, routinePausedFrom } from '../../../src/domain/sync/repairs';
import type { Hlc, IsoDateTime } from '../../../src/domain/types';
import type { SqlExecutor } from '../../../src/db/driver';
import type { SyncRepository } from '../../../src/db/repositories';
import type { SyncDeps } from '../../../src/sync/deps';

/**
 * Requêtes des réparations de l'ancien schéma (ADR 0011, section 8), sorties du dépôt de synchro livré en DATA-0295 (BL-003, D-67) : elles
 * ne servent qu'au banc. Mêmes instructions SQL qu'avant le déplacement.
 */
export interface LegacyRepairQueries {
  /** Périodes de pause des routines données. */
  routinePauses(routineIds: readonly string[]): Promise<Map<string, { readonly toDate: string | null; readonly deletedAt: string | null }[]>>;
  /** Colonne locale `routine.paused` (sans tampon : jamais publiée). */
  setRoutinePaused(routineId: string, paused: boolean): Promise<void>;
  openFocusSessions(): Promise<{ readonly id: string; readonly startedAt: IsoDateTime; readonly hlc: Hlc }[]>;
  /** Écriture locale tamponnée (publiée) : clôture d'une session Focus. */
  closeFocusSession(id: string, endedAt: IsoDateTime): Promise<void>;
}

const CHUNK = 400;
function chunks<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}
const marks = (n: number): string => Array.from({ length: n }, () => '?').join(', ');

export function createLegacyRepairQueries(db: SqlExecutor, stamper: WriteStamper): LegacyRepairQueries {
  return {
    async routinePauses(routineIds) {
      const out = new Map<string, { toDate: string | null; deletedAt: string | null }[]>();
      for (const id of routineIds) out.set(id, []);
      for (const part of chunks([...new Set(routineIds)])) {
        const rows = await db.select<{ routine_id: string; to_date: string | null; deleted_at: string | null }>(
          `SELECT routine_id, to_date, deleted_at FROM routine_pause WHERE routine_id IN (${marks(part.length)})`,
          part,
        );
        for (const row of rows) out.get(row.routine_id)?.push({ toDate: row.to_date, deletedAt: row.deleted_at });
      }
      return out;
    },
    async setRoutinePaused(routineId, paused) {
      await db.execute('UPDATE routine SET paused = ? WHERE id = ? AND paused <> ?', [paused ? 1 : 0, routineId, paused ? 1 : 0]);
    },
    async openFocusSessions() {
      const rows = await db.select<{ id: string; started_at: string; hlc: string }>('SELECT id, started_at, hlc FROM focus_session WHERE ended_at IS NULL AND deleted_at IS NULL');
      return rows.map((r) => ({ id: r.id, startedAt: r.started_at as IsoDateTime, hlc: r.hlc as Hlc }));
    },
    async closeFocusSession(id, endedAt) {
      const stamp = stamper.next();
      await db.execute('UPDATE focus_session SET ended_at = ?, paused_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ? AND ended_at IS NULL', [endedAt, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },
  };
}

/** Requêtes de réparation attachées au dépôt de synchro de chaque jeu de repositories du banc (`createLegacyRepositories`). */
const queriesOf = new WeakMap<SyncRepository, LegacyRepairQueries>();

export function attachLegacyRepairs(sync: SyncRepository, queries: LegacyRepairQueries): void {
  queriesOf.set(sync, queries);
}

function legacyQueries(sync: SyncRepository): LegacyRepairQueries {
  const queries = queriesOf.get(sync);
  if (!queries) throw new Error('réparations legacy : repositories du banc attendus (createLegacyRepositories)');
  return queries;
}

/** Réparations de l'ancien schéma après un lot appliqué (ADR 0011, section 8 ; Y-02 critère 8), injectées par le catalogue du banc. */
export async function legacyRepairs(deps: SyncDeps, touched: ReadonlyMap<string, ReadonlySet<string>>): Promise<void> {
  const repos = deps.data.repos;
  const routineIds = new Set<string>(touched.get('routine') ?? []);
  const pauseIds = [...(touched.get('routine_pause') ?? [])];
  const pauseTable = deps.catalogue.table('routine_pause');
  if (pauseTable && pauseIds.length > 0) {
    for (const row of (await repos.sync.readRows(pauseTable, pauseIds)).values()) {
      const routineId = row.values.get('routine_id');
      if (typeof routineId === 'string') routineIds.add(routineId);
    }
  }
  if (routineIds.size > 0) {
    const queries = legacyQueries(repos.sync);
    const pauses = await queries.routinePauses([...routineIds]);
    for (const [routineId, periods] of pauses) await queries.setRoutinePaused(routineId, routinePausedFrom(periods));
  }
  if (touched.has('focus_session')) {
    const queries = legacyQueries(repos.sync);
    const toClose = focusSessionsToClose(await queries.openFocusSessions());
    for (const { id, endedAt } of toClose) await queries.closeFocusSession(id, endedAt);
  }
}
