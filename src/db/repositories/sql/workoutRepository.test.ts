import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../domain/clock';
import { createHlcClock, createWriteStamper } from '../../../domain/hlc';
import { restRemainingMs, resumeState, type RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { PAST, PAST_WORKOUT_ID, seedPastWorkout } from '../../../../tests/fixtures/training/workout';
import { createDataAccess } from '../dataAccess';
import { createSqlRepositories } from './index';
import { openBaseDb, type TestDb } from './testSetup';
// I1-02 : démarrage, saisie, reprise, repos et abandon d'une séance locale (D-27 : jamais publiée avant clôture).

const DEVICE = '60000000-0000-4000-8000-0000000000e3' as DeviceId;
const u = (n: number): string => `9b3a1c2e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const R = u(1);
const D1 = u(2);
const D2 = u(3);
const W1 = u(100);
const W2 = u(101);
const must = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new Error('valeur attendue');
  return value;
};
let db: TestDb;
afterEach(async () => db.close());

const line = (id: string, exerciseId: string, position: number, over: Record<string, unknown> = {}) => ({ id, exerciseId, exerciseName: `Nom ${exerciseId}`, sets: 3, repMin: 6, repMax: 10, rir: 2 as number | null, restSec: 150, position, ...over });
const routine = (): RoutineInput => ({
  id: R,
  name: 'Haut / Bas',
  mode: 'programme',
  days: [
    { id: D1, name: 'Haut A', dayOrder: 0, exercises: [line(u(4), 'bench-press-barbell', 0), line(u(5), 'row-barbell', 1, { sets: 2, restSec: 120 })] },
    { id: D2, name: 'Bas A', dayOrder: 1, exercises: [line(u(6), 'squat-barbell', 0)] },
  ],
});

const open = () => db.data.repos.workouts();

async function setup(): Promise<void> {
  db = await openBaseDb(DEVICE);
}

describe('WorkoutRepository : démarrage', () => {
  it('séance vide : ouverte, sans série, locale, getOpen la retrouve', async () => {
    await setup();
    const repo = await open();
    expect(await repo.getOpen()).toBeNull();
    const w = await repo.start({ source: 'empty', id: W1, name: 'Séance libre' });
    expect(w).toMatchObject({ id: W1, source: 'empty', endedAt: null, routineId: null, routineDayId: null, copiedFromWorkoutId: null, restTimerEndAt: null, sets: [] });
    expect(w.startedAt).toBe('2026-10-01T08:00:00.000Z');
    expect(await repo.getOpen()).toEqual(w);
    expect(await db.driver.select('SELECT * FROM sync_outbox')).toEqual([]);
  });

  it('une seule séance ouverte : un second départ est refusé (conflict) sans rien écrire', async () => {
    await setup();
    const repo = await open();
    await repo.start({ source: 'empty', id: W1 });
    await expect(repo.start({ source: 'empty', id: W2 })).rejects.toMatchObject({ code: 'conflict' });
    expect(await db.driver.select('SELECT id FROM workout')).toEqual([{ id: W1 }]);
  });

  it('depuis un jour de routine : exercices dans l’ordre, une série par « sets », cibles de la routine, références logiques, aucune charge inventée', async () => {
    await setup();
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(routine()));
    const w = await (await open()).start({ source: 'routine', routineId: R, dayId: D1 });
    expect(w).toMatchObject({ source: 'routine', routineId: R, routineDayId: D1, name: 'Haut A' });
    expect(w.sets.map((s) => [s.exerciseId, s.position, s.setKind])).toEqual([
      ['bench-press-barbell', 0, 'work'],
      ['bench-press-barbell', 1, 'work'],
      ['bench-press-barbell', 2, 'work'],
      ['row-barbell', 3, 'work'],
      ['row-barbell', 4, 'work'],
    ]);
    expect(w.sets[0]).toMatchObject({ exerciseName: 'Nom bench-press-barbell', targetRepsMin: 6, targetRepsMax: 10, targetLoadKg: null, targetRestSec: 150, reps: null, loadKg: null, rir: null, done: false, doneAt: null });
    expect(w.sets[3]).toMatchObject({ targetRestSec: 120 });
    expect(new Set(w.sets.map((s) => s.id)).size).toBe(5);
    expect(await db.driver.select('SELECT 1 FROM exercise')).toEqual([]);
  });

  it('routine ou jour absent ou supprimé : not-found, aucune séance créée', async () => {
    await setup();
    const repo = await open();
    await expect(repo.start({ source: 'routine', routineId: R, dayId: D1 })).rejects.toMatchObject({ code: 'not-found' });
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(routine()));
    await expect(repo.start({ source: 'routine', routineId: R, dayId: D2 + 'x' })).rejects.toMatchObject({ code: 'not-found' });
    await expect(repo.start({ source: 'routine', routineId: R })).rejects.toMatchObject({ code: 'invalid' });
    await (await db.data.repos.trainingRoutines()).removeDay(D1);
    await expect(repo.start({ source: 'routine', routineId: R, dayId: D1 })).rejects.toMatchObject({ code: 'not-found' });
    expect(await db.driver.select('SELECT id FROM workout')).toEqual([]);
  });

  it('copie d’une séance passée : exercices et dernières charges, séries validées seulement, aucune routine créée, passée intacte', async () => {
    await setup();
    await seedPastWorkout(db.driver);
    const before = await db.driver.select('SELECT * FROM workout_set WHERE workout_id = ? ORDER BY position', [PAST_WORKOUT_ID]);
    const w = await (await open()).start({ source: 'copy', copyFromId: PAST_WORKOUT_ID, id: W1 });
    expect(w).toMatchObject({ source: 'copy', copiedFromWorkoutId: PAST_WORKOUT_ID, routineId: null, routineDayId: null, name: PAST.name, endedAt: null });
    expect(w.sets.map((s) => [s.exerciseId, s.setKind, s.targetRepsMin, s.targetRepsMax, s.targetLoadKg])).toEqual([
      ['bench-press-barbell', 'warmup', 8, 8, 40],
      ['bench-press-barbell', 'work', 8, 8, 60],
      ['bench-press-barbell', 'work', 7, 7, 62.5],
      ['plank', 'timed', 45, 45, null],
    ]);
    expect(w.sets.every((s) => !s.done && s.reps === null && s.loadKg === null && s.doneAt === null)).toBe(true);
    expect(w.sets.every((s) => s.workoutId === W1)).toBe(true);
    expect(await db.driver.select('SELECT 1 FROM routine')).toEqual([]);
    expect(await db.driver.select('SELECT * FROM workout_set WHERE workout_id = ? ORDER BY position', [PAST_WORKOUT_ID])).toEqual(before);
  });

  it('copie impossible : source absente (not-found), sans série validée (invalid), identifiant manquant (invalid)', async () => {
    await setup();
    const repo = await open();
    await expect(repo.start({ source: 'copy', copyFromId: PAST_WORKOUT_ID })).rejects.toMatchObject({ code: 'not-found' });
    await expect(repo.start({ source: 'copy' })).rejects.toMatchObject({ code: 'invalid' });
    await seedPastWorkout(db.driver, { ...PAST, sets: PAST.sets.map((s) => ({ ...s, done: false, doneAt: null })) });
    await expect(repo.start({ source: 'copy', copyFromId: PAST_WORKOUT_ID })).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT id FROM workout WHERE ended_at IS NULL')).toEqual([]);
  });

  it('listClosed : séances closes seulement, la plus récente d’abord ; séance ouverte et supprimée exclues', async () => {
    await setup();
    const repo = await open();
    expect(await repo.listClosed()).toEqual([]);
    await seedPastWorkout(db.driver);
    await seedPastWorkout(db.driver, { ...PAST, id: W2, name: 'Bas A', sets: [], endedAt: '2026-10-28T18:00:00.000Z' as typeof PAST.endedAt });
    await repo.start({ source: 'empty', id: W1 });
    expect((await repo.listClosed()).map((w) => w.name)).toEqual(['Bas A', 'Haut A']);
    expect((await repo.listClosed(1)).map((w) => w.id)).toEqual([W2]);
    await db.driver.execute("UPDATE workout SET deleted_at = '2026-10-30T00:00:00.000Z' WHERE id = ?", [W2]);
    expect((await repo.listClosed()).map((w) => w.id)).toEqual([PAST_WORKOUT_ID]);
  });
});

describe('WorkoutRepository : séries', () => {
  it('addExercise, addSet, removeSet, removeExercise : positions contiguës, exercice déjà présent refusé', async () => {
    await setup();
    const repo = await open();
    await repo.start({ source: 'empty', id: W1 });
    await repo.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 2, targetRepsMin: 6, targetRepsMax: 10 });
    let w = await repo.addExercise(W1, { exerciseId: 'row-barbell', exerciseName: 'Rowing' });
    expect(w.sets.map((s) => [s.exerciseId, s.position])).toEqual([['bench-press-barbell', 0], ['bench-press-barbell', 1], ['row-barbell', 2]]);
    await expect(repo.addExercise(W1, { exerciseId: 'row-barbell', exerciseName: 'Rowing' })).rejects.toMatchObject({ code: 'conflict' });
    const added = await repo.addSet(W1, 'bench-press-barbell');
    expect(added).toMatchObject({ exerciseId: 'bench-press-barbell', setKind: 'work', targetRepsMin: 6, targetRepsMax: 10, done: false, position: 2 });
    w = must(await repo.getOpen());
    expect(w.sets.map((s) => [s.exerciseId, s.position])).toEqual([['bench-press-barbell', 0], ['bench-press-barbell', 1], ['bench-press-barbell', 2], ['row-barbell', 3]]);
    await repo.removeSet(must(w.sets[1]).id);
    w = must(await repo.getOpen());
    expect(w.sets.map((s) => s.position)).toEqual([0, 1, 2]);
    w = await repo.removeExercise(W1, 'bench-press-barbell');
    expect(w.sets.map((s) => [s.exerciseId, s.position])).toEqual([['row-barbell', 0]]);
    await expect(repo.addSet(W1, 'inconnu')).rejects.toMatchObject({ code: 'not-found' });
    await expect(repo.removeSet(u(999))).rejects.toMatchObject({ code: 'not-found' });
  });

  it('validateSet : écrit la série dans SQLite (transaction), done_at, sans publication', async () => {
    await setup();
    const repo = await open();
    await repo.start({ source: 'empty', id: W1 });
    const w = await repo.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 2 });
    const id = must(w.sets[0]).id;
    db.clock.advance(65_000);
    const done = await db.data.transaction(async (repos) => (await repos.workouts()).validateSet(id, { reps: 8, loadKg: 60, rir: 2 }));
    expect(done).toMatchObject({ id, done: true, reps: 8, loadKg: 60, rir: 2, setKind: 'work', doneAt: '2026-10-01T08:01:05.000Z' });
    const row = (await db.driver.select<{ done: number; reps: number; load_kg: number; set_kind: string }>('SELECT done, reps, load_kg, set_kind FROM workout_set WHERE id = ?', [id]))[0];
    expect(row).toEqual({ done: 1, reps: 8, load_kg: 60, set_kind: 'work' });
    expect(await db.driver.select('SELECT * FROM sync_outbox')).toEqual([]);
    expect(must(await repo.getOpen()).sets[1]).toMatchObject({ done: false, reps: null });
  });

  it('validateSet : saisie invalide refusée sans rien écrire ; série inachevée ou d’échauffement jamais travail réussi par défaut', async () => {
    await setup();
    const repo = await open();
    await repo.start({ source: 'empty', id: W1 });
    const w = await repo.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 2 });
    const [a, b] = w.sets;
    await expect(repo.validateSet(must(a).id, { reps: 0, loadKg: 60 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.validateSet(must(a).id, { reps: 8, rir: 9 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.validateSet(must(a).id, {})).rejects.toMatchObject({ code: 'invalid' });
    expect(must(await repo.getOpen()).sets.every((s) => !s.done && s.reps === null)).toBe(true);
    await repo.updateSet(must(b).id, { setKind: 'warmup' });
    const warm = await repo.validateSet(must(b).id, { reps: 8, loadKg: 40 });
    expect(warm).toMatchObject({ setKind: 'warmup', done: true });
    const done = await repo.updateSet(must(a).id, { reps: 8, loadKg: 60 });
    expect(done).toMatchObject({ done: false, reps: 8, loadKg: 60, doneAt: null });
    const state = resumeState(await repo.getOpen(), Date.parse('2026-10-01T08:00:00.000Z'));
    expect(state?.summary).toEqual({ validated: 1, planned: 2, validatedWork: 0, plannedWork: 1 });
  });

  it('validateSet ne remplace que les champs fournis ; unvalidateSet remet la série à faire en gardant la saisie', async () => {
    await setup();
    const repo = await open();
    await repo.start({ source: 'empty', id: W1 });
    const [a] = (await repo.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé' })).sets;
    await repo.updateSet(must(a).id, { loadKg: 60 });
    const s = await repo.validateSet(must(a).id, { reps: 8 });
    expect(s).toMatchObject({ reps: 8, loadKg: 60, done: true });
    const undone = await repo.unvalidateSet(must(a).id);
    expect(undone).toMatchObject({ done: false, doneAt: null, reps: 8, loadKg: 60 });
  });

  it('séance close (ended_at) : plus d’écriture de série (invalid)', async () => {
    await setup();
    await seedPastWorkout(db.driver);
    const repo = await open();
    await expect(repo.validateSet(must(PAST.sets[1]).id, { reps: 5, loadKg: 10 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.addSet(PAST_WORKOUT_ID, 'bench-press-barbell')).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.discard(PAST_WORKOUT_ID)).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('WorkoutRepository : reprise après cinq séries (critère 3)', () => {
  it('cinq séries validées, « redémarrage » sur la même base : séance, séries et ordre identiques, sans doublon ni perte', async () => {
    await setup();
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(routine()));
    const repo = await open();
    const started = await repo.start({ source: 'routine', routineId: R, dayId: D1 });
    const entries = [
      { reps: 8, loadKg: 60, rir: 2 },
      { reps: 8, loadKg: 60, rir: 2 },
      { reps: 7, loadKg: 60, rir: 1 },
      { reps: 10, loadKg: 50, rir: 2 },
      { reps: 9, loadKg: 50, rir: 2 },
    ];
    for (const [i, e] of entries.entries()) {
      db.clock.advance(120_000);
      await db.data.transaction(async (repos) => (await repos.workouts()).validateSet(must(started.sets[i]).id, e));
    }
    const before = await repo.getOpen();
    // Redémarrage : nouvelle horloge, nouveaux repositories, même fichier de base.
    const clock = createManualClock('2026-10-01T09:00:00.000Z');
    const reopened = createDataAccess(db.driver, createWriteStamper(clock, createHlcClock({ clock, deviceId: DEVICE })), createSqlRepositories);
    const after = await (await reopened.repos.workouts()).getOpen();
    expect(after).toEqual(before);
    expect(must(after).sets).toHaveLength(5);
    expect(new Set(must(after).sets.map((s) => s.id)).size).toBe(5);
    expect(must(after).sets.map((s) => s.position)).toEqual([0, 1, 2, 3, 4]);
    expect(must(after).sets.map((s) => [s.reps, s.loadKg, s.rir, s.done])).toEqual(entries.map((e) => [e.reps, e.loadKg, e.rir, true]));
    expect(resumeState(after, clock.nowMs())?.summary).toEqual({ validated: 5, planned: 5, validatedWork: 5, plannedWork: 5 });
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM workout')).toEqual([{ n: 1 }]);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM workout_set')).toEqual([{ n: 5 }]);
  });
});

describe('WorkoutRepository : repos (critère 4)', () => {
  it('startRest persiste la date de fin ; getRest la relit après « verrouillage » ; le reste est recalculé depuis cette date', async () => {
    await setup();
    const repo = await open();
    await repo.start({ source: 'empty', id: W1 });
    expect(await repo.getRest()).toBeNull();
    const rest = await repo.startRest({ seconds: 150 });
    expect(rest).toEqual({ workoutId: W1, endAt: '2026-10-01T08:02:30.000Z', seconds: 150 });
    expect((await db.driver.select<{ rest_timer_end_at: string; rest_timer_seconds: number }>('SELECT rest_timer_end_at, rest_timer_seconds FROM workout'))[0]).toEqual({ rest_timer_end_at: '2026-10-01T08:02:30.000Z', rest_timer_seconds: 150 });
    // Verrouillage : 40 s plus tard, nouveaux dépôts, horloge contrôlée.
    const clock = createManualClock('2026-10-01T08:00:40.000Z');
    const reopened = createDataAccess(db.driver, createWriteStamper(clock, createHlcClock({ clock, deviceId: DEVICE })), createSqlRepositories);
    const persisted = await (await reopened.repos.workouts()).getRest();
    expect(persisted).toEqual(rest);
    expect(restRemainingMs(must(persisted).endAt, clock.nowMs())).toBe(110_000);
    clock.set('2026-10-01T08:10:00.000Z');
    expect(restRemainingMs(must(await (await reopened.repos.workouts()).getRest()).endAt, clock.nowMs())).toBe(0);
  });

  it('extendRest : +30 s sur l’échéance en cours, ou depuis maintenant si elle est passée ; skipRest efface l’échéance', async () => {
    await setup();
    const repo = await open();
    await repo.start({ source: 'empty', id: W1 });
    await repo.startRest({ seconds: 90 });
    db.clock.advance(10_000);
    const extended = await repo.extendRest();
    expect(extended.endAt).toBe('2026-10-01T08:02:00.000Z');
    expect(must(await repo.getRest()).endAt).toBe('2026-10-01T08:02:00.000Z');
    db.clock.advance(600_000);
    expect((await repo.extendRest(30)).endAt).toBe('2026-10-01T08:10:40.000Z');
    await repo.skipRest();
    expect(await repo.getRest()).toBeNull();
    expect((await db.driver.select<{ rest_timer_end_at: string | null }>('SELECT rest_timer_end_at FROM workout'))[0]).toEqual({ rest_timer_end_at: null });
    await repo.skipRest();
  });

  it('durée invalide refusée ; sans séance ouverte : not-found', async () => {
    await setup();
    const repo = await open();
    await expect(repo.startRest({ seconds: 60 })).rejects.toMatchObject({ code: 'not-found' });
    await expect(repo.getRest()).resolves.toBeNull();
    await repo.start({ source: 'empty', id: W1 });
    for (const seconds of [0, -5, 1.5, 7200]) await expect(repo.startRest({ seconds })).rejects.toMatchObject({ code: 'invalid' });
    expect(await repo.getRest()).toBeNull();
  });
});

describe('WorkoutRepository : abandon', () => {
  it('discard : suppression logique de la séance ouverte et de ses séries, plus de séance ouverte, redémarrage possible', async () => {
    await setup();
    const repo = await open();
    await repo.start({ source: 'empty', id: W1 });
    await repo.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 2 });
    await repo.startRest({ seconds: 60 });
    await db.data.transaction(async (repos) => (await repos.workouts()).discard(W1));
    expect(await repo.getOpen()).toBeNull();
    expect(await repo.getRest()).toBeNull();
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM workout WHERE deleted_at IS NOT NULL')).toEqual([{ n: 1 }]);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM workout_set WHERE deleted_at IS NOT NULL')).toEqual([{ n: 2 }]);
    expect(await db.driver.select('SELECT * FROM sync_outbox')).toEqual([]);
    await repo.start({ source: 'empty', id: W2 });
    await expect(repo.discard(u(999))).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('séance ouverte : jamais publiée (D-27)', () => {
  it('aucune entrée de synchro après un parcours complet de séance', async () => {
    await setup();
    const repo = await open();
    await repo.start({ source: 'empty', id: W1 });
    const w = await repo.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 2 });
    await repo.validateSet(must(w.sets[0]).id, { reps: 8, loadKg: 60 });
    await repo.startRest({ seconds: 90 });
    await repo.extendRest();
    await repo.skipRest();
    await repo.removeSet(must(w.sets[1]).id);
    await repo.discard(W1);
    for (const t of ['sync_outbox', 'sync_field_clock', 'sync_tombstone']) expect(await db.driver.select(`SELECT * FROM ${t}`), t).toEqual([]);
  });
});
