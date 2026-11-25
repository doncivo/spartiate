import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/**
 * DATA-0293 (D-26, D-481, Q-13 B, § 11) : appareil resté au schéma 22 (0.29.2) avec un appareil au schéma 23. A écrit une séance close avec une série
 * ajoutée (`added`), une série corrigée (`corrected_from`, correction d'une séance close) et des surcharges d'exercice (`config_overrides`) ; B (22)
 * garde les données (séance, séries, profil), met les colonnes qu'il ne connaît pas dans `sync_unknown` (jamais perdues, jamais de ligne parquée),
 * ne les écrase pas par une modification de son côté, puis les réintègre en passant au schéma 23. Données synthétiques.
 */
const A_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb23';
const B_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22';
const W = '5c1d0e2f-0000-4000-8000-000000000293';

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});
async function mixed(): Promise<{ a: SimDevice; b: SimDevice }> {
  const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'v22', clock: createManualClock(a.clock.nowMs()) });
  devices = [a, b];
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders(devices);
  await a.cycle();
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
async function writeOnA(a: SimDevice): Promise<void> {
  await a.data.transaction(async (repos) => {
    const r = await repos.workouts();
    await r.start({ source: 'empty', id: W, name: 'Séance' });
    const w = await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 1, targetRepsMin: 8, targetRepsMax: 10 });
    const extra = await r.addSet(W, 'bench-press-barbell');
    for (const s of [...w.sets, extra]) await r.validateSet(s.id, { reps: 8, loadKg: 80 });
    await r.close(W);
  });
  a.clock.advance(60_000);
  await a.data.transaction(async (repos) => {
    const r = await repos.workouts();
    const [first] = (await r.getClosed(W))?.sets ?? [];
    await r.correctSet((first as { id: string }).id, { loadKg: 82.5 });
    await (await repos.progression()).saveConfigOverrides('bench-press-barbell', { deloadLoad: 0.9 });
  });
}
const sets = (d: SimDevice, columns: string) => d.driver.select(`SELECT ${columns} FROM workout_set WHERE workout_id = ? ORDER BY position`, [W]);
const unknownFields = async (d: SimDevice) => (await d.driver.select<{ table_name: string; field: string }>('SELECT table_name, field FROM sync_unknown ORDER BY table_name, field')).map((r) => `${r.table_name}.${r.field}`);

describe('DATA-0293 : appareil resté au schéma 22', () => {
  it('séance, séries et profil arrivent ; les colonnes de la 0023 sont gardées de côté, aucune ligne parquée, aucun conflit', async () => {
    const { a, b } = await mixed();
    await writeOnA(a);
    await roundTrip(3);
    expect(await sets(b, 'reps, load_kg, done')).toEqual([{ reps: 8, load_kg: 82.5, done: 1 }, { reps: 8, load_kg: 80, done: 1 }]);
    // Le profil arrive (sans la colonne inconnue) ; la surcharge est gardée dans sync_unknown, avec sa valeur.
    expect(await b.driver.select("SELECT exercise_id FROM progression_profile WHERE exercise_id = 'bench-press-barbell'")).toEqual([{ exercise_id: 'bench-press-barbell' }]);
    expect(await b.driver.select("SELECT value FROM sync_unknown WHERE table_name = 'progression_profile' AND field = 'config_overrides'")).toEqual([{ value: JSON.stringify('{"deloadLoad":0.9}') }]);
    expect(await unknownFields(b)).toEqual(expect.arrayContaining(['progression_profile.config_overrides', 'workout_set.added', 'workout_set.corrected_from', 'workout_set.distance_m']));
    expect(await b.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    expect((await b.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n).toBe(0);
  });

  it('B passe au schéma 23 : les colonnes gardées sont réintégrées (série ajoutée, valeur d’avant, surcharges), A inchangé', async () => {
    const { a, b } = await mixed();
    await writeOnA(a);
    await roundTrip(3);
    await b.upgradeSchema('i0');
    await roundTrip(3);
    expect(await sets(b, 'added, corrected_from')).toEqual([
      { added: null, corrected_from: '{"reps":8,"loadKg":80,"durationSec":null,"rir":null}' },
      { added: 1, corrected_from: null },
    ]);
    expect(await b.driver.select("SELECT config_overrides FROM progression_profile WHERE exercise_id = 'bench-press-barbell'")).toEqual([{ config_overrides: '{"deloadLoad":0.9}' }]);
    expect(await sets(a, 'added, corrected_from')).toEqual(await sets(b, 'added, corrected_from'));
    expect(await unknownFields(b)).toEqual([]);
  });

  it('B (22) recalcule le profil entre la réception et sa mise à jour : la surcharge de A est réintégrée, rien n’est écrasé, aucun conflit chez A', async () => {
    const { a, b } = await mixed();
    await writeOnA(a);
    await roundTrip(3);
    b.clock.advance(5_000);
    await b.data.transaction(async (repos) => (await repos.progression()).saveProfile({ exerciseId: 'bench-press-barbell', estimated1rmKg: 100, confidence: 0.7, lastEasyRecalibrationAt: null, engineVersion: 3 }));
    await b.upgradeSchema('i0');
    await roundTrip(3);
    const overrides = "SELECT config_overrides, estimated_1rm_kg FROM progression_profile WHERE exercise_id = 'bench-press-barbell'";
    expect(await b.driver.select(overrides)).toEqual([{ config_overrides: '{"deloadLoad":0.9}', estimated_1rm_kg: 100 }]);
    expect(await a.driver.select(overrides)).toEqual([{ config_overrides: '{"deloadLoad":0.9}', estimated_1rm_kg: 100 }]);
    expect((await a.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n).toBe(0);
    expect(await unknownFields(b)).toEqual([]);
  });
});
