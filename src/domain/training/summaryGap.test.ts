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

  it('SEANCE-0292b BL-140 : exercice assisté, charge faite = la série la MOINS assistée (la plus dure), écart dans ce sens', () => {
    n = 0;
    const sets = [s('pull-up-assisted', { loadKg: 30 }), s('pull-up-assisted', { loadKg: 25 }), s('pull-up-assisted', { loadKg: 35 })];
    const gaps = prescriptionGaps(sets, new Map([['pull-up-assisted', { loadKg: 30, reps: [8, 8, 8] }]]), new Set(['pull-up-assisted']));
    expect(gaps[0]).toMatchObject({ doneLoadKg: 25, loadDeltaKg: -5 });
    // Exercice ordinaire : toujours la plus lourde.
    expect(prescriptionGaps(sets, new Map())[0]).toMatchObject({ doneLoadKg: 35 });
  });

  it('SEANCE-0292b BL-141 : répétitions comparées à la série PRÉVUE de même rang (setIndex), pas au rang parmi les séries faites', () => {
    n = 0;
    // Prévu 10-8-6 ; la 1re série n'est pas faite, la 2e fait 8, la 3e fait 6 : aucun écart (et non 8-10 + 6-8 = -4).
    const sets = [s('bench', { done: false, reps: null }), s('bench', { reps: 8 }), s('bench', { reps: 6 })];
    const gaps = prescriptionGaps(sets, new Map([['bench', { loadKg: 80, reps: [10, 8, 6] }]]));
    expect(gaps[0]).toMatchObject({ doneSets: 2, repsDelta: 0 });
    // Série ajoutée au-delà des séries retenues : comparée à la dernière retenue.
    n = 0;
    const extra = [s('bench', { reps: 10 }), s('bench', { reps: 8 }), s('bench', { reps: 6 }), s('bench', { reps: 7 })];
    expect(prescriptionGaps(extra, new Map([['bench', { loadKg: 80, reps: [10, 8, 6] }]]))[0]).toMatchObject({ repsDelta: 1 });
  });
});
