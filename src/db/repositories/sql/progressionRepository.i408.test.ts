import { afterEach, describe, expect, it } from 'vitest';
import { prescribe } from '../../../domain/training/prescribe';
import type { DeviceId } from '../../../domain/types';
import { input, session, target } from '../../../../tests/fixtures/training/progression';
import { openBaseDb, type TestDb } from './testSetup';

/** I4-08 (0.9.1) : lecture des décisions tracées par le repository (choix de fatigue, RIR cible, décision illisible). */

const DEVICE = '60000000-0000-4000-8000-0000000000f6' as DeviceId;
const HLC = `000000000000001-0000-${DEVICE}`;
const u = (n: number): string => `7a3b1c2e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const day = (n: number): string => new Date(Date.parse('2026-10-01T08:00:00.000Z') + n * 86_400_000).toISOString();
const EX = 'bench-press-barbell';
let db: TestDb;
afterEach(async () => db.close());

/** Séance close `u(n)` : séries de travail faites `u(n * 100 + i)` à `loadKg`. */
async function closedWorkout(n: number, endedAt: string, loadKg: number, reps: readonly number[]): Promise<void> {
  await db.driver.execute(`INSERT INTO workout (id, name, started_at, ended_at, source, created_at, updated_at, device_id, hlc) VALUES (?, 'Séance', ?, ?, 'empty', ?, ?, ?, ?)`, [
    u(n),
    endedAt,
    endedAt,
    day(0),
    day(0),
    DEVICE,
    HLC,
  ]);
  for (const [i, r] of reps.entries()) {
    await db.driver.execute(
      `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, reps, load_kg, done, created_at, updated_at, device_id, hlc)
       VALUES (?, ?, ?, 'Nom figé', ?, 'work', ?, ?, 1, ?, ?, ?, ?)`,
      [u(n * 100 + i), u(n), EX, i, r, loadKg, day(0), day(0), DEVICE, HLC],
    );
  }
}
const repo = () => db.data.repos.progression();

describe('I4-08 point 1 : séance dont la décision a retenu un choix de fatigue', () => {
  it('« −2 reps » ou « −5 % » retenus : séance marquée `fatigueChoice` ; acceptation, modification libre ou refus : non marquée', async () => {
    db = await openBaseDb(DEVICE);
    const fatigued = prescribe(input({ history: [session(6, 60, [10, 10, 10]), session(4, 60, [7, 7, 7])], target: target(8, 12) }));
    const reps = fatigued.options?.find((o) => o.kind === 'fatigue-reps');
    const load = fatigued.options?.find((o) => o.kind === 'fatigue-load');
    expect(reps?.reps).toEqual([5, 5, 5]);
    expect(load?.loadKg).toBeTypeOf('number');
    const r = await repo();
    const cases = [
      { n: 1, accepted: false, chosenLoadKg: 60, chosenReps: [5, 5, 5], marked: true },
      { n: 2, accepted: false, chosenLoadKg: load?.loadKg ?? 0, chosenReps: [...(load?.reps ?? [])], marked: true },
      { n: 3, accepted: true, chosenLoadKg: 60, chosenReps: [7, 7, 7], marked: false },
      { n: 4, accepted: false, chosenLoadKg: 60, chosenReps: [6, 6, 6], marked: false },
      { n: 5, accepted: false, chosenLoadKg: null, chosenReps: [], marked: false },
    ];
    for (const [i, c] of cases.entries()) {
      await closedWorkout(c.n, day(10 + i), c.chosenLoadKg ?? 60, c.chosenReps.length > 0 ? c.chosenReps : [7, 7, 7]);
      await r.recordDecision({ exerciseId: EX, workoutId: u(c.n), prescription: fatigued, accepted: c.accepted, chosenLoadKg: c.chosenLoadKg, chosenReps: c.chosenReps });
    }
    const history = await r.history(EX);
    for (const c of cases) expect([c.n, history.find((s) => s.workoutId === u(c.n))?.fatigueChoice === true]).toEqual([c.n, c.marked]);
  });
});

describe('I4-08 point 6 : décision illisible ignorée et journalisée par un nom fixe', () => {
  async function corrupt(id: string, workoutId: string, decidedAt: string, prescription: string, chosenReps: string): Promise<void> {
    await db.driver.execute(
      `INSERT INTO recommendation_decision (id, exercise_id, workout_id, workout_set_id, engine_version, prescription, reasons, accepted, chosen_load_kg, chosen_reps,
         decided_at, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, NULL, 3, ?, '[]', 0, 61, ?, ?, ?, ?, ?, ?)`,
      [id, EX, workoutId, prescription, chosenReps, decidedAt, decidedAt, decidedAt, DEVICE, HLC],
    );
  }

  it('lastDecision, decisionFor, history et applyClosedWorkout : la ligne illisible est sautée (la précédente lisible sert), rien ne lève ; événement fixe sans contenu', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await closedWorkout(1, day(1), 60, [8, 8, 8]);
    const readable = await r.recordDecision({ exerciseId: EX, workoutId: u(1), prescription: prescribe(input()), accepted: false, chosenLoadKg: 60, chosenReps: [8, 8, 8] });
    await closedWorkout(2, day(2), 60, [8, 8, 8]);
    await corrupt(u(902), u(2), day(3), '{"loadKg": 61, tronqué', '[8,8,8]');
    await closedWorkout(3, day(4), 60, [8, 8, 8]);
    await corrupt(u(903), u(3), day(5), JSON.stringify(prescribe(input())), 'pas du JSON');
    const events: string[] = [];
    const report = (event: string): void => {
      events.push(event);
    };
    expect((await r.lastDecision(EX, report))?.id).toBe(readable.id);
    expect(await r.decisionFor(u(2), EX, report)).toBeNull();
    expect(await r.decisionFor(u(3), EX, report)).toBeNull();
    expect((await r.decisionFor(u(1), EX, report))?.id).toBe(readable.id);
    expect((await r.history(EX)).map((s) => s.workoutId)).toEqual([u(3), u(2), u(1)]);
    await expect(r.applyClosedWorkout(u(2))).resolves.toBeUndefined();
    expect(events.length).toBeGreaterThan(0);
    expect(new Set(events)).toEqual(new Set(['progression-decision-unreadable']));
  });

  it('sans rapporteur : la lecture ignore la ligne sans lever', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await closedWorkout(1, day(1), 60, [8, 8, 8]);
    await corrupt(u(901), u(1), day(2), 'null', '[8]');
    expect(await r.lastDecision(EX)).toBeNull();
    expect(await r.decisionFor(u(1), EX)).toBeNull();
  });
});
