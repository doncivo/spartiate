import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * SYNC-0291 (BL-109, D-447) : `ExerciseExclusionRepository` (table publiée `exercise_exclusion`, migration 0021), identifiant naturel
 * `exclusion|<exercice>`. Un geste = une ligne (jamais la liste entière). Reprise unique du réglage local `training.excludedExercises` :
 * sans perte, idempotente, jamais au-dessus d'une ligne existante (vivante ou supprimée), réglage remis à null.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000fc' as DeviceId;
let db: TestDb;
afterEach(async () => db.close());
const repo = async () => db.data.repos.exerciseExclusions();
const outbox = () => db.driver.select<{ row_id: string; field: string }>("SELECT row_id, field FROM sync_outbox WHERE table_name = 'exercise_exclusion' ORDER BY seq");

describe('ExerciseExclusionRepository', () => {
  it('setExcluded : une ligne exclusion|<id> publiée en ligne entière ; déjà écarté : aucune écriture ; liste triée', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    await (await repo()).setExcluded('squat-barbell', true);
    db.clock.advance(1_000);
    await (await repo()).setExcluded('bench-press-barbell', true);
    expect(await (await repo()).list()).toEqual(['bench-press-barbell', 'squat-barbell']);
    expect(await outbox()).toEqual([
      { row_id: 'exclusion|squat-barbell', field: '*' },
      { row_id: 'exclusion|bench-press-barbell', field: '*' },
    ]);
    await db.driver.execute('DELETE FROM sync_outbox');
    await (await repo()).setExcluded('squat-barbell', true);
    expect(await outbox()).toEqual([]);
  });

  it('remettre : suppression logique (deleted_at publié) ; écarter de nouveau : ligne rétablie ; identifiant invalide refusé sans écriture', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    await (await repo()).setExcluded('squat-barbell', true);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    await (await repo()).setExcluded('squat-barbell', false);
    expect(await (await repo()).list()).toEqual([]);
    expect(await outbox()).toEqual([{ row_id: 'exclusion|squat-barbell', field: 'deleted_at' }]);
    await (await repo()).setExcluded('squat-barbell', false);
    await (await repo()).setExcluded('inconnu', false);
    expect(await outbox()).toEqual([{ row_id: 'exclusion|squat-barbell', field: 'deleted_at' }]);
    db.clock.advance(1_000);
    await (await repo()).setExcluded('squat-barbell', true);
    expect(await (await repo()).list()).toEqual(['squat-barbell']);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM exercise_exclusion')).toEqual([{ n: 1 }]);
    for (const bad of ['', 'a|b', 'x'.repeat(119)]) await expect((await repo()).setExcluded(bad, true), bad).rejects.toThrow();
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM exercise_exclusion')).toEqual([{ n: 1 }]);
  });

  it('importLocal : insère les seuls identifiants sans ligne (vivante ou supprimée), ignore les invalides, idempotent', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    await (await repo()).setExcluded('row-cable', true);
    await (await repo()).setExcluded('lunge-dumbbell', true);
    await (await repo()).setExcluded('lunge-dumbbell', false);
    expect(await (await repo()).importLocal(['squat-barbell', 'row-cable', 'lunge-dumbbell', 'a|b', '', 'squat-barbell'])).toEqual({ inserted: 1, failed: 2 });
    expect(await (await repo()).list()).toEqual(['row-cable', 'squat-barbell']);
    expect(await (await repo()).importLocal(['squat-barbell', 'row-cable'])).toEqual({ inserted: 0, failed: 0 });
  });

  it('relecture 1, point 2 : deux reprises concurrentes : aucune erreur, aucun doublon', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    const results = await Promise.all([(await repo()).importLocal(['squat-barbell', 'row-cable']), (await repo()).importLocal(['squat-barbell', 'row-cable'])]);
    expect(results.map((r) => r.failed)).toEqual([0, 0]);
    expect(results.reduce((n, r) => n + r.inserted, 0)).toBe(2);
    expect(await (await repo()).list()).toEqual(['row-cable', 'squat-barbell']);
  });
});
