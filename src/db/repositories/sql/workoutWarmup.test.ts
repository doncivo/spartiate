import { afterEach, describe, expect, it } from 'vitest';
import { createHlcClock, createWriteStamper } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { createDataAccess } from '../dataAccess';
import { createSqlRepositories } from './index';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I2-03 (§ 13.8, D-72 point 11) : rampe d'échauffement insérée avant la première série de l'exercice dans la séance OUVERTE, en séries
 * `warmup` à faire (cibles seulement, aucune saisie), jamais en double ; persistée (reprise après interruption) ; jamais publiée avant la
 * clôture (D-27) ; hors tonnage, records, écarts de routine et 1RM.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e4' as DeviceId;
const u = (n: number): string => `7e2a3b4c-0000-4000-8000-${String(n).padStart(12, '0')}`;
const W = u(1);
const RAMP = [
  { loadKg: 40, reps: 8 },
  { loadKg: 60, reps: 5 },
  { loadKg: 80, reps: 2 },
];
let db: TestDb;
afterEach(async () => db.close());

async function openWithTwoExercises(): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: W, name: 'Haut A' });
  await r.addExercise(W, { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2, targetRestSec: 90 });
  await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRestSec: 150 });
}
const shape = async () =>
  ((await (await db.data.repos.workouts()).get(W))?.sets ?? []).map((s) => [s.position, s.exerciseId, s.setKind, s.targetLoadKg, s.targetRepsMin, s.targetRepsMax, s.loadKg, s.reps, s.done]);

describe('WorkoutRepository.addWarmupSets', () => {
  it('insère la rampe avant la première série de l’exercice, en séries à faire (cibles seules), positions contiguës, l’autre exercice intact', async () => {
    db = await openBaseDb(DEVICE);
    await openWithTwoExercises();
    const added = await db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(W, 'bench-press-barbell', RAMP));
    expect(added.map((s) => [s.setKind, s.targetLoadKg, s.targetRepsMin, s.targetRestSec, s.exerciseName])).toEqual([
      ['warmup', 40, 8, null, 'Développé couché'],
      ['warmup', 60, 5, null, 'Développé couché'],
      ['warmup', 80, 2, null, 'Développé couché'],
    ]);
    expect(await shape()).toEqual([
      [0, 'row-barbell', 'work', null, null, null, null, null, false],
      [1, 'row-barbell', 'work', null, null, null, null, null, false],
      [2, 'bench-press-barbell', 'warmup', 40, 8, 8, null, null, false],
      [3, 'bench-press-barbell', 'warmup', 60, 5, 5, null, null, false],
      [4, 'bench-press-barbell', 'warmup', 80, 2, 2, null, null, false],
      [5, 'bench-press-barbell', 'work', null, 8, 10, null, null, false],
      [6, 'bench-press-barbell', 'work', null, 8, 10, null, null, false],
      [7, 'bench-press-barbell', 'work', null, 8, 10, null, null, false],
    ]);
  });

  it('jamais en double : l’exercice a déjà une série d’échauffement → rien n’est ajouté ; rampe vide → rien', async () => {
    db = await openBaseDb(DEVICE);
    await openWithTwoExercises();
    await db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(W, 'bench-press-barbell', RAMP));
    const again = await db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(W, 'bench-press-barbell', RAMP));
    expect(again).toEqual([]);
    expect(await db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(W, 'row-barbell', []))).toEqual([]);
    expect((await shape()).filter((s) => s[2] === 'warmup')).toHaveLength(3);
  });

  it('persistée : relue après interruption (nouvel accès aux données sur la même base), ordre et cibles identiques', async () => {
    db = await openBaseDb(DEVICE);
    await openWithTwoExercises();
    await db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(W, 'bench-press-barbell', RAMP));
    const before = await shape();
    const reopened = createDataAccess(db.driver, createWriteStamper(db.clock, createHlcClock({ clock: db.clock, deviceId: DEVICE })), createSqlRepositories);
    const open = await (await reopened.repos.workouts()).getOpen();
    expect(open?.id).toBe(W);
    expect(open?.sets.map((s) => [s.position, s.exerciseId, s.setKind, s.targetLoadKg, s.targetRepsMin, s.targetRepsMax, s.loadKg, s.reps, s.done])).toEqual(before);
  });

  it('séance ouverte : rien en file de synchro (D-27)', async () => {
    db = await openBaseDb(DEVICE);
    await openWithTwoExercises();
    await db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(W, 'bench-press-barbell', RAMP));
    expect(await db.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);
  });

  it('refus sans écriture : exercice absent, séance inconnue ou close, valeurs hors bornes', async () => {
    db = await openBaseDb(DEVICE);
    await openWithTwoExercises();
    const r = await db.data.repos.workouts();
    await expect(db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(W, 'squat-barbell', RAMP))).rejects.toMatchObject({ code: 'not-found' });
    await expect(db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(u(99), 'bench-press-barbell', RAMP))).rejects.toMatchObject({ code: 'not-found' });
    for (const bad of [[{ loadKg: -1, reps: 8 }], [{ loadKg: 40, reps: 0 }], [{ loadKg: 40, reps: 2.5 }], [{ loadKg: 1001, reps: 2 }], [{ loadKg: Number.NaN, reps: 2 }]]) {
      await expect(db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(W, 'bench-press-barbell', bad))).rejects.toMatchObject({ code: 'invalid' });
    }
    expect((await shape()).filter((s) => s[2] === 'warmup')).toEqual([]);
    for (const s of (await r.get(W))?.sets ?? []) await r.validateSet(s.id, { reps: 8, loadKg: 60 });
    await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
    await expect(db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(W, 'bench-press-barbell', RAMP))).rejects.toMatchObject({ code: 'invalid' });
  });

  it('clôture : rampes publiées avec la séance, restées `warmup` ; hors tonnage, records et écarts de routine ; vues comme échauffement par le moteur', async () => {
    db = await openBaseDb(DEVICE);
    // Séance précédente identique au travail (50 kg × 8) : sans rampe comptée, aucun record possible.
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: u(2), name: 'Avant' });
    await r.addExercise(u(2), { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2 });
    await r.addExercise(u(2), { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 3 });
    for (const s of (await r.get(u(2)))?.sets ?? []) await r.validateSet(s.id, { reps: 8, loadKg: 50 });
    await db.data.transaction(async (repos) => (await repos.workouts()).close(u(2)));
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(86_400_000);
    await openWithTwoExercises();
    await db.data.transaction(async (repos) => (await repos.workouts()).addWarmupSets(W, 'bench-press-barbell', RAMP));
    for (const s of (await r.get(W))?.sets ?? []) {
      // Saisie pré-remplie depuis les cibles, comme le fait la ligne de série (`defaultEntry`).
      if (s.setKind === 'warmup') await r.validateSet(s.id, { reps: s.targetRepsMin, loadKg: s.targetLoadKg });
      else await r.validateSet(s.id, { reps: 8, loadKg: 50 });
    }
    const closed = await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
    // 5 séries de travail × 8 × 50 kg = 2000 kg ; les rampes (40 × 8, 60 × 5, 80 × 2 = 780 kg) n'y sont pas.
    expect(closed.summary).toMatchObject({ validatedSets: 8, validatedWorkSets: 5, plannedSets: 8, tonnageKg: 2000 });
    // La rampe à 80 kg dépasse le travail à 50 kg de la séance précédente : jamais un record.
    expect(closed.summary.records).toEqual([]);
    expect(closed.routineDiff.hasChanges).toBe(false);
    expect(await db.driver.select("SELECT COUNT(*) AS n FROM sync_outbox WHERE table_name = 'workout_set'")).toEqual([{ n: 8 }]);
    const history = await (await db.data.repos.progression()).history('bench-press-barbell');
    expect(history[0]?.sets.map((s) => [s.setKind, s.loadKg, s.reps])).toEqual([
      ['warmup', 40, 8],
      ['warmup', 60, 5],
      ['warmup', 80, 2],
      ['work', 50, 8],
      ['work', 50, 8],
      ['work', 50, 8],
    ]);
  });
});
