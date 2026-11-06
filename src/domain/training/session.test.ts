import { describe, expect, it } from 'vitest';
import { INTERRUPTED, PAST, REST_END_AT, REST_STARTED_AT_MS, setRow, workoutRow } from '../../../tests/fixtures/training/workout';
import {
  REST_EXTEND_SEC,
  defaultEntry,
  entryOf,
  extendRestEnd,
  groupByExercise,
  isCompletedWorkSet,
  planFromPastWorkout,
  planFromRoutineDay,
  restEndAt,
  restRemainingMs,
  resumeState,
  summarizeSets,
  validateSetEntry,
  type SetEntry,
} from './session';

/** I1-02 : règles pures de la séance active (§ 13.1–13.4, 13.7–13.8). Aucune progression (I2). */

const entry = (over: Partial<SetEntry> = {}): SetEntry => ({ reps: 8, loadKg: 60, durationSec: null, rir: 2, ...over });

describe('validateSetEntry : bornes de la saisie', () => {
  it('une saisie complète est valide', () => {
    expect(validateSetEntry(entry(), 'work')).toEqual([]);
    expect(validateSetEntry(entry({ loadKg: null, rir: null }), 'work')).toEqual([]);
    expect(validateSetEntry(entry({ loadKg: 0 }), 'work')).toEqual([]);
  });
  it('répétitions : entier de 1 à 999', () => {
    for (const reps of [0, -1, 1.5, 1000, Number.NaN]) expect(validateSetEntry(entry({ reps }), 'work'), String(reps)).toContain('reps');
    expect(validateSetEntry(entry({ reps: 999 }), 'work')).toEqual([]);
  });
  it('charge : fini, 0 à 1000 kg', () => {
    for (const loadKg of [-0.5, 1000.5, Number.POSITIVE_INFINITY, Number.NaN]) expect(validateSetEntry(entry({ loadKg }), 'work'), String(loadKg)).toContain('load');
    expect(validateSetEntry(entry({ loadKg: 62.5 }), 'work')).toEqual([]);
  });
  it('RIR : entier de 0 à 5 ou vide', () => {
    for (const rir of [-1, 6, 1.5]) expect(validateSetEntry(entry({ rir }), 'work'), String(rir)).toContain('rir');
    expect(validateSetEntry(entry({ rir: 0 }), 'work')).toEqual([]);
  });
  it('sans répétitions ni durée : rien à valider ; une série chronométrée exige une durée', () => {
    expect(validateSetEntry(entry({ reps: null }), 'work')).toContain('empty');
    expect(validateSetEntry({ reps: null, loadKg: null, durationSec: 45, rir: null }, 'timed')).toEqual([]);
    expect(validateSetEntry(entry({ durationSec: null }), 'timed')).toContain('duration');
    expect(validateSetEntry({ reps: null, loadKg: null, durationSec: 0, rir: null }, 'timed')).toContain('duration');
    expect(validateSetEntry({ reps: null, loadKg: null, durationSec: 36_001, rir: null }, 'timed')).toContain('duration');
  });
});

describe('série de travail réussie : jamais par défaut', () => {
  it('une série non validée ou d’échauffement n’est pas une série de travail réussie', () => {
    expect(isCompletedWorkSet(setRow(0))).toBe(false);
    expect(isCompletedWorkSet(setRow(0, { reps: 8, loadKg: 60 }))).toBe(false);
    expect(isCompletedWorkSet(setRow(0, { setKind: 'warmup', done: true, reps: 8, loadKg: 40 }))).toBe(false);
    expect(isCompletedWorkSet(setRow(0, { done: true, reps: 8, loadKg: 60 }))).toBe(true);
    expect(isCompletedWorkSet(setRow(0, { setKind: 'timed', done: true, durationSec: 45 }))).toBe(true);
  });
});

describe('valeurs par défaut de saisie : celles de la routine ou de la séance copiée, aucune cible inventée', () => {
  it('rien de pré-rempli sans cible explicite', () => {
    expect(defaultEntry(setRow(0))).toEqual({ reps: null, loadKg: null, durationSec: null, rir: null });
  });
  it('plage de répétitions : pas de choix arbitraire ; cible unique : reprise', () => {
    expect(defaultEntry(setRow(0, { targetRepsMin: 6, targetRepsMax: 10 })).reps).toBeNull();
    expect(defaultEntry(setRow(0, { targetRepsMin: 8, targetRepsMax: 8, targetLoadKg: 62.5 }))).toMatchObject({ reps: 8, loadKg: 62.5 });
  });
  it('la valeur déjà saisie prime sur la cible ; entryOf ne lit que la saisie', () => {
    const s = setRow(0, { targetRepsMin: 8, targetRepsMax: 8, targetLoadKg: 60, reps: 7, loadKg: 62.5, rir: 1 });
    expect(defaultEntry(s)).toEqual({ reps: 7, loadKg: 62.5, durationSec: null, rir: 1 });
    expect(entryOf(setRow(0, { targetLoadKg: 60 }))).toEqual({ reps: null, loadKg: null, durationSec: null, rir: null });
  });
  it('série chronométrée : durée cible unique reprise', () => {
    expect(defaultEntry(setRow(0, { setKind: 'timed', targetRepsMin: 45, targetRepsMax: 45 })).durationSec).toBe(45);
  });
});

describe('plans de séance', () => {
  const lines = [
    { exerciseId: 'row-barbell', exerciseName: 'Rowing', sets: 2, repMin: 6, repMax: 10, rir: 2, restSec: 120, position: 1 },
    { exerciseId: 'bench-press-barbell', exerciseName: 'Développé', sets: 3, repMin: 5, repMax: 8, rir: null, restSec: 150, position: 0 },
  ];
  it('depuis un jour de routine : lignes par position, une série par « sets », cibles de la routine, aucune charge inventée', () => {
    const plan = planFromRoutineDay(lines);
    expect(plan.map((p) => p.exerciseId)).toEqual(['bench-press-barbell', 'bench-press-barbell', 'bench-press-barbell', 'row-barbell', 'row-barbell']);
    expect(plan[0]).toEqual({ exerciseId: 'bench-press-barbell', exerciseName: 'Développé', setKind: 'work', targetRepsMin: 5, targetRepsMax: 8, targetLoadKg: null, targetRestSec: 150 });
    expect(plan.every((p) => p.targetLoadKg === null && p.setKind === 'work')).toBe(true);
  });
  it('depuis une séance passée : séries validées seulement, dernières charges et répétitions comme cibles, type conservé', () => {
    const plan = planFromPastWorkout(PAST);
    expect(plan).toHaveLength(4);
    expect(plan[0]).toMatchObject({ setKind: 'warmup', targetRepsMin: 8, targetRepsMax: 8, targetLoadKg: 40 });
    expect(plan[2]).toMatchObject({ setKind: 'work', targetRepsMin: 7, targetRepsMax: 7, targetLoadKg: 62.5 });
    expect(plan[3]).toMatchObject({ exerciseId: 'plank', setKind: 'timed', targetRepsMin: 45, targetRepsMax: 45, targetLoadKg: null });
  });
  it('la séance passée n’est pas modifiée', () => {
    const before = JSON.stringify(PAST);
    planFromPastWorkout(PAST);
    expect(JSON.stringify(PAST)).toBe(before);
  });
});

describe('groupement et résumé', () => {
  it('blocs d’exercice dans l’ordre des positions', () => {
    const shuffled = [...INTERRUPTED.sets].reverse();
    const blocks = groupByExercise(shuffled);
    expect(blocks.map((b) => [b.exerciseId, b.sets.length])).toEqual([['bench-press-barbell', 3], ['row-barbell', 4]]);
    expect(blocks[0]?.sets.map((s) => s.position)).toEqual([0, 1, 2]);
  });
  it('résumé : séries validées sur prévues, avec le détail travail / échauffement', () => {
    expect(summarizeSets(INTERRUPTED.sets)).toEqual({ validated: 5, planned: 7, validatedWork: 5, plannedWork: 7 });
    expect(summarizeSets(PAST.sets)).toEqual({ validated: 4, planned: 5, validatedWork: 3, plannedWork: 4 });
    expect(summarizeSets([])).toEqual({ validated: 0, planned: 0, validatedWork: 0, plannedWork: 0 });
  });
});

describe('repos : toujours recalculé depuis la date de fin', () => {
  it('temps restant = fin - maintenant, jamais négatif', () => {
    const end = '2026-11-02T17:12:30.000Z';
    expect(restRemainingMs(end, Date.parse(end) - 90_000)).toBe(90_000);
    expect(restRemainingMs(end, Date.parse(end))).toBe(0);
    expect(restRemainingMs(end, Date.parse(end) + 5_000)).toBe(0);
    expect(restRemainingMs(null, 0)).toBe(0);
    expect(restRemainingMs('pas-une-date', 0)).toBe(0);
  });
  it('après un « verrouillage » de 40 s puis 200 s : le résultat ne dépend que de l’horloge', () => {
    expect(restRemainingMs(REST_END_AT, REST_STARTED_AT_MS)).toBe(150_000);
    expect(restRemainingMs(REST_END_AT, REST_STARTED_AT_MS + 40_000)).toBe(110_000);
    expect(restRemainingMs(REST_END_AT, REST_STARTED_AT_MS + 200_000)).toBe(0);
  });
  it('échéance : début + durée ; +30 s depuis une échéance future, depuis maintenant si elle est passée', () => {
    expect(restEndAt(REST_STARTED_AT_MS, 150)).toBe(REST_END_AT);
    expect(REST_EXTEND_SEC).toBe(30);
    expect(extendRestEnd(REST_END_AT, REST_STARTED_AT_MS + 10_000)).toBe(new Date(Date.parse(REST_END_AT) + 30_000).toISOString());
    const later = REST_STARTED_AT_MS + 400_000;
    expect(extendRestEnd(REST_END_AT, later)).toBe(new Date(later + 30_000).toISOString());
    expect(extendRestEnd(null, later)).toBe(new Date(later + 30_000).toISOString());
  });
});

describe('reprise (resumeState)', () => {
  it('aucune séance : rien à reprendre', () => {
    expect(resumeState(null, 0)).toBeNull();
  });
  it('après cinq séries : séance, séries dans l’ordre, repos restant, prochaine série', () => {
    const state = resumeState({ ...INTERRUPTED, sets: [...INTERRUPTED.sets].reverse() }, REST_STARTED_AT_MS + 50_000);
    expect(state?.sets.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(new Set(state?.sets.map((s) => s.id)).size).toBe(7);
    expect(state?.summary).toEqual({ validated: 5, planned: 7, validatedWork: 5, plannedWork: 7 });
    expect(state?.nextSetId).toBe(INTERRUPTED.sets[5]?.id);
    expect(state?.rest).toEqual({ endAt: REST_END_AT, remainingMs: 100_000, expired: false });
    expect(state?.blocks).toHaveLength(2);
  });
  it('repos écoulé pendant le verrouillage : expiré, 0 ms ; pas de repos : null', () => {
    expect(resumeState(INTERRUPTED, REST_STARTED_AT_MS + 999_000)?.rest).toEqual({ endAt: REST_END_AT, remainingMs: 0, expired: true });
    expect(resumeState({ ...INTERRUPTED, ...workoutRow(), sets: INTERRUPTED.sets }, 0)?.rest).toBeNull();
  });
  it('séance entièrement validée : pas de prochaine série', () => {
    const done = { ...INTERRUPTED, sets: INTERRUPTED.sets.map((s) => ({ ...s, done: true, reps: 5 })) };
    expect(resumeState(done, 0)?.nextSetId).toBeNull();
  });
});
