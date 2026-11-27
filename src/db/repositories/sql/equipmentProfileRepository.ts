import type { WriteStamper } from '../../../domain/hlc';
import { emptyInventory, validateEquipmentProfile, type EquipmentProfile, type EquipmentProfileInput, type EquipmentProfileKind } from '../../../domain/training';
import { isId } from '../../../domain/types';
import type { SqlDriver, SqlExecutor, SqlRow } from '../../driver';
import { parseIncrements, parseInventory } from '../../parse/equipmentJson';
import { decodeJson } from '../../parse/jsonText';
import { RepositoryError, type ReadOptions } from '../common';
import type { EquipmentProfileRepository } from '../equipmentProfileRepository';
import { createSettingsRepository } from './settingsRepository';
import { readSyncMeta, type SyncRow } from './sqlHelpers';

interface ProfileRow extends SqlRow, SyncRow {
  readonly name: string;
  readonly kind: string;
  readonly inventory: string;
  readonly increments: string;
  /** EQUIP-0302 : absente d'une base antérieure à la migration 0025 (jamais en production : le migrateur passe avant ; banc de synchro au schéma 24). */
  readonly vest_kg?: number | null;
}

/** Lecture tolérante : un inventaire ou des incréments illisibles (autre version) se lisent vides, la ligne reste visible. */
const rowToProfile = (row: ProfileRow): EquipmentProfile => ({
  id: row.id,
  name: row.name,
  kind: row.kind as EquipmentProfileKind,
  inventory: parseInventory(decodeJson(row.inventory)) ?? emptyInventory(),
  increments: parseIncrements(decodeJson(row.increments)) ?? {},
  vestKg: row.vest_kg ?? null,
  ...readSyncMeta(row),
});

function encode(input: EquipmentProfileInput): { inventory: string; increments: string } {
  if (!isId(input.id) || validateEquipmentProfile(input).length > 0) throw new RepositoryError('invalid', 'equipment_profile', input.id);
  const inventory = parseInventory(input.inventory);
  const increments = parseIncrements(input.increments);
  if (inventory === null || increments === null) throw new RepositoryError('invalid', 'equipment_profile', input.id);
  return { inventory: JSON.stringify(inventory), increments: JSON.stringify(increments) };
}

/** SEANCE-0292 (C-081) : d'un seul tenant ; dans une transaction de l'appelant, exécuté tel quel (comme cardioRepository). */
function atomic<T>(db: SqlExecutor, fn: (x: SqlExecutor) => Promise<T>): Promise<T> {
  const driver = db as Partial<SqlDriver>;
  return typeof driver.transaction === 'function' ? driver.transaction(fn) : fn(db);
}

export function createEquipmentProfileRepository(db: SqlExecutor, stamper: WriteStamper): EquipmentProfileRepository {
  const settings = createSettingsRepository(db, stamper);
  const read = async (id: string): Promise<ProfileRow | undefined> => (await db.select<ProfileRow>('SELECT * FROM equipment_profile WHERE id = ?', [id]))[0];
  const live = async (id: string): Promise<ProfileRow> => {
    const row = await read(id);
    if (!row || row.deleted_at !== null) throw new RepositoryError('not-found', 'equipment_profile', id);
    return row;
  };
  const reload = async (id: string): Promise<EquipmentProfile> => {
    const row = await read(id);
    if (!row) throw new RepositoryError('not-found', 'equipment_profile', id);
    return rowToProfile(row);
  };
  const get = async (id: string, options?: ReadOptions): Promise<EquipmentProfile | null> => {
    const row = await read(id);
    return !row || (row.deleted_at !== null && options?.includeDeleted !== true) ? null : rowToProfile(row);
  };

  return {
    async create(input) {
      const json = encode(input);
      if ((await read(input.id)) !== undefined) throw new RepositoryError('conflict', 'equipment_profile', input.id);
      const stamp = stamper.next();
      // EQUIP-0302 : poids du gilet écrit seulement s'il est renseigné (nul sinon, sans valeur par défaut SQL).
      const vest = input.vestKg ?? null;
      await db.execute(
        `INSERT INTO equipment_profile (id, name, kind, inventory, increments, created_at, updated_at, device_id, hlc${vest === null ? '' : ', vest_kg'}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?${vest === null ? '' : ', ?'})`,
        [input.id, input.name.trim(), input.kind, json.inventory, json.increments, stamp.at, stamp.at, stamp.deviceId, stamp.hlc, ...(vest === null ? [] : [vest])],
      );
      return reload(input.id);
    },

    async update(id, patch) {
      const row = await live(id);
      const current = rowToProfile(row);
      // DATA-0293 (BL-037) : inventaire ou incréments illisibles non remplacés par la modification : jamais réécrits en vide (écriture refusée).
      if ((patch.inventory === undefined && parseInventory(decodeJson(row.inventory)) === null) || (patch.increments === undefined && parseIncrements(decodeJson(row.increments)) === null)) {
        throw new RepositoryError('invalid', 'equipment_profile', id);
      }
      const merged: EquipmentProfileInput = {
        id,
        name: patch.name ?? current.name,
        kind: patch.kind ?? current.kind,
        inventory: patch.inventory ?? current.inventory,
        increments: patch.increments ?? current.increments,
        vestKg: patch.vestKg === undefined ? current.vestKg : patch.vestKg,
      };
      const json = encode(merged);
      const stamp = stamper.next();
      // EQUIP-0302 : le poids du gilet n'est écrit que si la modification le nomme (capturé alors par `sync_equipment_profile_vest_au`).
      const vest = patch.vestKg === undefined ? [] : [merged.vestKg ?? null];
      await db.execute(`UPDATE equipment_profile SET name = ?, kind = ?, inventory = ?, increments = ?${vest.length > 0 ? ', vest_kg = ?' : ''}, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?`, [
        merged.name.trim(),
        merged.kind,
        json.inventory,
        json.increments,
        ...vest,
        stamp.at,
        stamp.deviceId,
        stamp.hlc,
        id,
      ]);
      return reload(id);
    },

    async softDelete(id) {
      await live(id);
      // SEANCE-0292 (C-081) : profil supprimé et, s'il était actif sur cet appareil, réglage local effacé, dans une même transaction.
      await atomic(db, async (db) => {
        const stamp = stamper.next();
        await db.execute('UPDATE equipment_profile SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
        const local = createSettingsRepository(db, stamper);
        if ((await local.get('training.activeEquipmentProfile')) === id) await local.set('training.activeEquipmentProfile', null);
      });
    },

    get,

    async list(options) {
      const where = options?.includeDeleted === true ? '' : 'WHERE deleted_at IS NULL';
      const rows = await db.select<ProfileRow>(`SELECT * FROM equipment_profile ${where} ORDER BY name COLLATE NOCASE, id`);
      return rows.map(rowToProfile);
    },

    getActiveId: () => settings.get('training.activeEquipmentProfile'),

    async getActive() {
      const id = await settings.get('training.activeEquipmentProfile');
      return id === null ? null : get(id);
    },

    async setActive(id) {
      if (id !== null) await live(id);
      await settings.set('training.activeEquipmentProfile', id);
    },
  };
}
