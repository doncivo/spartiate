import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-03 (§ 13.8) : circuits dans la séance OUVERTE (`groupExercises`, `ungroupCircuit`) et rejeu d'une séance close (copie qui garde les groupes).
 * Les colonnes `circuit_id` et `circuit_rest_sec` (migration 0013) ne sont jamais capturées tant que la séance est ouverte (D-27).
 */
const DEVICE = '60000000-0000-4000-8000-0000000000d7' as DeviceId;
const u = (n: number): string => `7d1f2a3b-0000-4000-8000-${String(n).padStart(12, '0')}`;
const W = u(1);
let db: TestDb;
afterEach(async () => db.close());

async function open(): Promise<void> {
  db = await openBaseDb(DEVICE);
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: W, name: 'Haut A' });
  await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  await r.addExercise(W, { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2, targetRepsMin: 8, targetRepsMax: 10 });
  await r.addExercise(W, { exerciseId: 'plank', exerciseName: 'Gainage', sets: 1 });
}
const sets = async (id = W) => (await (await db.data.repos.workouts()).get(id))?.sets ?? [];
const shape = async (id = W) => (await sets(id)).map((s) => `${s.exerciseId}:${s.circuitId ?? '-'}`);
const group = (input: Parameters<Awaited<ReturnType<TestDb['data']['repos']['workouts']>>['groupExercises']>[1]) => db.data.transaction(async (repos) => (await repos.workouts()).groupExercises(W, input));

describe('WorkoutRepository.groupExercises', () => {
  it('regroupe deux exercices : tours alignés, ordre alterné, repos du groupe, groupe commun à toutes leurs séries', async () => {
    await open();
    const next = await group({ exerciseIds: ['bench-press-barbell', 'row-barbell'], restBetweenSec: 15, restRoundSec: 90 });
    const id = next.sets[0]?.circuitId as string;
    expect(id).toMatch(/\S/);
    expect(next.sets.map((s) => s.exerciseId)).toEqual(['bench-press-barbell', 'row-barbell', 'bench-press-barbell', 'row-barbell', 'bench-press-barbell', 'row-barbell', 'plank']);
    expect(next.sets.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(next.sets.slice(0, 6).every((s) => s.circuitId === id && s.circuitRestSec === 15 && s.targetRestSec === 90)).toBe(true);
    expect(next.sets[6]?.circuitId ?? null).toBeNull();
    expect(await db.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('workout', 'workout_set')")).toEqual([]);
  });

  it('nombre de tours : complète les séries manquantes avec les cibles de l’exercice', async () => {
    await open();
    const next = await group({ exerciseIds: ['bench-press-barbell', 'row-barbell'], rounds: 4, restBetweenSec: 0, restRoundSec: null });
    const bench = next.sets.filter((s) => s.exerciseId === 'bench-press-barbell');
    const row = next.sets.filter((s) => s.exerciseId === 'row-barbell');
    expect([bench.length, row.length]).toEqual([4, 4]);
    expect(row.at(-1)).toMatchObject({ targetRepsMin: 8, targetRepsMax: 10, done: false, reps: null });
  });

  it('nombre de tours inférieur : retire les séries à faire en trop, jamais une série validée', async () => {
    await open();
    const r = await db.data.repos.workouts();
    const next = await group({ exerciseIds: ['bench-press-barbell', 'row-barbell'], rounds: 2, restBetweenSec: 0, restRoundSec: null });
    expect(next.sets.filter((s) => s.exerciseId === 'bench-press-barbell')).toHaveLength(2);
    for (const s of next.sets.filter((x) => x.exerciseId === 'bench-press-barbell')) await r.validateSet(s.id, { reps: 8, loadKg: 60 });
    await r.ungroupCircuit(W, next.sets[0]?.circuitId as string);
    const before = await shape();
    await expect(group({ exerciseIds: ['bench-press-barbell', 'row-barbell'], rounds: 1, restBetweenSec: 0, restRoundSec: null })).rejects.toMatchObject({ code: 'invalid' });
    expect(await shape()).toEqual(before);
    expect((await sets()).filter((s) => s.done)).toHaveLength(2);
  });

  it('refus : un seul exercice, doublon, exercice absent, repos hors bornes, déjà groupé, séance close ou inconnue ; rien n’est écrit', async () => {
    await open();
    const before = await shape();
    const bad = { restBetweenSec: 0, restRoundSec: null };
    await expect(group({ ...bad, exerciseIds: ['plank'] })).rejects.toMatchObject({ code: 'invalid' });
    await expect(group({ ...bad, exerciseIds: ['plank', 'plank'] })).rejects.toMatchObject({ code: 'invalid' });
    await expect(group({ ...bad, exerciseIds: ['plank', 'squat-barbell'] })).rejects.toMatchObject({ code: 'invalid' });
    await expect(group({ exerciseIds: ['plank', 'row-barbell'], restBetweenSec: 3601, restRoundSec: null })).rejects.toMatchObject({ code: 'invalid' });
    expect(await shape()).toEqual(before);
    await group({ ...bad, exerciseIds: ['bench-press-barbell', 'row-barbell'] });
    await expect(group({ ...bad, exerciseIds: ['row-barbell', 'plank'] })).rejects.toMatchObject({ code: 'conflict' });
    const r = await db.data.repos.workouts();
    await expect(r.groupExercises(u(99), { ...bad, exerciseIds: ['a', 'b'] })).rejects.toMatchObject({ code: 'not-found' });
    for (const s of await sets()) await r.validateSet(s.id, { reps: 8, loadKg: 60, durationSec: 30 });
    await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
    await expect(r.groupExercises(W, { ...bad, exerciseIds: ['plank', 'row-barbell'] })).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('WorkoutRepository.ungroupCircuit et retraits', () => {
  it('défaire le groupe : colonnes effacées, séries de chaque exercice de nouveau voisines', async () => {
    await open();
    const next = await group({ exerciseIds: ['bench-press-barbell', 'row-barbell'], restBetweenSec: 0, restRoundSec: null });
    const r = await db.data.repos.workouts();
    await r.ungroupCircuit(W, next.sets[0]?.circuitId as string);
    expect(await shape()).toEqual(['bench-press-barbell:-', 'bench-press-barbell:-', 'bench-press-barbell:-', 'row-barbell:-', 'row-barbell:-', 'row-barbell:-', 'plank:-']);
    expect((await sets()).every((s) => s.circuitRestSec === null || s.circuitRestSec === undefined)).toBe(true);
    await expect(r.ungroupCircuit(W, 'inconnu')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('retirer un exercice d’un superset dissout le groupe ; d’un triset, il reste un groupe de deux', async () => {
    await open();
    const r = await db.data.repos.workouts();
    await group({ exerciseIds: ['bench-press-barbell', 'row-barbell', 'plank'], restBetweenSec: 0, restRoundSec: null });
    await db.data.transaction(async (repos) => (await repos.workouts()).removeExercise(W, 'plank'));
    expect((await sets()).every((s) => s.circuitId !== null && s.circuitId !== undefined)).toBe(true);
    await db.data.transaction(async (repos) => (await repos.workouts()).removeExercise(W, 'row-barbell'));
    expect((await sets()).every((s) => (s.circuitId ?? null) === null)).toBe(true);
    expect((await r.get(W))?.sets.map((s) => s.position)).toEqual([0, 1, 2]);
  });

  it('ajouter une série à un exercice du groupe : elle porte le groupe et reprend sa place dans l’ordre alterné', async () => {
    await open();
    const r = await db.data.repos.workouts();
    await group({ exerciseIds: ['bench-press-barbell', 'row-barbell'], rounds: 2, restBetweenSec: 0, restRoundSec: null });
    await db.data.transaction(async (repos) => (await repos.workouts()).addSet(W, 'bench-press-barbell'));
    const now = await r.get(W);
    expect(now?.sets.map((s) => s.exerciseId)).toEqual(['bench-press-barbell', 'row-barbell', 'bench-press-barbell', 'row-barbell', 'bench-press-barbell', 'plank']);
    expect(now?.sets.filter((s) => s.exerciseId === 'bench-press-barbell').every((s) => s.circuitId !== null && s.circuitId !== undefined)).toBe(true);
  });
});

describe('clôture et rejeu', () => {
  async function closeCircuit(): Promise<string> {
    await open();
    const r = await db.data.repos.workouts();
    await group({ exerciseIds: ['bench-press-barbell', 'row-barbell'], rounds: 2, restBetweenSec: 10, restRoundSec: 75 });
    await r.removeExercise(W, 'plank');
    for (const [i, s] of (await sets()).entries()) await r.validateSet(s.id, { reps: 8 + i, loadKg: 40 + i });
    db.clock.advance(1_000);
    await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
    return W;
  }

  it('clôture : les séries closes portent le groupe et partent en ligne entière', async () => {
    await closeCircuit();
    const closed = await (await db.data.repos.workouts()).getClosed(W);
    expect(closed?.sets.every((s) => s.circuitId !== null && s.circuitId !== undefined && s.circuitRestSec === 10)).toBe(true);
    expect(await db.driver.select("SELECT COUNT(*) AS n FROM sync_outbox WHERE table_name = 'workout_set' AND field = '*'")).toEqual([{ n: 4 }]);
  });

  it('rejeu : même ordre et mêmes groupes (nouvel identifiant), charges et répétitions de la source en cibles, aucune série faite', async () => {
    await closeCircuit();
    const r = await db.data.repos.workouts();
    const source = await r.getClosed(W);
    const replay = await db.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'copy', copyFromId: W, id: u(2) }));
    expect(replay.copiedFromWorkoutId).toBe(W);
    expect(replay.endedAt).toBeNull();
    expect(replay.sets.map((s) => s.exerciseId)).toEqual(source?.sets.map((s) => s.exerciseId));
    const newId = replay.sets[0]?.circuitId as string;
    expect(newId).toMatch(/\S/);
    expect(newId).not.toBe(source?.sets[0]?.circuitId);
    expect(replay.sets.every((s) => s.circuitId === newId && s.circuitRestSec === 10 && s.targetRestSec === 75)).toBe(true);
    for (const [i, s] of replay.sets.entries()) {
      const from = source?.sets[i];
      expect(s).toMatchObject({ done: false, doneAt: null, reps: null, loadKg: null, targetRepsMin: from?.reps, targetRepsMax: from?.reps, targetLoadKg: from?.loadKg });
    }
    // La source n’est pas modifiée.
    expect((await r.getClosed(W))?.sets.map((s) => [s.reps, s.loadKg, s.done])).toEqual(source?.sets.map((s) => [s.reps, s.loadKg, s.done]));
  });
});
