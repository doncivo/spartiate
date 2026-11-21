import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from './session';
import { prescriptionGaps } from './summaryGap';

/**
 * SESS-01e (§ 13.5 « Résumé : … écart ») : écart de la séance faite à la prescription, par exercice. Cible : décision tracée de la séance (charge et
 * répétitions retenues), sinon cibles des séries ; séries comptées hors échauffement ; jamais d'écart inventé sans cible.
 */

let n = 0;
const s = (exerciseId: string, over: Partial<WorkoutSet> = {}): WorkoutSet =>
  ({ id: `s${String(n)}`, exerciseId, exerciseName: exerciseId === 'bench' ? 'Développé couché' : 'Rowing', position: n++, setKind: 'work', done: true, deletedAt: null, loadKg: 80, reps: 8, targetLoadKg: null, targetRepsMin: 6, targetRepsMax: 10, ...over }) as WorkoutSet;

describe('prescriptionGaps', () => {
  it('décision tracée : séries faites / prévues, charge faite contre retenue, répétitions de plus ou de moins', () => {
    n = 0;
    const sets = [s('bench', { setKind: 'warmup', loadKg: 40 }), s('bench'), s('bench'), s('bench', { reps: 7 }), s('row', { done: false, loadKg: null, reps: null, targetLoadKg: 60 }), s('row', { loadKg: 57.5, reps: 10 })];
    const gaps = prescriptionGaps(sets, new Map([['bench', { loadKg: 80, reps: [8, 8, 8] }]]));
    expect(gaps).toEqual([
      { exerciseId: 'bench', exerciseName: 'Développé couché', plannedSets: 3, doneSets: 3, targetLoadKg: 80, doneLoadKg: 80, loadDeltaKg: 0, repsDelta: -1 },
      { exerciseId: 'row', exerciseName: 'Rowing', plannedSets: 2, doneSets: 1, targetLoadKg: 60, doneLoadKg: 57.5, loadDeltaKg: -2.5, repsDelta: null },
    ]);
  });

  it('sans cible : aucun écart de charge ni de répétitions ; exercice sans série faite : charge faite nulle', () => {
    n = 0;
    const gaps = prescriptionGaps([s('bench', { done: false, loadKg: null, reps: null })], new Map());
    expect(gaps).toEqual([{ exerciseId: 'bench', exerciseName: 'Développé couché', plannedSets: 1, doneSets: 0, targetLoadKg: null, doneLoadKg: null, loadDeltaKg: null, repsDelta: null }]);
  });

  it('séries supprimées ignorées ; charge faite = la plus lourde des séries de travail faites', () => {
    n = 0;
    const gaps = prescriptionGaps([s('bench', { loadKg: 82.5 }), s('bench', { loadKg: 80 }), s('bench', { deletedAt: 'x' as WorkoutSet['deletedAt'] })], new Map([['bench', { loadKg: 80, reps: [8, 8] }]]));
    expect(gaps[0]).toMatchObject({ plannedSets: 2, doneSets: 2, doneLoadKg: 82.5, loadDeltaKg: 2.5, repsDelta: 0 });
  });
});
