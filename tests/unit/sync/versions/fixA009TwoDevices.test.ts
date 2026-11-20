import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import type { RoutineInput } from '../../../../src/domain/training';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';
import { applyEverywhere, backupOf } from '../epochCarryKit';

/**
 * FIX-A009 (A-009, D-26) : entre deux appareils (deux SQLite, banc `tests/sim/syncDevice.ts`). A, au schéma 20, rattache un jour de routine
 * au jeudi (`routine_day.weekday` = 4) et pose une cible nutritionnelle avec les colonnes de la migration 19. B, resté au schéma 19 (ou 18),
 * reçoit ces lignes par l'INSTANTANÉ de A (association, remplacement d'époque) : les colonnes qu'il ne connaît pas encore sont gardées dans
 * `sync_unknown` et réintégrées quand B passe au schéma 20, sans conflit parasite. Témoin : même scénario par le journal. Données synthétiques.
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
  days: [{ id: u(2), name: 'Jeudi — Poussée', dayOrder: 1, weekday: 4, exercises: [{ id: u(3), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 }] }] as RoutineInput['days'],
};

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

const iso = (d: SimDevice): string => new Date(d.clock.nowMs()).toISOString();

/** Écritures de A (schéma 20) : jour du jeudi et cible avec les trois colonnes de la 0019. */
async function writeOnA(a: SimDevice): Promise<void> {
  await a.data.transaction(async (r) => (await r.trainingRoutines()).create(ROUTINE));
  const at = iso(a);
  await a.driver.execute(
    `INSERT INTO nutrition_target (id, week_start, kcal, protein_g, fat_g, carb_g, source, accepted, engine_version, rest_kcal, rest_carb_g, training_days, created_at, updated_at, device_id, hlc)
     VALUES (?, '2026-11-16', 2500, 150, 70, 316, 'manual', 1, NULL, 2200, 240, '135', ?, ?, ?, ?)`,
    [TARGET, at, at, a.id, a.hlc.now()],
  );
}

async function roundTrip(times = 2): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}

const dayOf = (d: SimDevice, columns = 'name, weekday') => d.driver.select(`SELECT ${columns} FROM routine_day WHERE id = ?`, [u(2)]);
const targetOf = (d: SimDevice, columns = 'kcal, rest_kcal, rest_carb_g, training_days') => d.driver.select(`SELECT ${columns} FROM nutrition_target WHERE id = ?`, [TARGET]);
const unknownOf = (d: SimDevice) => d.driver.select<{ table_name: string; field: string; value: string; sv: number }>('SELECT table_name, field, value, sv FROM sync_unknown ORDER BY table_name, field');
const conflicts = async (d: SimDevice) => (await d.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n;
const snapshotCount = (d: SimDevice): number => [...(d.folder.devices.get(d.id)?.epochs.values() ?? [])].reduce((n, e) => n + e.snapshots.size, 0);

/** A (20) seul écrit, puis publie un instantané (une semaine plus tard) qui porte ses lignes ; B (`schema`) rejoint ENSUITE, par cet instantané. */
async function joinBySnapshot(schema: SimSchema): Promise<{ a: SimDevice; b: SimDevice }> {
  const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
  devices = [a];
  await setupFirst(a);
  await a.cycle();
  await writeOnA(a);
  await a.cycle();
  const before = snapshotCount(a);
  a.clock.advance(8 * DAY_MS);
  await a.cycle();
  expect(snapshotCount(a)).toBeGreaterThan(before);
  const b = await createSimDevice(B_ID, { name: 'iPhone', schema, clock: createManualClock(a.clock.nowMs()) });
  devices.push(b);
  a.clock.advance(11 * 60_000);
  b.clock.advance(11 * 60_000);
  await pair(a, b);
  await b.cycle();
  return { a, b };
}

describe('FIX-A009 : colonnes inconnues d’une table connue reçues par instantané', () => {
  it('B au schéma 19 rejoint par l’instantané de A (20) : jeudi gardé dans sync_unknown, puis réintégré quand B passe en 20, sans conflit', async () => {
    const { a, b } = await joinBySnapshot('v19');
    expect(await dayOf(b, 'name')).toEqual([{ name: 'Jeudi — Poussée' }]);
    expect(await targetOf(b)).toEqual([{ kcal: 2500, rest_kcal: 2200, rest_carb_g: 240, training_days: '135' }]);
    expect((await unknownOf(b)).filter((f) => f.field === 'weekday')).toEqual([{ table_name: 'routine_day', field: 'weekday', value: '4', sv: 20 }]);
    await b.upgradeSchema('i0');
    await roundTrip(3);
    expect(await dayOf(b)).toEqual([{ name: 'Jeudi — Poussée', weekday: 4 }]);
    expect(await dayOf(a)).toEqual([{ name: 'Jeudi — Poussée', weekday: 4 }]);
    expect(await unknownOf(b)).toEqual([]);
    expect(await conflicts(a)).toBe(0);
    expect(await conflicts(b)).toBe(0);
  });

  it('B au schéma 18 : jeudi et les trois colonnes nutritionnelles de la 0019 gardés, puis réintégrés en 20 ; A inchangé', async () => {
    const { a, b } = await joinBySnapshot('v18');
    expect((await unknownOf(b)).map((f) => `${f.table_name}.${f.field}`)).toEqual(['nutrition_target.rest_carb_g', 'nutrition_target.rest_kcal', 'nutrition_target.training_days', 'routine_day.weekday']);
    await b.upgradeSchema('i0');
    await roundTrip(3);
    expect(await dayOf(b)).toEqual([{ name: 'Jeudi — Poussée', weekday: 4 }]);
    expect(await targetOf(b)).toEqual([{ kcal: 2500, rest_kcal: 2200, rest_carb_g: 240, training_days: '135' }]);
    expect(await targetOf(a)).toEqual([{ kcal: 2500, rest_kcal: 2200, rest_carb_g: 240, training_days: '135' }]);
    expect(await dayOf(a)).toEqual([{ name: 'Jeudi — Poussée', weekday: 4 }]);
    expect(await conflicts(a)).toBe(0);
    expect(await conflicts(b)).toBe(0);
  });

  it('témoin journal : B (19) associé avant les écritures reçoit par le journal ; jeudi réintégré en 20', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'v19', clock: createManualClock(a.clock.nowMs()) });
    devices = [a, b];
    await setupFirst(a);
    await a.cycle();
    await pair(a, b);
    await b.cycle();
    syncFolders(devices);
    await writeOnA(a);
    await roundTrip();
    expect((await unknownOf(b)).filter((f) => f.field === 'weekday')).toEqual([{ table_name: 'routine_day', field: 'weekday', value: '4', sv: 20 }]);
    await b.upgradeSchema('i0');
    await roundTrip(3);
    expect(await dayOf(b)).toEqual([{ name: 'Jeudi — Poussée', weekday: 4 }]);
    expect(await conflicts(b)).toBe(0);
  });

  it('remplacement d’époque : A (20) restaure et choisit « Appliquer partout », B (19) remplace par l’instantané : jeudi gardé, réintégré en 20', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'v19', clock: a.clock });
    devices = [a, b];
    await setupFirst(a);
    await a.cycle();
    await pair(a, b);
    await b.cycle();
    syncFolders(devices);
    await writeOnA(a);
    await roundTrip();
    const copy = await backupOf(a);
    await roundTrip();
    await applyEverywhere(a, copy);
    syncFolders(devices);
    await roundTrip(3);
    expect(b.logger.entries.map((e) => e.event)).toContain('epoch-carry');
    expect(await dayOf(b, 'name')).toEqual([{ name: 'Jeudi — Poussée' }]);
    expect((await unknownOf(b)).filter((f) => f.field === 'weekday')).toEqual([{ table_name: 'routine_day', field: 'weekday', value: '4', sv: 20 }]);
    await b.upgradeSchema('i0');
    await roundTrip(3);
    expect(await dayOf(b)).toEqual([{ name: 'Jeudi — Poussée', weekday: 4 }]);
    expect(await dayOf(a)).toEqual([{ name: 'Jeudi — Poussée', weekday: 4 }]);
    expect(await conflicts(a)).toBe(0);
    expect(await conflicts(b)).toBe(0);
  });
});
