import { isMeasurementKind, isStoredMeasurementKind, isStoredMeasurementValue, looksLikeJpeg, photoFileName, PHOTO_MAX_BYTES, type StoredMeasurementKind } from '../../../domain/bodyProgress';
import type { WriteStamper } from '../../../domain/hlc';
import { uuidGenerator, type IdGenerator } from '../../../domain/id';
import { measurementId } from '../../../domain/sync/naturalIds';
import { isLocalDate, type LocalDate } from '../../../domain/types';
import type { SqlDriver, SqlExecutor, SqlRow } from '../../driver';
import { RepositoryError } from '../common';
import type { MeasurementRecord, MeasurementRepository, ProgressPhotoRecord, ProgressPhotoRepository } from '../bodyProgressRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface MeasurementRow extends SqlRow, SyncRow {
  readonly date: string;
  readonly kind: string;
  readonly value: number;
}
interface PhotoRow extends SqlRow, SyncRow {
  readonly date: string;
  readonly file_name: string;
}

const toMeasurement = (row: MeasurementRow): MeasurementRecord => ({ id: row.id, day: row.date as LocalDate, kind: row.kind as StoredMeasurementKind, value: row.value, ...readSyncMeta(row) });
const toPhoto = (row: PhotoRow): ProgressPhotoRecord => ({ id: row.id, day: row.date as LocalDate, fileName: row.file_name, ...readSyncMeta(row) });

const BASE64_CHUNK = 0x8000;
/** Octets vers texte base64 (par blocs : jamais un appel avec des centaines de milliers d'arguments). */
function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  return btoa(binary);
}
function decodeBytes(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Une mesure par date et genre, identifiant `measurement|date|genre` (même ligne sur les deux appareils). Resaisir une mesure supprimée la rétablit. */
export function createMeasurementRepository(db: SqlExecutor, stamper: WriteStamper): MeasurementRepository {
  const read = async (id: string): Promise<MeasurementRow | undefined> => (await db.select<MeasurementRow>('SELECT * FROM measurement WHERE id = ?', [id]))[0];
  const invalid = (id: string): never => {
    throw new RepositoryError('invalid', 'measurement', id);
  };

  return {
    async save(day, kind, value) {
      if (!isLocalDate(day) || !isStoredMeasurementKind(kind) || !isStoredMeasurementValue(kind, value)) invalid(String(day));
      const id = measurementId(day, kind);
      const row = await read(id);
      if (row && row.deleted_at === null && row.value === value) return toMeasurement(row);
      const stamp = stamper.next();
      if (row) {
        await db.execute('UPDATE measurement SET value = ?, deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [value, stamp.at, stamp.deviceId, stamp.hlc, id]);
      } else {
        await db.execute('INSERT INTO measurement (id, date, kind, value, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, day, kind, value, stamp.at, stamp.at, stamp.deviceId, stamp.hlc]);
      }
      const saved = await read(id);
      if (!saved) throw new RepositoryError('not-found', 'measurement', id);
      return toMeasurement(saved);
    },

    async remove(day, kind) {
      if (!isLocalDate(day) || !isStoredMeasurementKind(kind)) return;
      const id = measurementId(day, kind);
      const row = await read(id);
      if (!row || row.deleted_at !== null) return;
      const stamp = stamper.next();
      await db.execute('UPDATE measurement SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },

    async find(day, kind) {
      if (!isLocalDate(day) || !isStoredMeasurementKind(kind)) return null;
      const row = await read(measurementId(day, kind));
      return row ? toMeasurement(row) : null;
    },

    async list(kind) {
      const rows =
        kind === undefined
          ? await db.select<MeasurementRow>('SELECT * FROM measurement WHERE deleted_at IS NULL ORDER BY date, kind')
          : await db.select<MeasurementRow>('SELECT * FROM measurement WHERE kind = ? AND deleted_at IS NULL ORDER BY date', [kind]);
      return rows.filter((row) => (kind === undefined ? isMeasurementKind(row.kind) : isStoredMeasurementKind(row.kind))).map(toMeasurement);
    },
  };
}

/**
 * FIX-0171 (constat 3) : exécute `fn` d'un seul tenant. Dépôt lié au pilote (`repos`) : transaction ouverte ici ; dépôt d'une transaction de l'appelant
 * (`data.transaction`) : déjà atomique, exécuté tel quel (une transaction imbriquée bloquerait la file).
 */
function atomic<T>(db: SqlExecutor, fn: (x: SqlExecutor) => Promise<T>): Promise<T> {
  const driver = db as Partial<SqlDriver>;
  return typeof driver.transaction === 'function' ? driver.transaction(fn) : fn(db);
}

/**
 * Fiche publiée (`progress_photo`) et fichier local (`progress_photo_file`, jamais publié ni exporté). FIX-0171 : fichier, fiche et capture de synchro
 * (déclencheurs) s'écrivent dans UNE transaction, à l'ajout comme à la suppression : un échec ne laisse ni fiche sans fichier ni fichier perdu.
 * Décision d'Ali du 12/11/2026 (D-121) : le fichier ne s'efface que par `remove`, sur l'appareil qui le détient ; une suppression reçue (synchro, import)
 * le laisse en place (`listDeletedWithFile`).
 */
export function createProgressPhotoRepository(db: SqlExecutor, stamper: WriteStamper, ids: IdGenerator = uuidGenerator): ProgressPhotoRepository {
  const read = async (x: SqlExecutor, id: string): Promise<PhotoRow | undefined> => (await x.select<PhotoRow>('SELECT * FROM progress_photo WHERE id = ?', [id]))[0];

  return {
    async add(day, bytes) {
      if (!isLocalDate(day) || bytes.length === 0 || bytes.length > PHOTO_MAX_BYTES || !looksLikeJpeg(bytes)) throw new RepositoryError('invalid', 'progress_photo', String(day));
      const id = String(ids.next());
      const data = encodeBytes(bytes);
      return atomic(db, async (x) => {
        const stamp = stamper.next();
        await x.execute('INSERT INTO progress_photo_file (photo_id, mime, data, saved_at) VALUES (?, ?, ?, ?)', [id, 'image/jpeg', data, stamp.at]);
        await x.execute('INSERT INTO progress_photo (id, date, file_name, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, day, photoFileName(id), stamp.at, stamp.at, stamp.deviceId, stamp.hlc]);
        const saved = await read(x, id);
        if (!saved) throw new RepositoryError('not-found', 'progress_photo', id);
        return toPhoto(saved);
      });
    },

    async list() {
      const rows = await db.select<PhotoRow>('SELECT * FROM progress_photo WHERE deleted_at IS NULL ORDER BY date DESC, created_at DESC, id DESC');
      return rows.map(toPhoto);
    },

    async listDeletedWithFile() {
      const rows = await db.select<PhotoRow>('SELECT * FROM progress_photo WHERE deleted_at IS NOT NULL AND id IN (SELECT photo_id FROM progress_photo_file) ORDER BY date DESC, created_at DESC, id DESC');
      return rows.map(toPhoto);
    },

    async loadFile(id) {
      const rows = await db.select<SqlRow & { data: string }>('SELECT data FROM progress_photo_file WHERE photo_id = ?', [id]);
      return rows[0] ? decodeBytes(rows[0].data) : null;
    },

    async localFileIds() {
      const rows = await db.select<SqlRow & { photo_id: string }>('SELECT photo_id FROM progress_photo_file');
      return new Set(rows.map((row) => row.photo_id));
    },

    async remove(id) {
      await atomic(db, async (x) => {
        const row = await read(x, id);
        const file = await x.select('SELECT 1 FROM progress_photo_file WHERE photo_id = ?', [id]);
        if (file.length === 0) {
          // D-121 : sans le fichier, cet appareil ne supprime rien (il peut seulement masquer la fiche chez lui) ; fiche inconnue : sans effet.
          if (row && row.deleted_at === null) throw new RepositoryError('not-found', 'progress_photo_file', id);
          return;
        }
        await x.execute('DELETE FROM progress_photo_file WHERE photo_id = ?', [id]);
        if (!row || row.deleted_at !== null) return;
        const stamp = stamper.next();
        await x.execute('UPDATE progress_photo SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
      });
    },
  };
}
