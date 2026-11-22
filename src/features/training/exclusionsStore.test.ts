import { afterEach, describe, expect, it } from 'vitest';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import type { DeviceId } from '../../domain/types';
import { loadExcludedExercises, writeExcluded } from './exclusionsStore';

/** SYNC-0291 (BL-109, D-465) : lecture des écartés par la table publiée, reprise unique du réglage local `training.excludedExercises`. */
const DEVICE = '60000000-0000-4000-8000-0000000000fd' as DeviceId;
let db: TestDb;
afterEach(async () => db.close());

describe('exclusionsStore : reprise unique du réglage local (D-465)', () => {
  it('réglage { v: 1, ids } repris une fois puis remis à null ; seconde lecture sans effet ; écriture d’un seul identifiant par geste', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    await db.data.repos.settings.set('training.excludedExercises', { v: 1, ids: ['squat-barbell', 'bench-press-barbell'] });
    expect(await loadExcludedExercises(db.data.repos)).toEqual(['bench-press-barbell', 'squat-barbell']);
    expect(await db.data.repos.settings.get('training.excludedExercises')).toBeNull();
    // Reprise interrompue avant le vidage : rejouée sans doublon.
    await db.data.repos.settings.set('training.excludedExercises', { v: 1, ids: ['squat-barbell'] });
    expect(await loadExcludedExercises(db.data.repos)).toEqual(['bench-press-barbell', 'squat-barbell']);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM exercise_exclusion')).toEqual([{ n: 2 }]);
    await writeExcluded(db.data.repos, 'squat-barbell', false);
    expect(await loadExcludedExercises(db.data.repos)).toEqual(['bench-press-barbell']);
    expect(await db.data.repos.settings.get('training.excludedExercises')).toBeNull();
  });

  it('réglage illisible : vidé sans rien insérer ; aucun réglage : rien écrit', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    expect(await loadExcludedExercises(db.data.repos)).toEqual([]);
    await db.data.repos.settings.set('training.excludedExercises', { v: 9, ids: ['x'] });
    expect(await loadExcludedExercises(db.data.repos)).toEqual([]);
    expect(await db.data.repos.settings.get('training.excludedExercises')).toBeNull();
    expect(await db.driver.select('SELECT 1 FROM exercise_exclusion')).toEqual([]);
  });
});
