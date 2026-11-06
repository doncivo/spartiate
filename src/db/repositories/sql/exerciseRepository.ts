import type { WriteStamper } from '../../../domain/hlc';
import { validateCustomExercise, type CustomExercise, type CustomExerciseInput, type ExerciseKind, type ExerciseMetric, type ExercisePattern } from '../../../domain/training';
import type { SqlExecutor, SqlRow } from '../../driver';
import { decodeJson } from '../../parse/jsonText';
import { parseAliases, parseEquipmentIds, parseInstructions, parseMedia, parseMuscles } from '../../parse/exerciseJson';
import { RepositoryError, type ReadOptions } from '../common';
import type { ExerciseRepository } from '../exerciseRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface ExerciseRow extends SqlRow, SyncRow {
  readonly name_fr: string;
  readonly aliases_en: string;
  readonly muscles: string;
  readonly equipment: string;
  readonly pattern: string;
  readonly kind: string;
  readonly metric: string;
  readonly bodyweight_fraction: number | null;
  readonly default_rep_min: number;
  readonly default_rep_max: number;
  readonly default_rest_sec: number;
  readonly instructions: string;
  readonly media: string | null;
  readonly strength_standard_key: string | null;
  readonly schema_version: number;
}

/** Version du schéma JSON d'un exercice (§ 14.1 `schemaVersion`). */
const EXERCISE_SCHEMA_VERSION = 1;

/** Lecture tolérante : un JSON illisible (ligne reçue d'une autre version) donne une valeur de repli, la ligne reste lisible. */
function rowToExercise(row: ExerciseRow): CustomExercise {
  return {
    origin: 'custom',
    id: row.id,
    nameFr: row.name_fr,
    aliasesEn: parseAliases(decodeJson(row.aliases_en)) ?? [],
    muscles: parseMuscles(decodeJson(row.muscles)) ?? [],
    equipment: parseEquipmentIds(decodeJson(row.equipment)) ?? [],
    pattern: row.pattern as ExercisePattern,
    kind: row.kind as ExerciseKind,
    metric: row.metric as ExerciseMetric,
    bodyweightFraction: row.bodyweight_fraction,
    defaultRepRange: [row.default_rep_min, row.default_rep_max],
    defaultRestSec: row.default_rest_sec,
    instructions: parseInstructions(decodeJson(row.instructions)) ?? { setup: '', execution: '', mistakes: [] },
    media: row.media === null ? null : parseMedia(decodeJson(row.media)),
    strengthStandardKey: row.strength_standard_key,
    schemaVersion: row.schema_version,
    ...readSyncMeta(row),
  };
}

/** Valide l'entrée (domaine puis forme des JSON) et rend les textes JSON à écrire. */
function encode(input: CustomExerciseInput): { json: readonly [string, string, string, string, string | null] } {
  const bad = (): never => {
    throw new RepositoryError('invalid', 'exercise', input.id);
  };
  if (validateCustomExercise(input).length > 0) bad();
  const aliases = parseAliases(input.aliasesEn);
  const muscles = parseMuscles(input.muscles);
  const equipment = parseEquipmentIds(input.equipment);
  const instructions = parseInstructions(input.instructions);
  const media = input.media === null ? null : parseMedia(input.media);
  if (aliases === null || muscles === null || equipment === null || instructions === null || (input.media !== null && media === null)) return bad();
  return { json: [JSON.stringify(aliases), JSON.stringify(muscles), JSON.stringify(equipment), JSON.stringify(instructions), media === null ? null : JSON.stringify(media)] };
}

export function createExerciseRepository(db: SqlExecutor, stamper: WriteStamper): ExerciseRepository {
  const read = async (id: string): Promise<ExerciseRow | undefined> => (await db.select<ExerciseRow>('SELECT * FROM exercise WHERE id = ?', [id]))[0];
  const live = async (id: string): Promise<ExerciseRow> => {
    const row = await read(id);
    if (!row || row.deleted_at !== null) throw new RepositoryError('not-found', 'exercise', id);
    return row;
  };
  const reload = async (id: string): Promise<CustomExercise> => {
    const row = await read(id);
    if (!row) throw new RepositoryError('not-found', 'exercise', id);
    return rowToExercise(row);
  };

  return {
    async create(input) {
      const { json } = encode(input);
      if ((await read(input.id)) !== undefined) throw new RepositoryError('conflict', 'exercise', input.id);
      const stamp = stamper.next();
      await db.execute(
        `INSERT INTO exercise (id, name_fr, aliases_en, muscles, equipment, pattern, kind, metric, bodyweight_fraction, default_rep_min, default_rep_max, default_rest_sec,
           instructions, media, strength_standard_key, is_custom, schema_version, created_at, updated_at, device_id, hlc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.nameFr.trim(),
          json[0],
          json[1],
          json[2],
          input.pattern,
          input.kind,
          input.metric,
          input.bodyweightFraction,
          input.defaultRepRange[0],
          input.defaultRepRange[1],
          input.defaultRestSec,
          json[3],
          json[4],
          input.strengthStandardKey,
          EXERCISE_SCHEMA_VERSION,
          stamp.at,
          stamp.at,
          stamp.deviceId,
          stamp.hlc,
        ],
      );
      return reload(input.id);
    },

    async update(id, patch) {
      const current = rowToExercise(await live(id));
      const merged: CustomExerciseInput = {
        id,
        nameFr: patch.nameFr ?? current.nameFr,
        aliasesEn: patch.aliasesEn ?? current.aliasesEn,
        muscles: patch.muscles ?? current.muscles,
        equipment: patch.equipment ?? current.equipment,
        pattern: patch.pattern ?? current.pattern,
        kind: patch.kind ?? current.kind,
        metric: patch.metric ?? current.metric,
        bodyweightFraction: patch.bodyweightFraction === undefined ? current.bodyweightFraction : patch.bodyweightFraction,
        defaultRepRange: patch.defaultRepRange ?? current.defaultRepRange,
        defaultRestSec: patch.defaultRestSec ?? current.defaultRestSec,
        instructions: patch.instructions ?? current.instructions,
        media: patch.media === undefined ? current.media : patch.media,
        strengthStandardKey: patch.strengthStandardKey === undefined ? current.strengthStandardKey : patch.strengthStandardKey,
      };
      const { json } = encode(merged);
      const stamp = stamper.next();
      await db.execute(
        `UPDATE exercise SET name_fr = ?, aliases_en = ?, muscles = ?, equipment = ?, pattern = ?, kind = ?, metric = ?, bodyweight_fraction = ?, default_rep_min = ?,
           default_rep_max = ?, default_rest_sec = ?, instructions = ?, media = ?, strength_standard_key = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`,
        [
          merged.nameFr.trim(),
          json[0],
          json[1],
          json[2],
          merged.pattern,
          merged.kind,
          merged.metric,
          merged.bodyweightFraction,
          merged.defaultRepRange[0],
          merged.defaultRepRange[1],
          merged.defaultRestSec,
          json[3],
          json[4],
          merged.strengthStandardKey,
          stamp.at,
          stamp.deviceId,
          stamp.hlc,
          id,
        ],
      );
      return reload(id);
    },

    async softDelete(id) {
      await live(id);
      const stamp = stamper.next();
      await db.execute('UPDATE exercise SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
    },

    async restore(id) {
      const row = await read(id);
      if (!row || row.deleted_at === null) throw new RepositoryError('not-found', 'exercise', id);
      const stamp = stamper.next();
      await db.execute('UPDATE exercise SET deleted_at = NULL, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.deviceId, stamp.hlc, id]);
      return reload(id);
    },

    async get(id, options?: ReadOptions) {
      const row = await read(id);
      if (!row || (row.deleted_at !== null && options?.includeDeleted !== true)) return null;
      return rowToExercise(row);
    },

    async list(options?: ReadOptions) {
      const where = options?.includeDeleted === true ? '' : 'WHERE deleted_at IS NULL';
      const rows = await db.select<ExerciseRow>(`SELECT * FROM exercise ${where} ORDER BY name_fr COLLATE NOCASE, id`);
      return rows.map(rowToExercise);
    },
  };
}
