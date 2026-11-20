import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { RoutineInput } from '../../../../src/domain/training';
import type { IsoDateTime } from '../../../../src/domain/types';
import { openSqliteWasmDriver } from '../../../../src/db/drivers/sqliteWasm';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories/sql/syncUnknown';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * FIX-A009b (ADR 0011 avenant 39) : un champ gardé dans `sync_unknown` est réintégré contre l'horloge DE CE CHAMP sur le lecteur. Une colonne
 * que le lecteur n'avait pas n'a aucune horloge propre et vaut nul : elle n'a jamais été écrite ici, la valeur gardée s'applique sans conflit,
 * même si la ligne a été écrite après le champ (renommage, suppression). Deux SQLite (banc `tests/sim/syncDevice.ts`), données synthétiques.
 */
const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb19';
const DAY_MS = 86_400_000;
const u = (n: number): string => `5c1d0e2f-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TARGET = u(10);
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Programme',
  mode: 'programme',
  days: [{ id: u(2), name: 'Jeudi', dayOrder: 1, weekday: 4, exercises: [{ id: u(3), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 }] }] as RoutineInput['days'],
};

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

const iso = (d: SimDevice): string => new Date(d.clock.nowMs()).toISOString();
const dayOf = (d: SimDevice) => d.driver.select('SELECT name, weekday FROM routine_day WHERE id = ?', [u(2)]);
const unknownCount = async (d: SimDevice) => (await d.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM sync_unknown'))[0]?.n;
const conflicts = async (d: SimDevice) => (await d.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n;

async function roundTrip(times = 2): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}

/** A (20) et B (`schema`) associés avant toute écriture : B reçoit par le journal. */
async function pairedByJournal(schema: SimSchema): Promise<{ a: SimDevice; b: SimDevice }> {
  const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', schema, clock: createManualClock(a.clock.nowMs()) });
  devices = [a, b];
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders(devices);
  return { a, b };
}

/** Jeudi posé, puis jour renommé une seconde plus tard (avant toute publication). */
async function thursdayThenRename(a: SimDevice): Promise<void> {
  await a.data.transaction(async (r) => (await r.trainingRoutines()).create(ROUTINE));
  a.clock.advance(1_000);
  await a.data.transaction(async (r) => (await r.trainingRoutines()).updateDay(u(2), { name: 'Jeudi lourd' }));
}

describe('FIX-A009b : réintégration contre l’horloge du champ gardé', () => {
  it('journal : jeudi posé puis jour renommé sur A (20) avant la lecture par B (19) ; B en 20 a jeudi, sans conflit', async () => {
    const { a, b } = await pairedByJournal('v19');
    await thursdayThenRename(a);
    await roundTrip();
    await b.upgradeSchema('i0');
    await roundTrip(3);
    expect(await dayOf(b)).toEqual([{ name: 'Jeudi lourd', weekday: 4 }]);
    expect(await dayOf(a)).toEqual([{ name: 'Jeudi lourd', weekday: 4 }]);
    expect(await unknownCount(b)).toBe(0);
    expect(await conflicts(a)).toBe(0);
    expect(await conflicts(b)).toBe(0);
  });

  it('instantané : B (19) rejoint après le renommage par l’instantané de A ; B en 20 a jeudi, sans conflit', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    devices = [a];
    await setupFirst(a);
    await a.cycle();
    await thursdayThenRename(a);
    await a.cycle();
    a.clock.advance(8 * DAY_MS);
    await a.cycle();
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'v19', clock: createManualClock(a.clock.nowMs()) });
    devices.push(b);
    a.clock.advance(11 * 60_000);
    b.clock.advance(11 * 60_000);
    await pair(a, b);
    await b.cycle();
    await b.upgradeSchema('i0');
    await roundTrip(3);
    expect(await dayOf(b)).toEqual([{ name: 'Jeudi lourd', weekday: 4 }]);
    expect(await dayOf(a)).toEqual([{ name: 'Jeudi lourd', weekday: 4 }]);
    expect(await unknownCount(b)).toBe(0);
    expect(await conflicts(a)).toBe(0);
    expect(await conflicts(b)).toBe(0);
  });

  it('suppression : cible posée avec les colonnes de la 0019 puis supprimée sur A avant la lecture par B (18) ; en 20, jamais ressuscitée, colonnes réintégrées, aucun conflit', async () => {
    const { a, b } = await pairedByJournal('v18');
    const at = iso(a);
    await a.driver.execute(
      `INSERT INTO nutrition_target (id, week_start, kcal, protein_g, fat_g, carb_g, source, accepted, engine_version, rest_kcal, rest_carb_g, training_days, created_at, updated_at, device_id, hlc)
       VALUES (?, '2026-11-16', 2500, 150, 70, 316, 'manual', 1, NULL, 2200, 240, '135', ?, ?, ?, ?)`,
      [TARGET, at, at, a.id, a.hlc.now()],
    );
    a.clock.advance(1_000);
    const later = iso(a);
    await a.driver.execute('UPDATE nutrition_target SET deleted_at = ?, updated_at = ?, hlc = ? WHERE id = ?', [later, later, a.hlc.now(), TARGET]);
    await roundTrip();
    await b.upgradeSchema('i0');
    await roundTrip(3);
    const target = 'SELECT deleted_at IS NOT NULL AS deleted, rest_kcal, rest_carb_g, training_days FROM nutrition_target WHERE id = ?';
    expect(await b.driver.select(target, [TARGET])).toEqual([{ deleted: 1, rest_kcal: 2200, rest_carb_g: 240, training_days: '135' }]);
    expect(await a.driver.select(target, [TARGET])).toEqual([{ deleted: 1, rest_kcal: 2200, rest_carb_g: 240, training_days: '135' }]);
    expect(await unknownCount(b)).toBe(0);
    expect(await conflicts(a)).toBe(0);
    expect(await conflicts(b)).toBe(0);
  });

  it('champ écrit localement après le champ gardé (horloge propre plus récente) : la valeur locale reste', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    devices = [a];
    await a.data.transaction(async (r) => (await r.trainingRoutines()).create({ ...ROUTINE, days: ROUTINE.days.map((d) => ({ ...d, weekday: null })) } as RoutineInput));
    // Champ gardé plus ancien, écrit par un autre appareil (B) avant l'écriture locale.
    const kept = `${String(a.clock.nowMs() - 5_000).padStart(15, '0')}-0000-${B_ID}`;
    await a.driver.execute("INSERT INTO sync_unknown (table_name, row_id, field, value, hlc, base_hlc, sv) VALUES ('routine_day', ?, 'weekday', '4', ?, NULL, 21)", [u(2), kept]);
    a.clock.advance(1_000);
    await a.data.transaction(async (r) => (await r.trainingRoutines()).updateDay(u(2), { weekday: 2 }));
    await reintegrateUnknownFields(a.driver, { now: iso(a) as IsoDateTime });
    expect(await dayOf(a)).toEqual([{ name: 'Jeudi', weekday: 2 }]);
    expect(await unknownCount(a)).toBe(0);
  });

  it('garde : toute colonne publiée ajoutée par une migration à une table déjà publiée naît nulle (aucune valeur par défaut)', async () => {
    const db = await openSqliteWasmDriver();
    const captured = async () => new Set((await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%_ai'")).map((r) => r.name.slice(5, -3)));
    const columns = async (table: string) => new Map((await db.select<{ name: string; dflt_value: string | null }>(`SELECT name, dflt_value FROM pragma_table_info('${table}')`)).map((r) => [r.name, r.dflt_value]));
    const added: { table: string; column: string; dflt: string | null }[] = [];
    let before = await captured();
    let shapes = new Map<string, Map<string, string | null>>();
    for (const t of SYNC_CATALOGUE.tables) shapes.set(t.name, await columns(t.name));
    for (const migration of migrations) {
      await migrate(db, migrations.filter((m) => m.version <= migration.version));
      const next = new Map<string, Map<string, string | null>>();
      for (const t of SYNC_CATALOGUE.tables) {
        const now = await columns(t.name);
        next.set(t.name, now);
        if (!before.has(t.name)) continue;
        for (const c of publishedColumns(t)) if (now.has(c) && !(shapes.get(t.name)?.has(c) ?? false)) added.push({ table: t.name, column: c, dflt: now.get(c) ?? null });
      }
      shapes = next;
      before = await captured();
    }
    await db.close();
    expect(added.length).toBeGreaterThan(0);
    expect(added.filter((c) => c.dflt !== null && c.dflt.toUpperCase() !== 'NULL')).toEqual([]);
  });
});
