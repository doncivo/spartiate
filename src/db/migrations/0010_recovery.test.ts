import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { openSqliteWasmDriver } from '../drivers/sqliteWasm';
import { migrate } from '../migrator';
import { CAPTURE_TABLES_V10, migration0010Recovery } from './0010_recovery';
import { migrations } from './index';

/**
 * I5-01 point 1.5 : migration 0010 — `recovery_day` et `muscle_recovery` (publiées, iPhone vers PC, § 16.4, § 20.2) et deux tables LOCALES
 * non publiées, sans colonne de synchro ni déclencheur : `recovery_sample` (échantillons importés des fichiers Raccourcis, D-69) et
 * `recovery_import_state` (dernier import par type). Schéma strictement additif : aucune table existante n'est modifiée.
 */

const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): string => `${String(ms).padStart(15, '0')}-0000-${DEV}`;
const AT = '2026-11-09T08:00:00.000Z';
const BASE = 10;

async function freshDb(): Promise<SqlDriver> {
  const db = await openSqliteWasmDriver();
  await migrate(db, migrations.slice(0, BASE));
  return db;
}
type Row = Record<string, string | number | null>;
const meta = (hlc = 1): Row => ({ created_at: AT, updated_at: AT, device_id: DEV, hlc: h(hlc) });
const insert = (db: SqlDriver, table: string, row: Row): Promise<unknown> => {
  const cols = Object.keys(row);
  return db.execute(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] ?? null));
};
const day = (over: Row = {}): Row => ({
  id: 'recovery|2026-11-09', date: '2026-11-09', level: 'C', recovery: 72, abstain_reason: null, quality: 'good', exertion: 4.5, exertion_prev_day: 2,
  sleep_minutes: 450, sleep_need_minutes: 480, sleep_score: 94, bedtime_sigma_minutes: 22.5, target_zone_from: 8, target_zone_to: 12, hrv_ms: 62.5, resting_hr: 51,
  learning_nights: 14, contributors: '[{"key":"hrv","value":0.4,"weight":0.7}]', explanation_keys: '["exertion_cardio_not_counted"]', computed_at: AT, engine_version: 1, ...meta(), ...over,
});
const muscle = (over: Row = {}): Row => ({
  id: 'muscle|2026-11-09|quads', date: '2026-11-09', muscle_id: 'quads', muscle_group: 'Jambes', percent: 40, hours: 96, last_worked_at: '2026-11-08T18:00:00.000Z', ready_at: '2026-11-12T18:00:00.000Z', ...meta(), ...over,
});
const sample = (over: Row = {}): Row => ({ type: 'hrv', start_at: '2026-11-09T05:00:00.000Z', end_at: '2026-11-09T05:00:00.000Z', value: 55, stage: null, source: 'hrv.csv', imported_at: AT, ...over });
const outbox = (db: SqlDriver) => db.select<{ table_name: string; row_id: string; field: string }>('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');
const tableNames = async (db: SqlDriver) => (await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((r) => r.name);

describe('migration 0010 : récupération (I5-01 point 1.5)', () => {
  it('registre : 0001 à 0010 ; version 10, nom recovery', () => {
    expect(migrations.slice(0, 10).map((m) => m.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(migrations[9]).toBe(migration0010Recovery);
    expect(migration0010Recovery.name).toBe('recovery');
  });

  it('base 0009 → 0010 : quatre tables vides, rien mis en file, AUCUNE table existante modifiée, aucune donnée touchée', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, BASE - 1));
    await db.execute('DELETE FROM sync_outbox');
    const before = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    await migrate(db, migrations.slice(0, BASE));
    const after = await db.select<{ name: string; sql: string }>("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
    const beforeNames = new Set(before.map((r) => r.name));
    for (const row of before) expect(after.find((r) => r.name === row.name), row.name).toEqual(row);
    const added = after.filter((r) => !beforeNames.has(r.name)).map((r) => r.name);
    expect(added.filter((n) => !n.startsWith('sync_') && !n.startsWith('idx_') && !n.startsWith('sqlite_')).sort()).toEqual(['muscle_recovery', 'recovery_day', 'recovery_import_state', 'recovery_sample']);
    for (const t of ['recovery_day', 'muscle_recovery', 'recovery_sample', 'recovery_import_state']) expect(await db.select(`SELECT * FROM ${t}`)).toEqual([]);
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('index : date de recovery_day et de muscle_recovery, fenêtre et purge des échantillons', async () => {
    const db = await freshDb();
    const detail = async (sql: string) => (await db.select<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`)).map((p) => p.detail).join(' ');
    expect(await detail("SELECT * FROM recovery_day WHERE date >= '2026-11-01' AND date <= '2026-11-30' AND deleted_at IS NULL")).toMatch(/USING (COVERING )?INDEX/);
    expect(await detail("SELECT * FROM muscle_recovery WHERE date = '2026-11-09' AND deleted_at IS NULL")).toMatch(/USING (COVERING )?INDEX/);
    expect(await detail("SELECT * FROM recovery_sample WHERE type = 'hrv' AND start_at >= '2026-11-01'")).toMatch(/USING (COVERING )?INDEX/);
    expect(await detail("DELETE FROM recovery_sample WHERE end_at < '2026-07-01'")).toMatch(/USING (COVERING )?INDEX/);
    await db.close();
  });

  it('recovery_day : identifiant « recovery| » + date, une ligne par date, bornes et listes fermées', async () => {
    const db = await freshDb();
    const bad: Row[] = [
      { id: 'recovery|2026-11-10' },
      { id: 'day|2026-11-09' },
      { date: '2026-11-9', id: 'recovery|2026-11-9' },
      { level: 'D' },
      { level: null },
      { quality: 'great' },
      { recovery: 101 },
      { recovery: -1 },
      { recovery: 50.5 },
      { recovery: null }, // sans raison d'abstention : refus (jamais de faux zéro silencieux)
      { abstain_reason: 'measure_missing_hrv' }, // une valeur ET une raison : incohérent
      { recovery: null, abstain_reason: 'because' },
      { exertion: -1 },
      { exertion: null },
      { exertion_prev_day: -0.1 },
      { sleep_minutes: -1 },
      { sleep_minutes: 1441 },
      { sleep_need_minutes: 0 },
      { sleep_need_minutes: null },
      { sleep_score: 101 },
      { bedtime_sigma_minutes: -1 },
      { target_zone_from: 8, target_zone_to: null },
      { target_zone_from: 12, target_zone_to: 8 },
      { target_zone_from: -1 },
      { hrv_ms: 0 },
      { hrv_ms: 1001 },
      { resting_hr: 0 },
      { resting_hr: 301 },
      { learning_nights: -1 },
      { learning_nights: 1.5 },
      { contributors: 'pas du json' },
      { contributors: '{"a":1}' },
      { contributors: null },
      { explanation_keys: '"texte"' },
      { explanation_keys: null },
      { computed_at: null },
      { engine_version: 0 },
      { engine_version: null },
    ];
    for (const [i, over] of bad.entries()) await expect(insert(db, 'recovery_day', day(over)), `${i} ${JSON.stringify(over)}`).rejects.toThrow();
    await insert(db, 'recovery_day', day());
    await expect(insert(db, 'recovery_day', day({ level: 'B' }))).rejects.toThrow(); // même date : une seule ligne
    // Abstention : niveau A/B, valeur absente avec sa raison, mesures inconnues = NULL, jamais 0.
    await insert(db, 'recovery_day', day({
      id: 'recovery|2026-11-10', date: '2026-11-10', level: 'A', recovery: null, abstain_reason: 'baseline_incomplete', quality: 'insufficient', sleep_minutes: null, sleep_score: null,
      bedtime_sigma_minutes: null, target_zone_from: null, target_zone_to: null, hrv_ms: null, resting_hr: null, contributors: '[]', explanation_keys: '[]',
    }));
    await db.close();
  });

  it('muscle_recovery : identifiant « muscle|date|muscle », une ligne par date et muscle, pourcentage entier 0 à 100', async () => {
    const db = await freshDb();
    const bad: Row[] = [
      { id: 'muscle|2026-11-09|lats' },
      { id: 'quads' },
      { date: '2026-11-9', id: 'muscle|2026-11-9|quads' },
      { muscle_id: '' },
      { muscle_group: '' },
      { percent: 101 },
      { percent: -1 },
      { percent: 40.5 },
      { percent: null },
      { hours: 0 },
      { hours: null },
      { last_worked_at: null },
      { ready_at: null },
    ];
    for (const [i, over] of bad.entries()) await expect(insert(db, 'muscle_recovery', muscle(over)), `${i} ${JSON.stringify(over)}`).rejects.toThrow();
    await insert(db, 'muscle_recovery', muscle());
    await expect(insert(db, 'muscle_recovery', muscle({ id: 'muscle|2026-11-09|quads', percent: 50 }))).rejects.toThrow();
    await insert(db, 'muscle_recovery', muscle({ id: 'muscle|2026-11-09|lats', muscle_id: 'lats', muscle_group: 'Dos', percent: 0 }));
    await insert(db, 'muscle_recovery', muscle({ id: 'muscle|2026-11-10|quads', date: '2026-11-10', percent: 100 }));
    await db.close();
  });

  it('recovery_sample : LOCALE (aucune colonne de synchro, aucun déclencheur), type fermé, valeur ou stade selon le type, une ligne par échantillon', async () => {
    const db = await freshDb();
    const cols = (await db.select<{ name: string }>('PRAGMA table_info(recovery_sample)')).map((c) => c.name);
    for (const forbidden of ['hlc', 'device_id', 'deleted_at', 'updated_at']) expect(cols).not.toContain(forbidden);
    expect(await db.select("SELECT name FROM sqlite_master WHERE type = 'trigger' AND (tbl_name = 'recovery_sample' OR tbl_name = 'recovery_import_state')")).toEqual([]);
    const bad: Row[] = [
      { type: 'tension' },
      { value: null }, // hrv sans valeur
      { value: 0 },
      { stage: 'rem' }, // hrv avec un stade
      { start_at: '2026-11-09T05:00:00.000Z', end_at: '2026-11-09T04:00:00.000Z' },
      { source: '' },
      { source: null },
      { imported_at: null },
      { type: 'sommeil', value: 1, stage: 'rem' }, // sommeil avec valeur
      { type: 'sommeil', value: null, stage: null }, // sommeil sans stade
      { type: 'sommeil', value: null, stage: 'dreaming' },
      { type: 'pas', value: -1 },
    ];
    for (const [i, over] of bad.entries()) await expect(insert(db, 'recovery_sample', sample(over)), `${i} ${JSON.stringify(over)}`).rejects.toThrow();
    await insert(db, 'recovery_sample', sample());
    await expect(insert(db, 'recovery_sample', sample({ value: 60, source: 'autre.csv' }))).rejects.toThrow(); // même type + instants : doublon
    await insert(db, 'recovery_sample', sample({ type: 'fc-repos', value: 50 }));
    await insert(db, 'recovery_sample', sample({ type: 'pas', value: 0, start_at: '2026-11-09T09:00:00.000Z', end_at: '2026-11-09T09:30:00.000Z' }));
    const night = { type: 'sommeil', value: null, start_at: '2026-11-08T22:00:00.000Z', end_at: '2026-11-09T05:00:00.000Z' };
    await insert(db, 'recovery_sample', sample({ ...night, stage: 'in_bed' }));
    await insert(db, 'recovery_sample', sample({ ...night, stage: 'asleep' })); // même intervalle, autre stade : distinct
    await expect(insert(db, 'recovery_sample', sample({ ...night, stage: 'asleep', source: 'x.csv' }))).rejects.toThrow();
    // Le doublon est ignoré sans erreur par INSERT OR IGNORE (stade NULL compris).
    await db.execute("INSERT OR IGNORE INTO recovery_sample (type, start_at, end_at, value, stage, source, imported_at) VALUES ('hrv', '2026-11-09T05:00:00.000Z', '2026-11-09T05:00:00.000Z', 99, NULL, 'z', ?)", [AT]);
    expect(await db.select("SELECT value FROM recovery_sample WHERE type = 'hrv'")).toEqual([{ value: 55 }]);
    await db.close();
  });

  it('recovery_import_state : une ligne par type, local', async () => {
    const db = await freshDb();
    const row = { type: 'hrv', imported_at: AT, newest_sample_at: '2026-11-09T05:00:00.000Z', added: 3, duplicates: 1, rejected: 0 };
    for (const over of [{ type: 'tension' }, { added: -1 }, { duplicates: -1 }, { rejected: -1 }, { imported_at: null }]) {
      await expect(insert(db, 'recovery_import_state', { ...row, ...over }), JSON.stringify(over)).rejects.toThrow();
    }
    await insert(db, 'recovery_import_state', row);
    await expect(insert(db, 'recovery_import_state', row)).rejects.toThrow();
    await insert(db, 'recovery_import_state', { ...row, type: 'sommeil', newest_sample_at: null });
    expect(await outbox(db)).toEqual([]);
    await db.close();
  });

  it('copie figée : colonnes capturées = colonnes métier de la table (hors id, updated_at, device_id, hlc), jamais une colonne locale', async () => {
    expect(CAPTURE_TABLES_V10.map(([name]) => name)).toEqual(['recovery_day', 'muscle_recovery']);
    const db = await freshDb();
    for (const [name, columns] of CAPTURE_TABLES_V10) {
      const real = (await db.select<{ name: string }>(`PRAGMA table_info(${name})`)).map((c) => c.name).filter((c) => !['id', 'updated_at', 'device_id', 'hlc'].includes(c));
      expect([...columns].sort(), name).toEqual(real.sort());
    }
    await db.close();
  });

  it('quatre déclencheurs de capture (un `_ai` et un `_au` par table publiée), 44 au total', async () => {
    const db = await freshDb();
    const names = (await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger' AND (name LIKE 'sync_recovery%' OR name LIKE 'sync_muscle%') ORDER BY name")).map((r) => r.name);
    expect(names).toEqual(['sync_muscle_recovery_ai', 'sync_muscle_recovery_au', 'sync_recovery_day_ai', 'sync_recovery_day_au']);
    expect(await db.select("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'")).toHaveLength(44);
    expect(await tableNames(db)).toEqual(expect.arrayContaining(['recovery_day', 'muscle_recovery', 'recovery_sample', 'recovery_import_state']));
    await db.close();
  });

  it.each([
    ['recovery_day', 'recovery', 80, () => day()],
    ['recovery_day', 'sleep_minutes', null, () => day()],
    ['recovery_day', 'contributors', '[]', () => day()],
    ['muscle_recovery', 'percent', 55, () => muscle()],
    ['muscle_recovery', 'ready_at', '2026-11-13T00:00:00.000Z', () => muscle()],
  ] as const)('capture de %s.%s : insertion en ligne entière, modification champ par champ avec base_hlc, restauration « + »', async (table, column, value, make) => {
    const db = await freshDb();
    const row = make();
    const id = String(row['id']);
    await db.execute('DELETE FROM sync_outbox');
    await insert(db, table, row);
    expect(await outbox(db)).toEqual([{ table_name: table, row_id: id, field: '*' }]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute(`UPDATE ${table} SET ${column} = ?, hlc = ? WHERE id = ?`, [value, h(5), id]);
    expect(await outbox(db)).toEqual([{ table_name: table, row_id: id, field: column }]);
    expect(await db.select('SELECT field, hlc, base_hlc FROM sync_field_clock WHERE table_name = ? AND row_id = ? ORDER BY field', [table, id])).toEqual([
      { field: '*', hlc: h(1), base_hlc: null },
      { field: column, hlc: h(5), base_hlc: h(1) },
    ]);
    await db.execute('DELETE FROM sync_outbox');
    await db.execute(`UPDATE ${table} SET deleted_at = ?, hlc = ? WHERE id = ?`, [AT, h(6), id]);
    await db.execute(`UPDATE ${table} SET deleted_at = NULL, hlc = ? WHERE id = ?`, [h(7), id]);
    expect((await outbox(db)).map((o) => o.field).sort()).toEqual(['+', 'deleted_at']);
    await db.close();
  });

  it('recréation d’un identifiant supprimé : la tombstone est retirée', async () => {
    const db = await freshDb();
    await db.execute("INSERT INTO sync_tombstone (table_name, row_id, deleted_hlc, purged_at) VALUES ('muscle_recovery', 'muscle|2026-11-09|quads', ?, ?)", [h(2), AT]);
    await insert(db, 'muscle_recovery', muscle());
    expect(await db.select("SELECT 1 FROM sync_tombstone WHERE table_name = 'muscle_recovery'")).toEqual([]);
    await db.close();
  });

  it('sous sync_guard : aucune capture ; les tables locales ne mettent jamais rien en file ; relance sans effet', async () => {
    const db = await freshDb();
    await insert(db, 'recovery_sample', sample());
    await insert(db, 'recovery_import_state', { type: 'hrv', imported_at: AT, newest_sample_at: null, added: 0, duplicates: 0, rejected: 0 });
    expect(await outbox(db)).toEqual([]);
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await insert(db, 'recovery_day', day());
    await insert(db, 'muscle_recovery', muscle());
    await db.execute('UPDATE recovery_day SET recovery = 10, hlc = ? WHERE id = ?', [h(2), 'recovery|2026-11-09']);
    expect(await outbox(db)).toEqual([]);
    expect(await db.select('SELECT * FROM sync_field_clock')).toEqual([]);
    expect((await migrate(db, migrations.slice(0, BASE))).applied).toEqual([]);
    await db.close();
  });
});
