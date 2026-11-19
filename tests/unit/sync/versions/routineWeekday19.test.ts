import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import type { RoutineInput } from '../../../../src/domain/training';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/**
 * PROG-04 (D-26, D-316) : appareil resté au schéma 19 (sans `routine_day.weekday`) avec un appareil au schéma 20. Le jour de la semaine posé sur
 * l'appareil à jour n'est jamais perdu par une modification faite sur l'appareil ancien ; un jour créé sur l'ancien arrive sans jour de la semaine.
 */
const NEW_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
const OLD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa19';
const u = (n: number): string => `5c1d0e2f-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
async function mixed(): Promise<{ a: SimDevice; b: SimDevice }> {
  const b = await createSimDevice(NEW_ID, { name: 'PC', schema: 'i0' });
  const a = await createSimDevice(OLD_ID, { name: 'iPhone', schema: 'v19', clock: createManualClock(b.clock.nowMs()) });
  devices = [b, a];
  await setupFirst(b);
  await b.cycle();
  await pair(b, a);
  await a.cycle();
  syncFolders(devices);
  await b.cycle();
  return { a, b };
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
const days = (d: SimDevice, columns: string) => d.driver.select(`SELECT ${columns} FROM routine_day WHERE deleted_at IS NULL ORDER BY day_order`);

describe('PROG-04 : appareil resté au schéma 19', () => {
  it('jour rattaché sur le 20, renommé sur le 19 : le nom arrive, le jour de la semaine reste ; aucun conflit', async () => {
    const { a, b } = await mixed();
    await b.data.transaction(async (r) => (await r.trainingRoutines()).create(ROUTINE));
    await roundTrip();
    expect(await days(a, 'id, name')).toEqual([{ id: u(2), name: 'Jeudi — Poussée' }]);
    await a.data.transaction(async (r) => (await r.trainingRoutines()).updateDay(u(2), { name: 'Jeudi — Poussée lourde' }));
    await roundTrip();
    expect(await days(b, 'name, weekday')).toEqual([{ name: 'Jeudi — Poussée lourde', weekday: 4 }]);
    expect((await b.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n).toBe(0);
  });

  it('jour créé sur le 19 : gardé de côté et signalé sur le 20 jusqu’à la mise à jour de l’appareil ancien (SYNC-01, ADR 0018), jamais appliqué à moitié', async () => {
    const { a, b } = await mixed();
    await a.data.transaction(async (r) => (await r.trainingRoutines()).create({ ...ROUTINE, days: ROUTINE.days.map(({ weekday: _weekday, ...d }) => d) }));
    await roundTrip();
    expect(await days(b, 'name, weekday')).toEqual([]);
    expect((await b.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_parked ORDER BY table_name')).map((r) => r.table_name)).toContain('routine_day');
  });

  it('revue sync-icloud : jour créé sur le 19, A mis à jour en 20 : la ligne republiée arrive sur B, une seule fois, sans jour de la semaine', async () => {
    const { a, b } = await mixed();
    await a.data.transaction(async (r) => (await r.trainingRoutines()).create({ ...ROUTINE, days: ROUTINE.days.map(({ weekday: _weekday, ...d }) => d) }));
    await roundTrip();
    await a.upgradeSchema('i0');
    await roundTrip(3);
    expect(await days(b, 'name, weekday')).toEqual([{ name: 'Jeudi — Poussée', weekday: null }]);
    expect(await days(a, 'name, weekday')).toEqual([{ name: 'Jeudi — Poussée', weekday: null }]);
  });

  it('revue sync-icloud : jour de la semaine changé sur le 20 pendant que l’autre est au 19 : gardé à part sur le 19, retrouvé à sa mise à jour', async () => {
    const { a, b } = await mixed();
    await b.data.transaction(async (r) => (await r.trainingRoutines()).create(ROUTINE));
    await roundTrip();
    await b.data.transaction(async (r) => (await r.trainingRoutines()).updateDay(u(2), { weekday: 5 }));
    await roundTrip();
    await a.data.transaction(async (r) => (await r.trainingRoutines()).updateDay(u(2), { name: 'Vendredi — Poussée' }));
    await roundTrip();
    expect(await days(b, 'name, weekday')).toEqual([{ name: 'Vendredi — Poussée', weekday: 5 }]);
    await a.upgradeSchema('i0');
    await roundTrip(3);
    expect(await days(a, 'name, weekday')).toEqual([{ name: 'Vendredi — Poussée', weekday: 5 }]);
  });
});

describe('revue sync-icloud (bloquant) : migration décalée entre deux appareils', () => {
  it('A passe en 20, B renomme le jour au 19 puis passe en 20 : même jour de la semaine des deux côtés, jamais deux valeurs', async () => {
    const b = await createSimDevice(NEW_ID, { name: 'PC', schema: 'v19' });
    const a = await createSimDevice(OLD_ID, { name: 'iPhone', schema: 'v19', clock: createManualClock(b.clock.nowMs()) });
    devices = [b, a];
    await setupFirst(b);
    await b.cycle();
    await pair(b, a);
    await a.cycle();
    syncFolders(devices);
    await b.cycle();
    const named = { ...ROUTINE, days: ROUTINE.days.map(({ weekday: _weekday, ...d }) => ({ ...d, name: 'Lundi — Poussée' })) };
    await b.data.transaction(async (r) => (await r.trainingRoutines()).create(named));
    await roundTrip();
    await a.upgradeSchema('i0');
    await b.data.transaction(async (r) => (await r.trainingRoutines()).updateDay(u(2), { name: 'Mardi — Poussée' }));
    await b.upgradeSchema('i0');
    await roundTrip(3);
    const onA = await days(a, 'name, weekday');
    expect(onA).toEqual(await days(b, 'name, weekday'));
    expect(onA).toEqual([{ name: 'Mardi — Poussée', weekday: null }]);
  });
});
