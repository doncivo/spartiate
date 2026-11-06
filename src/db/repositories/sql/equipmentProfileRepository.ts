import type { WriteStamper } from '../../../domain/hlc';
import { emptyInventory, validateEquipmentProfile, type EquipmentProfile, type EquipmentProfileInput, type EquipmentProfileKind } from '../../../domain/training';
import { isId } from '../../../domain/types';
import type { SqlExecutor, SqlRow } from '../../driver';
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
}

/** Lecture tolérante : un inventaire ou des incréments illisibles (autre version) se lisent vides, la ligne reste visible. */
const rowToProfile = (row: ProfileRow): EquipmentProfile => ({
  id: row.id,
  name: row.name,
  kind: row.kind as EquipmentProfileKind,
  inventory: parseInventory(decodeJson(row.inventory)) ?? emptyInventory(),
  increments: parseIncrements(decodeJson(row.increments)) ?? {},
  ...readSyncMeta(row),
});

function encode(input: EquipmentProfileInput): { inventory: string; increments: string } {
  if (!isId(input.id) || validateEquipmentProfile(input).length > 0) throw new RepositoryError('invalid', 'equipment_profile', input.id);
  const inventory = parseInventory(input.inventory);
  const increments = parseIncrements(input.increments);
  if (inventory === null || increments === null) throw new RepositoryError('invalid', 'equipment_profile', input.id);
  return { inventory: JSON.stringify(inventory), increments: JSON.stringify(increments) };
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
      await db.execute(
        'INSERT INTO equipment_profile (id, name, kind, inventory, increments, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [input.id, input.name.trim(), input.kind, json.inventory, json.increments, stamp.at, stamp.at, stamp.deviceId, stamp.hlc],
      );
      return reload(input.id);
    },

    async update(id, patch) {
      const current = rowToProfile(await live(id));
      const merged: EquipmentProfileInput = {
        id,
        name: patch.name ?? current.name,
        kind: patch.kind ?? current.kind,
        inventory: patch.inventory ?? current.inventory,
        increments: patch.increments ?? current.increments,
      };
      const json = encode(merged);
      const stamp = stamper.next();
      await db.execute('UPDATE equipment_profile SET name = ?, kind = ?, inventory = ?, increments = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [
        merged.name.trim(),
        merged.kind,
        json.inventory,
        json.increments,
        stamp.at,
        stamp.deviceId,
        stamp.hlc,
        id,
      ]);
      return reload(id);
    },

    async softDelete(id) {
      await live(id);
      const stamp = stamper.next();
      await db.execute('UPDATE equipment_profile SET deleted_at = ?, updated_at = ?, device_id = ?, hlc = ? WHERE id = ?', [stamp.at, stamp.at, stamp.deviceId, stamp.hlc, id]);
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
