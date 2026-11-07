import { afterEach, describe, expect, it } from 'vitest';
import { HISTORY_SESSIONS_LOADED } from '../../../domain/training/config';
import { prescribe } from '../../../domain/training/prescribe';
import type { DeviceId } from '../../../domain/types';
import { input, session } from '../../../../tests/fixtures/training/progression';
import { openBaseDb, type TestDb } from './testSetup';

/** I2-01 : ProgressionRepository (historique des séances closes et difficulté, profil recalculable, décisions tracées ; publiés en 0.3.1). */

const DEVICE = '60000000-0000-4000-8000-0000000000f5' as DeviceId;
const HLC = `000000000000001-0000-${DEVICE}`;
const u = (n: number): string => `7a3b1c2e-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db: TestDb;
afterEach(async () => db.close());

const day = (n: number): string => new Date(Date.parse('2026-10-01T08:00:00.000Z') + n * 86_400_000).toISOString();

async function workout(id: string, endedAt: string | null, deletedAt: string | null = null): Promise<void> {
  await db.driver.execute(`INSERT INTO workout (id, name, started_at, ended_at, source, deleted_at, created_at, updated_at, device_id, hlc) VALUES (?, 'Séance', ?, ?, 'empty', ?, ?, ?, ?, ?)`, [
    id,
    endedAt ?? day(0),
    endedAt,
    deletedAt,
    day(0),
    day(0),
    DEVICE,
    HLC,
  ]);
}
async function workSet(
  id: string,
  workoutId: string,
  position: number,
  exerciseId: string,
  loadKg: number | null,
  reps: number | null,
  over: { done?: number; kind?: string; rir?: number | null; deletedAt?: string | null; difficulty?: string | null } = {},
): Promise<void> {
  await db.driver.execute(
    `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, reps, load_kg, rir, done, deleted_at, difficulty, created_at, updated_at, device_id, hlc)
     VALUES (?, ?, ?, 'Nom figé', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, workoutId, exerciseId, position, over.kind ?? 'work', reps, loadKg, over.rir ?? null, over.done ?? 1, over.deletedAt ?? null, over.difficulty ?? null, day(0), day(0), DEVICE, HLC],
  );
}
const repo = () => db.data.repos.progression();

describe('ProgressionRepository.history', () => {
  it('séances closes de l’exercice, plus récente d’abord, séries par position ; séance ouverte, supprimée, série supprimée et autre exercice exclus', async () => {
    db = await openBaseDb(DEVICE);
    await workout(u(1), day(1));
    await workSet(u(11), u(1), 1, 'bench-press-barbell', 60, 9, { rir: 2 });
    await workSet(u(10), u(1), 0, 'bench-press-barbell', 60, 10);
    await workSet(u(12), u(1), 2, 'row-barbell', 50, 10);
    await workSet(u(13), u(1), 3, 'bench-press-barbell', 40, 8, { kind: 'warmup' });
    await workSet(u(14), u(1), 4, 'bench-press-barbell', 60, null, { done: 0 });
    await workSet(u(15), u(1), 5, 'bench-press-barbell', 70, 1, { deletedAt: day(1) });
    await workout(u(2), day(3));
    await workSet(u(20), u(2), 0, 'bench-press-barbell', 62.5, 8);
    await workout(u(3), null);
    await workSet(u(30), u(3), 0, 'bench-press-barbell', 65, 8);
    await workout(u(4), day(4), day(5));
    await workSet(u(40), u(4), 0, 'bench-press-barbell', 65, 8);
    await workout(u(5), day(6));
    await workSet(u(50), u(5), 0, 'row-barbell', 50, 10);

    const history = await (await repo()).history('bench-press-barbell');
    expect(history.map((s) => s.workoutId)).toEqual([u(2), u(1)]);
    expect(history[1]).toEqual({
      workoutId: u(1),
      endedAt: day(1),
      difficulty: null,
      sets: [
        { position: 0, setKind: 'work', done: true, reps: 10, loadKg: 60, rir: null },
        { position: 1, setKind: 'work', done: true, reps: 9, loadKg: 60, rir: 2 },
        { position: 3, setKind: 'warmup', done: true, reps: 8, loadKg: 40, rir: null },
        { position: 4, setKind: 'work', done: false, reps: null, loadKg: 60, rir: null },
      ],
    });
  });

  it('au plus HISTORY_SESSIONS_LOADED séances (les plus récentes) ; limite explicite respectée ; exercice inconnu : vide', async () => {
    db = await openBaseDb(DEVICE);
    for (let i = 0; i < HISTORY_SESSIONS_LOADED + 1; i += 1) {
      await workout(u(100 + i), day(i + 1));
      await workSet(u(200 + i), u(100 + i), 0, 'curl-dumbbell', 10, 10);
    }
    const r = await repo();
    const all = await r.history('curl-dumbbell');
    expect(all).toHaveLength(HISTORY_SESSIONS_LOADED);
    expect(all[0]?.workoutId).toBe(u(100 + HISTORY_SESSIONS_LOADED));
    expect(all.at(-1)?.workoutId).toBe(u(101));
    expect((await r.history('curl-dumbbell', 2)).map((s) => s.workoutId)).toEqual([u(100 + HISTORY_SESSIONS_LOADED), u(99 + HISTORY_SESSIONS_LOADED)]);
    expect(await r.history('inconnu')).toEqual([]);
    expect(await r.history('curl-dumbbell', 0)).toEqual([]);
  });

  it('PR 2/2 : difficulté de la séance lue sur ses séries (série la plus haute renseignée ; séries supprimées ignorées) ; aucune : null', async () => {
    db = await openBaseDb(DEVICE);
    await workout(u(1), day(1));
    await workSet(u(10), u(1), 0, 'bench-press-barbell', 60, 10, { difficulty: 'easy' });
    await workSet(u(11), u(1), 1, 'bench-press-barbell', 60, 10, { difficulty: 'hard' });
    await workSet(u(12), u(1), 2, 'bench-press-barbell', 60, 10);
    await workSet(u(13), u(1), 3, 'bench-press-barbell', 60, 10, { difficulty: 'ok', deletedAt: day(1) });
    await workout(u(2), day(2));
    await workSet(u(20), u(2), 0, 'bench-press-barbell', 60, 10);
    await workSet(u(21), u(2), 1, 'row-barbell', 50, 10, { difficulty: 'easy' });
    const history = await (await repo()).history('bench-press-barbell');
    expect(history.map((s) => [s.workoutId, s.difficulty])).toEqual([
      [u(2), null],
      [u(1), 'hard'],
    ]);
  });

  it('PR 2/2 : « Dur » lu de la base bloque la hausse de charge', async () => {
    db = await openBaseDb(DEVICE);
    await workout(u(1), day(1));
    for (let i = 0; i < 3; i += 1) await workSet(u(10 + i), u(1), i, 'bench-press-barbell', 60, 10, { difficulty: 'hard' });
    const history = await (await repo()).history('bench-press-barbell');
    const p = prescribe(input({ history, now: day(3) as never }));
    expect(p.loadKg).toBe(60);
    expect(p.reasons).toContain('hard-blocks-increase');
  });

  it('l’historique chargé alimente le moteur : 60 × 10-10-10 → 62,5 kg', async () => {
    db = await openBaseDb(DEVICE);
    await workout(u(1), day(1));
    for (let i = 0; i < 3; i += 1) await workSet(u(10 + i), u(1), i, 'bench-press-barbell', 60, 10);
    const history = await (await repo()).history('bench-press-barbell');
    expect(prescribe(input({ history, now: day(3) as never })).loadKg).toBe(62.5);
  });
});

describe('ProgressionRepository : profil', () => {
  it('absent : null ; enregistré puis remplacé, une seule ligne progression|<exercice>, capturée pour la synchro (0.3.1)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    expect(await r.getProfile('bench-press-barbell')).toBeNull();
    const first = await r.saveProfile({ exerciseId: 'bench-press-barbell', estimated1rmKg: 80, confidence: 0.5, lastEasyRecalibrationAt: null, engineVersion: 1 });
    expect(first).toMatchObject({ id: 'progression|bench-press-barbell', exerciseId: 'bench-press-barbell', estimated1rmKg: 80, confidence: 0.5, lastEasyRecalibrationAt: null, engineVersion: 1, deletedAt: null, deviceId: DEVICE });
    db.clock.advance(1000);
    const second = await r.saveProfile({ exerciseId: 'bench-press-barbell', estimated1rmKg: 84, confidence: 0.8, lastEasyRecalibrationAt: '2026-10-01T08:00:01.000Z' as never, engineVersion: 1 });
    expect(second).toMatchObject({ estimated1rmKg: 84, confidence: 0.8, lastEasyRecalibrationAt: '2026-10-01T08:00:01.000Z', createdAt: first.createdAt });
    expect(second.updatedAt > first.updatedAt).toBe(true);
    expect(await r.getProfile('bench-press-barbell')).toEqual(second);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM progression_profile')).toEqual([{ n: 1 }]);
    expect(await db.driver.select("SELECT DISTINCT table_name, row_id FROM sync_outbox WHERE field = '*'")).toEqual([{ table_name: 'progression_profile', row_id: 'progression|bench-press-barbell' }]);
  });

  it('valeurs hors bornes refusées (invalid), rien n’est écrit', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const ok = { exerciseId: 'bench-press-barbell', estimated1rmKg: 80, confidence: 0.5, lastEasyRecalibrationAt: null, engineVersion: 1 };
    for (const bad of [{ confidence: 1.2 }, { confidence: Number.NaN }, { estimated1rmKg: 0 }, { estimated1rmKg: Number.POSITIVE_INFINITY }, { engineVersion: 0 }, { exerciseId: '' }, { lastEasyRecalibrationAt: 'hier' as never }]) {
      await expect(r.saveProfile({ ...ok, ...bad })).rejects.toMatchObject({ code: 'invalid' });
    }
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM progression_profile')).toEqual([{ n: 0 }]);
  });
});

describe('ProgressionRepository : décisions', () => {
  it('acceptation puis modification tracées ; la dernière (date, puis identifiant) d’une séance CLOSE sert de référence ; capturées (0.3.1)', async () => {
    db = await openBaseDb(DEVICE);
    await workout(u(1), day(1));
    const r = await repo();
    expect(await r.lastDecision('bench-press-barbell')).toBeNull();
    const prescription = prescribe(input());
    const accepted = await r.recordDecision({ id: u(900), exerciseId: 'bench-press-barbell', workoutId: u(1), prescription, accepted: true, chosenLoadKg: null, chosenReps: [8, 8, 8] });
    expect(accepted).toMatchObject({ id: u(900), accepted: true, loadKg: null, reps: [8, 8, 8], engineVersion: 1, workoutId: u(1), workoutSetId: null, decidedAt: '2026-10-01T08:00:00.000Z' });
    expect(accepted.prescription).toEqual(prescription);
    db.clock.advance(1000);
    const manual = await r.recordDecision({ exerciseId: 'bench-press-barbell', workoutId: u(1), workoutSetId: null, prescription, accepted: false, chosenLoadKg: 57.5, chosenReps: [8, 8, 8] });
    expect(manual.id).toMatch(/^[0-9a-f-]{36}$/);
    const last = await r.lastDecision('bench-press-barbell');
    expect(last).toEqual(manual);
    expect(last).toMatchObject({ accepted: false, loadKg: 57.5, decidedAt: '2026-10-01T08:00:01.000Z' });
    expect(await r.lastDecision('row-barbell')).toBeNull();
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recommendation_decision')).toEqual([{ n: 2 }]);
    expect(await db.driver.select("SELECT table_name, field FROM sync_outbox WHERE table_name = 'recommendation_decision'")).toEqual([
      { table_name: 'recommendation_decision', field: '*' },
      { table_name: 'recommendation_decision', field: '*' },
    ]);
  });

  it('revue #61 (D-27) : décision d’une séance ouverte, supprimée ou sans séance : jamais référence ; ouverte ou sans séance : jamais capturée ; decisionFor la rend pour sa séance ; discard l’efface', async () => {
    db = await openBaseDb(DEVICE);
    await workout(u(1), day(1));
    await workout(u(2), day(2), day(3));
    const r = await repo();
    const prescription = prescribe(input());
    const base = { exerciseId: 'bench-press-barbell', prescription, accepted: false, chosenLoadKg: 60, chosenReps: [8] };
    await r.recordDecision({ ...base, id: u(901), workoutId: u(1) });
    db.clock.advance(1000);
    await r.recordDecision({ ...base, id: u(902), workoutId: u(2) });
    await r.recordDecision({ ...base, id: u(903), workoutId: null });
    const w = await db.data.repos.workouts();
    await w.start({ source: 'empty', id: u(3), name: 'Ouverte' });
    await w.addExercise(u(3), { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 1 });
    await r.recordDecision({ ...base, id: u(904), workoutId: u(3) });
    expect((await r.lastDecision('bench-press-barbell'))?.id).toBe(u(901));
    expect((await r.decisionFor(u(3), 'bench-press-barbell'))?.id).toBe(u(904));
    expect(await r.decisionFor(u(3), 'row-barbell')).toBeNull();
    expect((await db.driver.select<{ row_id: string }>("SELECT row_id FROM sync_outbox WHERE table_name = 'recommendation_decision'")).map((x) => x.row_id).sort()).toEqual([u(901), u(902)]);
    await w.discard(u(3));
    expect(await r.decisionFor(u(3), 'bench-press-barbell')).toBeNull();
    expect(await db.driver.select('SELECT id FROM recommendation_decision WHERE workout_id = ?', [u(3)])).toEqual([]);
  });

  it('revue #61 (B) : recalibrage « Facile » consigné à la clôture seulement, si la charge retenue est au moins la charge recalée', async () => {
    db = await openBaseDb(DEVICE);
    // Sous le haut de la fourchette : au haut, le cran l'emporte sur le recalibrage (relecture de la PR #60, I2).
    const easy = prescribe(input({ history: [session(3, 60, [8, 8, 8], { difficulty: 'easy' })] }));
    expect(easy.recalibration).not.toBeNull();
    const w = await db.data.repos.workouts();
    const r = await repo();
    for (const [id, chosen] of [[u(10), easy.loadKg], [u(11), (easy.loadKg ?? 0) - 2.5]] as const) {
      await w.start({ source: 'empty', id, name: 'Séance' });
      const opened = await w.addExercise(id, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 1 });
      await r.recordDecision({ exerciseId: 'bench-press-barbell', workoutId: id, prescription: easy, accepted: chosen === easy.loadKg, chosenLoadKg: chosen, chosenReps: [8] });
      // Séance ouverte : rien n'est consigné ; une séance ouverte refuse la consignation.
      await expect(r.applyClosedWorkout(id)).rejects.toMatchObject({ code: 'invalid' });
      expect(await r.getProfile('bench-press-barbell')).toBeNull();
      for (const s of opened.sets) await w.validateSet(s.id, { reps: 8, loadKg: chosen ?? 0 });
      await db.data.transaction(async (repos) => (await repos.workouts()).close(id));
      await r.applyClosedWorkout(id);
      if (id === u(10)) {
        expect(await r.getProfile('bench-press-barbell')).toMatchObject({ lastEasyRecalibrationAt: easy.recalibration?.at, estimated1rmKg: easy.recalibration?.estimated1rmKg });
        await db.driver.execute('DELETE FROM progression_profile');
      } else expect(await r.getProfile('bench-press-barbell')).toBeNull();
      db.clock.advance(1000);
    }
  });

  it('re-relecture sync-icloud : prescription stockée invalide (confiance hors bornes) → la séance se clôture quand même, profil non écrit', async () => {
    db = await openBaseDb(DEVICE);
    const easy = prescribe(input({ history: [session(3, 60, [10, 10, 10], { difficulty: 'easy' })] }));
    const w = await db.data.repos.workouts();
    await w.start({ source: 'empty', id: u(20), name: 'Séance' });
    const opened = await w.addExercise(u(20), { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 1 });
    await (await repo()).recordDecision({ exerciseId: 'bench-press-barbell', workoutId: u(20), prescription: { ...easy, confidence: 1.5 }, accepted: true, chosenLoadKg: easy.loadKg, chosenReps: [8] });
    for (const s of opened.sets) await w.validateSet(s.id, { reps: 8, loadKg: 60 });
    await db.data.transaction(async (repos) => {
      await (await repos.workouts()).close(u(20));
      await (await repos.progression()).applyClosedWorkout(u(20));
    });
    expect(await db.driver.select('SELECT ended_at IS NOT NULL AS closed FROM workout WHERE id = ?', [u(20)])).toEqual([{ closed: 1 }]);
    expect(await (await repo()).getProfile('bench-press-barbell')).toBeNull();
  });

  it('relecture sync-icloud R1 : identifiant d’exercice d’un profil borné à 116 caractères (progression|… ≤ 128)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const ok = { estimated1rmKg: 80, confidence: 0.5, lastEasyRecalibrationAt: null, engineVersion: 1 };
    await r.saveProfile({ ...ok, exerciseId: 'x'.repeat(116) });
    await expect(r.saveProfile({ ...ok, exerciseId: 'x'.repeat(117) })).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.saveProfile({ ...ok, exerciseId: 'a|b' })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('PR 2/2 : refus tracé sans valeur (accepted = 0, charge nulle, aucune répétition) ; des répétitions sans charge restent admises', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const refused = await r.recordDecision({ exerciseId: 'bench-press-barbell', workoutId: u(1), prescription: prescribe(input()), accepted: false, chosenLoadKg: null, chosenReps: [] });
    expect(refused).toMatchObject({ accepted: false, loadKg: null, reps: [] });
    await expect(r.recordDecision({ exerciseId: 'bench-press-barbell', workoutId: u(1), prescription: prescribe(input()), accepted: true, chosenLoadKg: null, chosenReps: [] })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('saisie invalide refusée : reps non entières ou vides, charge négative, exercice vide', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const ok = { exerciseId: 'bench-press-barbell', workoutId: null, prescription: prescribe(input()), accepted: false, chosenLoadKg: 60, chosenReps: [8] };
    for (const bad of [{ chosenReps: [] }, { chosenReps: [8.5] }, { chosenReps: [0] }, { chosenLoadKg: -1 }, { chosenLoadKg: Number.NaN }, { exerciseId: '' }]) {
      await expect(r.recordDecision({ ...ok, ...bad })).rejects.toMatchObject({ code: 'invalid' });
    }
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recommendation_decision')).toEqual([{ n: 0 }]);
  });
});
