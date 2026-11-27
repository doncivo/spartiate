import { describe, expect, it } from 'vitest';
import { SCHEMA_REPUBLISH } from '../../domain/sync/schemaRepublish';
import { publishedColumns, SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { migration0025EquipmentVest } from './0025_equipment_vest';
import { migrations } from './index';

/**
 * EQUIP-0302 (BL-175, D-674) : migration 0025 (schéma 25), additive : `equipment_profile.vest_kg` (poids du gilet lesté, kg, nul = non renseigné),
 * PUBLIÉE ; une ligne créée part entière (`_ai` de la 0002), une modification est capturée par un déclencheur PROPRE (modèle de la 0020) ; aucune
 * valeur par défaut SQL (garde FIX-A009b, D-785). Données synthétiques.
 */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AT = '2026-11-27T18:00:00.000Z';
const u = (n: number): string => `7a1b0c2d-0000-4000-8000-${String(n).padStart(12, '0')}`;
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;

const dbAt = async (version: number): Promise<SqlDriver> => {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.filter((m) => m.version <= version));
  return db;
};
const profile = (db: SqlDriver, id: string) =>
  db.execute("INSERT INTO equipment_profile (id, name, kind, inventory, increments, created_at, updated_at, device_id, hlc) VALUES (?, 'Maison', 'maison', '{}', '{}', ?, ?, ?, ?)", [id, AT, AT, DEV, h(1)]);
const outbox = async (db: SqlDriver): Promise<string[]> => (await db.select<{ field: string }>("SELECT field FROM sync_outbox WHERE table_name = 'equipment_profile' ORDER BY field")).map((r) => r.field);

describe('migration 0025 : equipment_vest (EQUIP-0302)', () => {
  it('registre : 0001 à 0025 ; version 25, nom equipment_vest', () => {
    expect(migrations.slice(0, 25).map((m) => m.version)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(migrations[24]).toBe(migration0025EquipmentVest);
    expect(migration0025EquipmentVest.name).toBe('equipment_vest');
  });

  it('BL-097 : une colonne ajoutée et un déclencheur propre, rien d’autre', () => {
    const [column, trigger, ...rest] = migration0025EquipmentVest.statements;
    expect(column?.trim()).toMatch(/^ALTER TABLE equipment_profile ADD COLUMN vest_kg REAL /);
    expect(trigger?.trim()).toMatch(/^CREATE TRIGGER sync_equipment_profile_vest_au AFTER UPDATE OF vest_kg ON equipment_profile/);
    expect(rest).toEqual([]);
  });

  it('depuis la version 24 : profils intacts, poids du gilet nul, rien de mis en file', async () => {
    const db = await dbAt(24);
    await profile(db, u(1));
    await db.execute('DELETE FROM sync_outbox');
    const before = await db.select('SELECT id, name, kind, inventory, increments, hlc FROM equipment_profile');
    await migrate(db, migrations);
    expect(await db.select('SELECT id, name, kind, inventory, increments, hlc FROM equipment_profile')).toEqual(before);
    expect(await db.select('SELECT vest_kg FROM equipment_profile')).toEqual([{ vest_kg: null }]);
    expect(await db.select('SELECT 1 FROM sync_outbox')).toEqual([]);
    expect(await db.select('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1')).toEqual([{ version: 25 }]);
    await db.close();
  });

  it('contraintes : nul, ou ]0, 60] kg ; aucune valeur par défaut', async () => {
    const db = await dbAt(25);
    await profile(db, u(1));
    expect(await db.select("SELECT dflt_value FROM pragma_table_info('equipment_profile') WHERE name = 'vest_kg'")).toEqual([{ dflt_value: null }]);
    for (const bad of [0, -5, 60.5]) await expect(db.execute('UPDATE equipment_profile SET vest_kg = ?', [bad])).rejects.toThrow();
    for (const ok of [7.5, 60, null]) await expect(db.execute('UPDATE equipment_profile SET vest_kg = ?', [ok])).resolves.toBeDefined();
    await db.close();
  });

  it('création : la ligne entière part (« * ») ; modification du poids : capturée champ par champ, rien sans changement', async () => {
    const db = await dbAt(25);
    await profile(db, u(1));
    expect(await outbox(db)).toEqual(['*']);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE equipment_profile SET vest_kg = 10, hlc = ? WHERE id = ?', [h(2), u(1)]);
    expect(await outbox(db)).toEqual(['vest_kg']);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute('UPDATE equipment_profile SET vest_kg = 10, hlc = ? WHERE id = ?', [h(3), u(1)]);
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('catalogue : vest_kg (réel) publié, facultatif ; equipment_profile republiée au schéma 25', () => {
    const t = SYNC_CATALOGUE.table('equipment_profile');
    if (!t) throw new Error('equipment_profile');
    expect([...publishedColumns(t)]).toEqual(expect.arrayContaining(['vest_kg']));
    expect(t.columns.find((c) => c.name === 'vest_kg')).toMatchObject({ type: 'real', nullable: true });
    expect(SCHEMA_REPUBLISH[25]).toEqual(['equipment_profile']);
  });
});
