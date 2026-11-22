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

  // Relecture 1 (point 4) : un réglage illisible n'est plus vidé (il serait perdu) : il est gardé et un code est journalisé.
  it('réglage illisible : GARDÉ, rien inséré ; aucun réglage : rien écrit', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    expect(await loadExcludedExercises(db.data.repos)).toEqual([]);
    await db.data.repos.settings.set('training.excludedExercises', { v: 9, ids: ['x'] });
    expect(await loadExcludedExercises(db.data.repos)).toEqual([]);
    expect(await db.data.repos.settings.get('training.excludedExercises')).toEqual({ v: 9, ids: ['x'] });
    expect(await db.driver.select('SELECT 1 FROM exercise_exclusion')).toEqual([]);
  });

  it('relecture 1, point 4 : identifiant hors des bornes de la table (« | », plus de 118 caractères) : les autres repris, le réglage GARDÉ', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    const value = { v: 1, ids: ['squat-barbell', 'a|b', 'x'.repeat(119)] };
    await db.data.repos.settings.set('training.excludedExercises', value);
    expect(await loadExcludedExercises(db.data.repos)).toEqual(['squat-barbell']);
    expect(await db.data.repos.settings.get('training.excludedExercises')).toEqual(value);
  });

  it('relecture 1, point 2 : deux lectures concurrentes au premier lancement : aucune n’échoue', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    await db.data.repos.settings.set('training.excludedExercises', { v: 1, ids: ['squat-barbell', 'row-cable'] });
    const [a, b] = await Promise.all([loadExcludedExercises(db.data.repos), loadExcludedExercises(db.data.repos)]);
    expect(a).toEqual(['row-cable', 'squat-barbell']);
    expect(b).toEqual(['row-cable', 'squat-barbell']);
  });
});
