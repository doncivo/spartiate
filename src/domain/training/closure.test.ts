import { describe, expect, it } from 'vitest';
import { setRow, workoutRow } from '../../../tests/fixtures/training/workout';
import type { DeviceId, Hlc, IsoDateTime } from '../types';
import { countsInTonnage, personalRecords, routineDiff, summarizeWorkout, tonnageKg, workoutDurationSec } from './closure';
import type { WorkoutSet, WorkoutWithSets } from './session';
import type { RoutineDay } from './types';

/** I1-03 : résumé de fin de séance (§ 13.5), records, « Mettre à jour la routine ? » (§ 13.8). Fixtures synthétiques. */

const iso = (v: string): IsoDateTime => v as IsoDateTime;
const set = (index: number, over: Partial<WorkoutSet> = {}): WorkoutSet => setRow(index, { done: true, reps: 8, loadKg: 60, ...over });
const workout = (sets: WorkoutSet[], over: Partial<WorkoutWithSets> = {}): WorkoutWithSets => ({
  ...workoutRow({ startedAt: iso('2026-11-02T17:00:00.000Z'), endedAt: iso('2026-11-02T18:05:30.000Z') }),
  sets,
  ...over,
});

describe('tonnage (§ 13.5 : hors échauffement, drop, partielles, chrono)', () => {
  it('seules les séries de travail validées avec charge et répétitions comptent', () => {
    const sets = [
      set(0),
      set(1, { reps: 10, loadKg: 62.5 }),
      set(2, { setKind: 'warmup', loadKg: 40 }),
      set(3, { setKind: 'drop', loadKg: 40 }),
      set(4, { setKind: 'partial', loadKg: 80 }),
      set(5, { setKind: 'timed', reps: null, loadKg: 20, durationSec: 30 }),
      set(6, { done: false }),
    ];
    expect(sets.map(countsInTonnage)).toEqual([true, true, false, false, false, false, false]);
    expect(tonnageKg(sets)).toBe(8 * 60 + 10 * 62.5);
  });

  it('poids du corps sans charge : 0 ; série supprimée : exclue ; somme arrondie au centième', () => {
    expect(tonnageKg([set(0, { loadKg: null })])).toBe(0);
    expect(tonnageKg([set(0, { deletedAt: iso('2026-11-02T17:10:00.000Z') })])).toBe(0);
    expect(tonnageKg([set(0, { reps: 3, loadKg: 0.1 }), set(1, { reps: 3, loadKg: 0.2 })])).toBe(0.9);
  });
});

describe('durée et résumé', () => {
  it('durée en secondes ; séance ouverte ou dates incohérentes : null', () => {
    expect(workoutDurationSec({ startedAt: '2026-11-02T17:00:00.000Z', endedAt: '2026-11-02T18:05:30.000Z' })).toBe(3930);
    expect(workoutDurationSec({ startedAt: '2026-11-02T17:00:00.000Z', endedAt: null })).toBeNull();
    expect(workoutDurationSec({ startedAt: '2026-11-02T18:00:00.000Z', endedAt: '2026-11-02T17:00:00.000Z' })).toBeNull();
    expect(workoutDurationSec({ startedAt: 'x', endedAt: '2026-11-02T17:00:00.000Z' })).toBeNull();
  });

  it('séries validées, de travail, prévues, tonnage, sans historique : aucun record', () => {
    const s = summarizeWorkout(workout([set(0), set(1, { setKind: 'warmup' }), set(2, { done: false })]));
    expect(s).toEqual({ durationSec: 3930, validatedSets: 2, validatedWorkSets: 1, plannedSets: 3, tonnageKg: 480, records: [] });
  });
});

describe('records', () => {
  const past = [set(0, { id: 'p1', workoutId: 'old', loadKg: 60, reps: 10 }), set(1, { id: 'p2', workoutId: 'old', loadKg: 65, reps: 5 })];

  it('charge la plus lourde et meilleure série, strictement au-dessus de l’historique', () => {
    const records = personalRecords([set(0, { loadKg: 67.5, reps: 4 }), set(1, { loadKg: 62.5, reps: 10 })], past);
    expect(records).toEqual([
      { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', kind: 'load', value: 67.5, previous: 65, setId: setRow(0).id },
      { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', kind: 'set-volume', value: 625, previous: 600, setId: setRow(1).id },
    ]);
  });

  it('égalité, échauffement, partielle ou drop plus lourds, série non validée : aucun record', () => {
    expect(personalRecords([set(0, { loadKg: 65, reps: 5 })], past)).toEqual([]);
    expect(personalRecords([set(0, { setKind: 'warmup', loadKg: 100 }), set(1, { setKind: 'partial', loadKg: 100 }), set(2, { setKind: 'drop', loadKg: 100 }), set(3, { exerciseId: 'bench-press-barbell', done: false, loadKg: 100 })], past)).toEqual([]);
  });

  it('l’historique d’un autre exercice ne compte pas ; le nom figé de la séance est rendu (exercice disparu, P-09)', () => {
    const records = personalRecords([set(0, { exerciseId: 'custom-x', exerciseName: 'Exercice supprimé', loadKg: 70 })], [...past, set(1, { id: 'p3', exerciseId: 'custom-x', exerciseName: 'Ancien nom', loadKg: 50 })]);
    expect(records.map((r) => [r.exerciseName, r.kind, r.previous])).toEqual([
      ['Exercice supprimé', 'load', 50],
      ['Exercice supprimé', 'set-volume', 400],
    ]);
  });
});

describe('« Mettre à jour la routine ? » (§ 13.8)', () => {
  const meta = { createdAt: iso('2026-11-01T00:00:00.000Z'), updatedAt: iso('2026-11-01T00:00:00.000Z'), deletedAt: null, deviceId: 'd' as DeviceId, hlc: 'h' as Hlc };
  const line = (id: string, exerciseId: string, sets: number, position: number) => ({ id, routineDayId: 'day', exerciseId, exerciseName: `Nom ${exerciseId}`, sets, repMin: 6, repMax: 10, rir: 2, restSec: 150, position, ...meta });
  const day = (over: Partial<RoutineDay> = {}): RoutineDay => ({ id: 'day', routineId: 'r', name: 'Haut A', dayOrder: 0, exercises: [line('l1', 'bench-press-barbell', 3, 0), line('l2', 'row-barbell', 2, 1)], ...meta, ...over });
  const fromRoutine = (sets: WorkoutSet[]) => workout(sets, { routineId: 'r', routineDayId: 'day', source: 'routine' });

  it('aucun écart : la question n’est pas posée ; un échauffement ne compte pas comme série', () => {
    const sets = [set(0), set(1), set(2), set(3, { exerciseId: 'row-barbell' }), set(4, { exerciseId: 'row-barbell' }), set(5, { setKind: 'warmup' })];
    expect(routineDiff(fromRoutine(sets), day()).hasChanges).toBe(false);
  });

  it('exercice ajouté, exercice retiré, nombre de séries différent ; séries non validées comprises (structure)', () => {
    const sets = [set(0), set(1, { done: false }), set(2, { exerciseId: 'dip', exerciseName: 'Dips', targetRepsMin: 8, targetRepsMax: 12, targetRestSec: 90 })];
    const diff = routineDiff(fromRoutine(sets), day());
    expect(diff).toEqual({
      added: [{ exerciseId: 'dip', exerciseName: 'Dips', sets: 1, repMin: 8, repMax: 12, restSec: 90 }],
      removed: [{ lineId: 'l2', exerciseId: 'row-barbell', exerciseName: 'Nom row-barbell' }],
      setsChanged: [{ lineId: 'l1', exerciseId: 'bench-press-barbell', exerciseName: 'Nom bench-press-barbell', from: 3, to: 2 }],
      hasChanges: true,
    });
  });

  it('séance libre, copie, jour absent, autre jour ou supprimé : aucun écart', () => {
    expect(routineDiff(workout([set(0)]), day()).hasChanges).toBe(false);
    expect(routineDiff(fromRoutine([set(0)]), null).hasChanges).toBe(false);
    expect(routineDiff(fromRoutine([set(0)]), day({ id: 'autre' })).hasChanges).toBe(false);
    expect(routineDiff(fromRoutine([set(0)]), day({ deletedAt: iso('2026-11-02T00:00:00.000Z') })).hasChanges).toBe(false);
  });
});
