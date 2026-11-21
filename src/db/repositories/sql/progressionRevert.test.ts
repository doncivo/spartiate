import { afterEach, describe, expect, it } from 'vitest';
import { prescribe } from '../../../domain/training/prescribe';
import { revertDecisionPrescription } from '../../../domain/training/revertPrescription';
import type { DeviceId, IsoDateTime } from '../../../domain/types';
import { input, session } from '../../../../tests/fixtures/training/progression';
import { openBaseDb, type TestDb } from './testSetup';

/** MOTEUR-0281b (§ 11.5) : décisions d'un exercice pour le retour, marque de retour, marqueurs de séance intacts. Données SYNTHÉTIQUES. */

const DEVICE = '60000000-0000-4000-8000-0000000002b5' as DeviceId;
const HLC = `000000000000001-0000-${DEVICE}`;
const u = (n: number): string => `7a3b1c2e-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db: TestDb;
afterEach(async () => db.close());
const day = (n: number): string => new Date(Date.parse('2026-10-01T08:00:00.000Z') + n * 86_400_000).toISOString();

async function closedWorkout(id: string, endedAt: string | null): Promise<void> {
  await db.driver.execute(`INSERT INTO workout (id, name, started_at, ended_at, source, created_at, updated_at, device_id, hlc) VALUES (?, 'Séance', ?, ?, 'empty', ?, ?, ?, ?)`, [id, day(0), endedAt, day(0), day(0), DEVICE, HLC]);
  await db.driver.execute(
    `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, reps, load_kg, done, created_at, updated_at, device_id, hlc)
     VALUES (?, ?, 'bench-press-barbell', 'Nom figé', 0, 'work', 10, 60, 1, ?, ?, ?, ?)`,
    [`${id.slice(0, -3)}9${id.slice(-2)}`, id, day(0), day(0), DEVICE, HLC],
  );
}
const base = prescribe(input({ history: [session(3, 60, [10, 10, 10])] }));

describe('MOTEUR-0281b : ProgressionRepository.decisions et décision de retour', () => {
  it('décisions lisibles des séances CLOSES de l’exercice, de la plus ancienne à la plus récente ; séance ouverte et autre exercice exclus', async () => {
    db = await openBaseDb(DEVICE, day(1));
    const repo = await db.data.repos.progression();
    await closedWorkout(u(1), day(1));
    await closedWorkout(u(2), day(3));
    await closedWorkout(u(3), null);
    await repo.recordDecision({ id: u(101), exerciseId: 'bench-press-barbell', workoutId: u(1), prescription: base, accepted: true, chosenLoadKg: 60, chosenReps: [10, 10, 10] });
    db.clock.advance(86_400_000);
    await repo.recordDecision({ id: u(102), exerciseId: 'bench-press-barbell', workoutId: u(2), prescription: base, accepted: false, chosenLoadKg: 62.5, chosenReps: [8, 8, 8] });
    db.clock.advance(86_400_000);
    await repo.recordDecision({ id: u(103), exerciseId: 'bench-press-barbell', workoutId: u(3), prescription: base, accepted: true, chosenLoadKg: 65, chosenReps: [8, 8, 8] });
    await repo.recordDecision({ id: u(104), exerciseId: 'row-barbell', workoutId: u(2), prescription: base, accepted: true, chosenLoadKg: 50, chosenReps: [8] });
    const list = await repo.decisions('bench-press-barbell');
    expect(list.map((d) => d.id)).toEqual([u(101), u(102)]);
    expect(list.every((d) => d.revert !== true)).toBe(true);
  });

  it('décision de retour : marquée `revert`, référence du moteur, sans effacer le marqueur de deload de la séance', async () => {
    db = await openBaseDb(DEVICE, day(1));
    const repo = await db.data.repos.progression();
    await closedWorkout(u(1), day(1));
    const deload = prescribe(input({ history: [session(3, 60, [10, 10, 10])], deload: true }));
    await repo.recordDecision({ id: u(201), exerciseId: 'bench-press-barbell', workoutId: u(1), prescription: deload, accepted: true, chosenLoadKg: deload.loadKg, chosenReps: deload.sets.map((s) => s.reps) });
    expect((await repo.history('bench-press-barbell'))[0]?.deload).toBe(true);
    db.clock.advance(86_400_000);
    const revert = revertDecisionPrescription({ loadKg: 55, reps: [10, 10, 10], decidedAt: day(0) as IsoDateTime }, 'load-reps');
    await repo.recordDecision({ id: u(202), exerciseId: 'bench-press-barbell', workoutId: u(1), prescription: revert, accepted: false, chosenLoadKg: 55, chosenReps: [10, 10, 10] });
    const last = await repo.lastDecision('bench-press-barbell');
    expect(last).toMatchObject({ id: u(202), revert: true, loadKg: 55 });
    expect((await repo.history('bench-press-barbell'))[0]?.deload).toBe(true);
    expect((await repo.decisions('bench-press-barbell')).map((d) => [d.id, d.revert === true])).toEqual([
      [u(201), false],
      [u(202), true],
    ]);
    // Rien n'est effacé : les deux décisions restent, publiables avec leur séance close (D-27).
    expect((await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM recommendation_decision WHERE deleted_at IS NULL'))[0]?.n).toBe(2);
  });

  it('revue : la décision de retour n’est pas la valeur retenue de la séance close (decisionFor l’ignore) et entre dans la boîte d’envoi (D-27)', async () => {
    db = await openBaseDb(DEVICE, day(1));
    const repo = await db.data.repos.progression();
    await closedWorkout(u(1), day(1));
    await repo.recordDecision({ id: u(301), exerciseId: 'bench-press-barbell', workoutId: u(1), prescription: base, accepted: true, chosenLoadKg: 62.5, chosenReps: [8, 8, 8] });
    db.clock.advance(86_400_000);
    const revert = revertDecisionPrescription({ loadKg: 60, reps: [10, 10, 10], decidedAt: day(0) as IsoDateTime }, 'load-reps');
    await repo.recordDecision({ id: u(302), exerciseId: 'bench-press-barbell', workoutId: u(1), prescription: revert, accepted: false, chosenLoadKg: 60, chosenReps: [10, 10, 10] });
    expect((await repo.decisionFor(u(1), 'bench-press-barbell'))?.id).toBe(u(301));
    const sent = await db.driver.select<{ row_id: string }>("SELECT DISTINCT row_id FROM sync_outbox WHERE table_name = 'recommendation_decision'");
    expect(sent.map((r) => r.row_id)).toContain(u(302));
  });
});
