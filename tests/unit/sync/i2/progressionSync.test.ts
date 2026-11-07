import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { SYNC_TABLE_ORDER } from '../../../../src/domain/sync/format';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { prescribe } from '../../../../src/domain/training/prescribe';
import type { IsoDateTime } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import { input } from '../../../fixtures/training/progression';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * I2-01 (PR 2/2, critère 14 ; D-26, D-27) : publication de `progression_profile` (identité naturelle `progression|<exercice>`) et
 * `recommendation_decision` (UUID), difficulté `workout_set.difficulty` publiée avec la séance close ; deux bases simulées, conflit, appareil
 * resté en 0.3.0 (schéma 5) qui garde ces valeurs dans `sync_unknown` puis les réintègre après sa mise à jour.
 */

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const u = (n: number): string => `4e2d1c3a-0000-4000-8000-${String(n).padStart(12, '0')}`;
const W1 = u(1);
const D1 = u(500);
const P = 'progression|bench-press-barbell';

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function twoDevices(schemaB: SimSchema = 'i0'): Promise<[SimDevice, SimDevice]> {
  const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', schema: schemaB, clock: createManualClock(a.clock.nowMs()) });
  devices = [a, b];
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders(devices);
  await a.cycle();
  return [a, b];
}

async function roundTrip(list: readonly SimDevice[] = devices): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    for (const d of list) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(list);
  }
}

/** Séance close sur `d` : 3 × 10 à 60 kg au développé couché, difficulté posée pendant la séance. */
async function closedWorkout(d: SimDevice, id: string, difficulty: 'easy' | 'ok' | 'hard' | null): Promise<void> {
  const r = await d.data.repos.workouts();
  await r.start({ source: 'empty', id, name: 'Haut A' });
  const w = await r.addExercise(id, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 3 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 10, loadKg: 60 });
  if (difficulty !== null) await r.setDifficulty(id, 'bench-press-barbell', difficulty);
  await d.data.transaction(async (repos) => (await repos.workouts()).close(id));
}
const decide = async (d: SimDevice) =>
  (await d.data.repos.progression()).recordDecision({ id: D1, exerciseId: 'bench-press-barbell', workoutId: null, prescription: prescribe(input()), accepted: false, chosenLoadKg: 57.5, chosenReps: [8, 8, 8] });
const profile = async (d: SimDevice, confidence: number) =>
  (await d.data.repos.progression()).saveProfile({ exerciseId: 'bench-press-barbell', estimated1rmKg: 80, confidence, lastEasyRecalibrationAt: null, engineVersion: 1 });

describe('catalogue de production : tables de progression (I2-01)', () => {
  it('ordre : … workout, workout_set, puis progression_profile, recommendation_decision ; aucun parent (références logiques)', () => {
    expect(SYNC_TABLE_ORDER.slice(-3)).toEqual(['workout_set', 'progression_profile', 'recommendation_decision']);
    for (const name of ['progression_profile', 'recommendation_decision']) expect(SYNC_CATALOGUE.table(name)?.parents, name).toEqual([]);
  });

  it('progression_profile : identité naturelle progression|<exercice>, sans repli UUID ; identifiant attendu tiré de exercise_id', () => {
    const t = SYNC_CATALOGUE.table('progression_profile');
    if (!t) throw new Error('progression_profile');
    expect(t.idKind).toBe('natural');
    expect(SYNC_CATALOGUE.isValidRowId(t, P)).toBe(true);
    expect(SYNC_CATALOGUE.isValidRowId(t, `progression|${u(9)}`)).toBe(true);
    for (const bad of ['progression|', 'progression', u(9), 'weight|2026-11-07|manual', 'progression|a|b']) expect(SYNC_CATALOGUE.isValidRowId(t, bad), bad).toBe(false);
    expect(t.natural?.expected(new Map([['exercise_id', 'bench-press-barbell']]))).toBe(P);
    expect(t.natural?.expected(new Map())).toBeNull();
  });

  it('recommendation_decision : UUID ; workout_set.difficulty : easy, ok, hard ou nulle', () => {
    const decision = SYNC_CATALOGUE.table('recommendation_decision');
    expect(decision?.idKind).toBe('uuid');
    const col = SYNC_CATALOGUE.column('workout_set', 'difficulty');
    if (!col) throw new Error('difficulty');
    for (const ok of ['easy', 'ok', 'hard', null]) expect(SYNC_CATALOGUE.isValidValue(col, ok)).toBe(true);
    for (const bad of ['facile', 1, '']) expect(SYNC_CATALOGUE.isValidValue(col, bad)).toBe(false);
  });
});

describe('deux appareils en 0.3.1', () => {
  it('profil et décision écrits sur le PC, séance close avec difficulté sur l’iPhone : identiques des deux côtés', async () => {
    const [a, b] = await twoDevices();
    await profile(a, 0.5);
    await decide(a);
    await closedWorkout(b, W1, 'hard');
    await roundTrip();
    for (const d of [a, b]) {
      const r = await d.data.repos.progression();
      expect(await r.getProfile('bench-press-barbell'), d.name).toMatchObject({ id: P, estimated1rmKg: 80, confidence: 0.5 });
      expect(await r.lastDecision('bench-press-barbell'), d.name).toMatchObject({ id: D1, accepted: false, loadKg: 57.5, reps: [8, 8, 8] });
      expect((await r.history('bench-press-barbell')).map((s) => s.difficulty), d.name).toEqual(['hard']);
    }
  });

  it('même profil écrit sur les deux appareils : une seule ligne, la plus récente gagne partout', async () => {
    const [a, b] = await twoDevices();
    await profile(a, 0.4);
    b.clock.advance(5_000);
    await profile(b, 0.9);
    await roundTrip();
    for (const d of [a, b]) {
      expect(await d.driver.select('SELECT id, confidence FROM progression_profile'), d.name).toEqual([{ id: P, confidence: 0.9 }]);
    }
  });

  it('difficulté corrigée sur une séance close : la correction circule', async () => {
    const [a, b] = await twoDevices();
    await closedWorkout(a, W1, 'ok');
    await roundTrip();
    a.clock.advance(1_000);
    const set = (await a.driver.select<{ id: string }>('SELECT id FROM workout_set WHERE workout_id = ? ORDER BY position LIMIT 1', [W1]))[0];
    if (!set) throw new Error('série');
    await (await a.data.repos.workouts()).correctSet(set.id, { difficulty: 'easy' });
    await roundTrip();
    expect(await b.driver.select('SELECT difficulty FROM workout_set WHERE id = ?', [set.id])).toEqual([{ difficulty: 'easy' }]);
  });
});

describe('instantané (qa-test)', () => {
  it('nouvel appareil associé après coup : profil, décision et difficulté reçus par l’instantané', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    devices = [a];
    await profile(a, 0.5);
    await decide(a);
    await closedWorkout(a, W1, 'hard');
    await setupFirst(a);
    await a.cycle();
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
    devices.push(b);
    await pair(a, b);
    await b.cycle();
    const r = await b.data.repos.progression();
    expect(await r.getProfile('bench-press-barbell')).toMatchObject({ id: P, confidence: 0.5 });
    expect(await r.lastDecision('bench-press-barbell')).toMatchObject({ id: D1, loadKg: 57.5 });
    expect((await r.history('bench-press-barbell')).map((x) => x.difficulty)).toEqual(['hard']);
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
  });
});

describe('appareil resté en 0.3.0 (schéma 5, ADR 0011 §7.2)', () => {
  it('profil, décision et difficulté reçus : gardés dans sync_unknown, séance close lisible ; réintégrés après la migration 0006', async () => {
    const [a, b] = await twoDevices('v5');
    await profile(a, 0.5);
    await decide(a);
    await closedWorkout(a, W1, 'easy');
    await roundTrip();
    // La séance close est connue du schéma 5 : appliquée ; la difficulté, les profils et les décisions attendent dans sync_unknown.
    expect(await b.driver.select('SELECT COUNT(*) AS n FROM workout_set WHERE workout_id = ?', [W1])).toEqual([{ n: 3 }]);
    expect(await b.driver.select('SELECT COUNT(*) AS n FROM progression_profile')).toEqual([{ n: 0 }]);
    const kept = await b.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name');
    expect(kept.map((r) => r.table_name)).toEqual(['progression_profile', 'recommendation_decision', 'workout_set']);
    // Mise à jour de l'app sur B : migration 0006, puis réintégration des champs gardés.
    await migrate(b.driver, migrations);
    await reintegrateUnknownFields(b.driver, { catalogue: SYNC_CATALOGUE, now: new Date(b.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await b.driver.select('SELECT DISTINCT difficulty FROM workout_set WHERE workout_id = ?', [W1])).toEqual([{ difficulty: 'easy' }]);
    expect(await b.driver.select('SELECT id, confidence FROM progression_profile')).toEqual([{ id: P, confidence: 0.5 }]);
    expect(await b.driver.select('SELECT id, chosen_load_kg FROM recommendation_decision')).toEqual([{ id: D1, chosen_load_kg: 57.5 }]);
  });
});
