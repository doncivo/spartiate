import { decodeTrack, encodeTrack, toCardioKind, validateCardioSession, type CardioSessionInput } from '../../../domain/cardio';
import type { WriteStamper } from '../../../domain/hlc';
import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import type { SqlExecutor, SqlRow } from '../../driver';
import type { CardioRepository, CardioSessionRecord } from '../cardioRepository';
import { RepositoryError } from '../common';

interface SessionRow extends SqlRow {
  readonly id: string;
  readonly kind: string;
  readonly started_at: string;
  readonly duration_sec: number;
  readonly distance_m: number | null;
  readonly avg_hr: number | null;
  readonly rpe: number;
  readonly notes: string;
  readonly source: string;
  readonly has_track: number;
}

const SELECT = 'SELECT s.id, s.kind, s.started_at, s.duration_sec, s.distance_m, s.avg_hr, s.rpe, s.notes, s.source, EXISTS (SELECT 1 FROM cardio_track t WHERE t.session_id = s.id) AS has_track FROM cardio_session s';
const LIST_MAX = 200;

const toRecord = (r: SessionRow): CardioSessionRecord => ({
  id: r.id,
  kind: toCardioKind(r.kind),
  startedAt: r.started_at,
  durationSec: Number(r.duration_sec),
  distanceM: r.distance_m === null ? null : Number(r.distance_m),
  avgHr: r.avg_hr === null ? null : Number(r.avg_hr),
  rpe: Number(r.rpe),
  notes: r.notes,
  source: r.source === 'gps' ? 'gps' : 'manual',
  hasTrack: Number(r.has_track) === 1,
});

/**
 * Séances cardio publiées et tracés locaux (I6-06, D-221, D-222). Toute écriture publiée prend son tampon HLC juste avant son `db.execute` ; la
 * validation du domaine se fait sur l'instant de ce tampon (aucune attente entre les deux). Le tracé n'a ni colonne de synchro ni déclencheur.
 */
export function createCardioRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): CardioRepository {
  const read = async (id: string): Promise<SessionRow | undefined> => (await db.select<SessionRow>(`${SELECT} WHERE s.id = ? AND s.deleted_at IS NULL`, [id]))[0];
  const check = (input: CardioSessionInput, nowIso: string, id: string): void => {
    if (validateCardioSession(input, nowIso).length > 0) throw new RepositoryError('invalid', 'cardio_session', id);
  };
  const values = (s: CardioSessionInput) => [s.kind, s.startedAt, s.durationSec, s.distanceM, s.avgHr, s.rpe, s.source, s.notes] as const;

  return {
    async list(limit = LIST_MAX) {
      const rows = await db.select<SessionRow>(`${SELECT} WHERE s.deleted_at IS NULL ORDER BY s.started_at DESC, s.hlc DESC LIMIT ?`, [Math.max(1, Math.min(LIST_MAX, Math.floor(limit)))]);
      return rows.map(toRecord);
    },

    async get(id) {
      const row = await read(id);
      return row ? toRecord(row) : null;
    },

    async listSince(sinceIso) {
      const rows = await db.select<{ started_at: string; duration_sec: number; rpe: number }>('SELECT started_at, duration_sec, rpe FROM cardio_session WHERE deleted_at IS NULL AND started_at >= ? ORDER BY started_at', [sinceIso]);
      return rows.map((r) => ({ startedAt: r.started_at, durationSec: Number(r.duration_sec), rpe: Number(r.rpe) }));
    },

    async add(input, track = null) {
      const id = String(ids.next());
      const stamp = stamper.next();
      check(input, stamp.at, id);
      await db.execute(
        'INSERT INTO cardio_session (id, kind, started_at, duration_sec, distance_m, avg_hr, rpe, source, notes, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, ...values(input), stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
      );
      if (track && track.length > 0) {
        await db.execute('INSERT OR REPLACE INTO cardio_track (session_id, points, point_count, saved_at) VALUES (?, ?, ?, ?)', [id, encodeTrack(track), track.length, stamp.at]);
      }
      return id;
    },

    async update(id, input) {
      if (!(await read(id))) throw new RepositoryError('not-found', 'cardio_session', id);
      const stamp = stamper.next();
      check(input, stamp.at, id);
      await db.execute(
        'UPDATE cardio_session SET kind = ?, started_at = ?, duration_sec = ?, distance_m = ?, avg_hr = ?, rpe = ?, source = ?, notes = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ? AND deleted_at IS NULL',
        [...values(input), stamp.at, stamp.deviceId, stamp.hlc, id],
      );
    },

    async remove(id) {
      if (!(await read(id))) return;
      const stamp = stamper.next();
      await db.execute('UPDATE cardio_session SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ? AND deleted_at IS NULL', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
      await db.execute('DELETE FROM cardio_track WHERE session_id = ?', [id]);
    },

    async track(id) {
      const row = (await db.select<{ points: string }>('SELECT points FROM cardio_track WHERE session_id = ?', [id]))[0];
      return row ? decodeTrack(row.points) : null;
    },
  };
}
