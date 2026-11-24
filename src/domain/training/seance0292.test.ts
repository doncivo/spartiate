import { describe, expect, it } from 'vitest';

import { BENCH, CURL, FITNESS_PARK_ANTONY, input, session, target } from '../../../tests/fixtures/training/progression';
import { GEN_LIBRARY, GYM, input as genInput } from '../../../tests/fixtures/training/generation';
import { T0, setRow, workoutRow } from '../../../tests/fixtures/training/workout';
import type { DeviceId, Hlc, IsoDateTime, LocalDate } from '../types';
import { circuitsOf } from './circuit';
import { routineDiff } from './closure';
import { DEFAULT_GENERATION_CONFIG as GEN_CONFIG } from './config';
import { estimateExerciseSec, estimateSessionSec, generateSession } from './generateSession';
import type { GenerationEquipment } from './generationTypes';
import { loadGrid } from './loadGrid';
import { prescribe } from './prescribe';
import { nextProgramDay, programDayFor, routineTrainingDays, weekdayFromDayName } from './programDay';
import { replayWorkout } from './replay';
import { isCompletedWorkSet, type WorkoutSet, type WorkoutWithSets } from './session';
import type { ProgressionEquipment, RoutineDay, RoutineDaySpec } from './types';

/**
 * SEANCE-0292 (lot 0.29.2, partie A : moteur et génération) : une section par ligne du registre (docs/SEANCE-0292.md). Fixtures
 * synthétiques, valeurs vérifiables à la main.
 */

describe('SEANCE-0292 C-004 : recalibrage « Facile » borné à un cran en confiance provisoire (§ 11.2.5, § 11.3)', () => {
  it('100 × 8 « Facile » en une seule série (confiance < 0,4) : au plus un cran de barre (102,5 kg), pas 105 kg', () => {
    const p = prescribe(input({ exercise: BENCH, history: [session(1, 100, [8], { difficulty: 'easy' })], target: target(8, 10) }));
    expect(p.confidence).toBeLessThan(0.4);
    expect(p.reasons).toContain('provisional');
    expect(p.headline).toBe('recalibration');
    expect(p.loadKg).toBe(102.5);
  });

  it('confiance entre 0,4 et 0,6 : le recalibrage +5 % reste entier (105 kg, deux crans permis)', () => {
    const p = prescribe(input({ exercise: BENCH, history: [session(1, 100, [8, 8], { difficulty: 'easy' })], target: target(8, 10) }));
    expect(p.confidence).toBeGreaterThanOrEqual(0.4);
    expect(p.confidence).toBeLessThan(0.6);
    expect(p.loadKg).toBe(105);
  });
});

describe('SEANCE-0292 C-006 : décharge arrondie vers le bas, sans répétition ajoutée (D-269)', () => {
  it('haltères 26 kg × 10, décharge × 0,9 (cycle de 4 semaines) : 22 kg × 10, aucune répétition ajoutée', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 26, [10, 10, 10])], target: target(8, 10), deload: true, deloadSets: 2, deloadLoad: 0.9 }));
    expect(p.headline).toBe('deload');
    expect(p.loadKg).toBe(22);
    expect(p.sets.map((s) => s.reps)).toEqual([10, 10]);
    expect(p.reasons).not.toContain('snap-extra-rep');
  });

  it('décharge I2 (× 0,8) : 26 kg → 20 kg (20,8 arrondi vers le bas), répétitions de la référence', () => {
    const p = prescribe(input({ exercise: CURL, history: [session(3, 26, [10, 10, 10])], target: target(8, 10), deload: true }));
    expect(p.loadKg).toBe(20);
    expect(p.sets.every((s) => s.reps === 10)).toBe(true);
    expect(p.reasons).not.toContain('snap-extra-rep');
  });
});

describe('SEANCE-0292 C-007 : grille de barre limitée aux disques réellement montables (§ 11.2.7, § 14.3)', () => {
  const home = (plates: { weightKg: number; count: number }[], increments: ProgressionEquipment['increments'] = {}): ProgressionEquipment => ({
    inventory: { ...FITNESS_PARK_ANTONY.inventory, platesPerSideKg: plates },
    increments,
  });

  it('disques par côté {20, 2,5} : 20, 25, 60 et 65 kg seulement ; 45 kg (impossible à monter) jamais proposé', () => {
    expect(loadGrid(['barbell'], home([{ weightKg: 20, count: 1 }, { weightKg: 2.5, count: 1 }]))?.loads).toEqual([20, 25, 60, 65]);
    expect(loadGrid(['barbell'], home([{ weightKg: 20, count: 1 }, { weightKg: 2.5, count: 1 }], { barbell: 2.5 }))?.loads).toEqual([20, 25, 60, 65]);
  });

  it('deux disques de 2,5 et deux de 10 par côté : 35 et 55 kg exclus', () => {
    expect(loadGrid(['barbell'], home([{ weightKg: 2.5, count: 2 }, { weightKg: 10, count: 2 }]))?.loads).toEqual([20, 25, 30, 40, 45, 50, 60, 65, 70]);
  });

  it('profil de la salle (un disque de chaque masse de 1,25 à 30 kg) : grille inchangée, 20 à 237,5 kg par 2,5', () => {
    const loads = loadGrid(['barbell'], FITNESS_PARK_ANTONY)?.loads ?? [];
    expect(loads[0]).toBe(20);
    expect(loads[loads.length - 1]).toBe(237.5);
    expect(loads.length).toBe(88);
  });

  it('incrément déclaré plus grand que le plus petit disque : le pas déclaré reste respecté (5 kg, 20 à 45 kg)', () => {
    expect(loadGrid(['barbell'], home([{ weightKg: 1.25, count: 2 }, { weightKg: 5, count: 2 }], { barbell: 5 }))?.loads).toEqual([20, 25, 30, 35, 40, 45]);
  });

  it('haut de plage à 25 kg avec {20, 2,5} : cran montable suivant 60 kg au-delà du plafond +10 %, échelle de répétitions (pas 30 kg)', () => {
    const p = prescribe(input({ exercise: BENCH, history: [session(3, 25, [10, 10, 10])], target: target(8, 10), equipment: home([{ weightKg: 20, count: 1 }, { weightKg: 2.5, count: 1 }]) }));
    expect(p.loadKg).toBe(25);
    expect(p.reasons).toContain('gain-capped');
  });
});

describe('SEANCE-0292 C-010 : séries dégressives et partielles hors de l’écart de routine (§ 13.8)', () => {
  const meta = { createdAt: T0, updatedAt: T0, deletedAt: null, deviceId: 'd' as DeviceId, hlc: 'h' as Hlc };
  const line = (id: string, exerciseId: string, sets: number, position: number) => ({ id, routineDayId: 'day', exerciseId, exerciseName: `Nom ${exerciseId}`, sets, repMin: 6, repMax: 10, rir: 2, restSec: 150, position, ...meta });
  const day: RoutineDay = { id: 'day', routineId: 'r', name: 'Haut A', dayOrder: 0, exercises: [line('l1', 'bench-press-barbell', 3, 0)], ...meta };
  const w = (sets: WorkoutSet[]): WorkoutWithSets => ({ ...workoutRow({ routineId: 'r', routineDayId: 'day', source: 'routine' }), sets });
  const s = (i: number, over: Partial<WorkoutSet> = {}): WorkoutSet => setRow(i, { done: true, reps: 8, loadKg: 60, ...over });

  it('3 séries de travail + 1 dégressive + 1 partielle : aucun écart (la routine garde 3 séries)', () => {
    const diff = routineDiff(w([s(0), s(1), s(2), s(3, { setKind: 'drop', loadKg: 40 }), s(4, { setKind: 'partial', loadKg: 70 })]), day);
    expect(diff.hasChanges).toBe(false);
  });

  it('2 séries de travail + 1 dégressive : 3 → 2 (la dégressive ne compense pas la série retirée)', () => {
    const diff = routineDiff(w([s(0), s(1), s(2, { setKind: 'drop', loadKg: 40 })]), day);
    expect(diff.setsChanged).toEqual([{ lineId: 'l1', exerciseId: 'bench-press-barbell', exerciseName: 'Nom bench-press-barbell', from: 3, to: 2 }]);
  });


  it('exercice de la routine fait seulement en dégressives : ni retiré ni modifié (il a été fait)', () => {
    const diff = routineDiff(w([s(0, { setKind: 'drop', loadKg: 40 })]), day);
    expect(diff.hasChanges).toBe(false);
  });
  it('séries chronométrées comptées comme travail', () => {
    expect(routineDiff(w([s(0, { setKind: 'timed', durationSec: 30 }), s(1), s(2)]), day).hasChanges).toBe(false);
  });

  it('exercice de la routine fait seulement en dégressives : ni retiré ni modifié (il a été fait)', () => {
    expect(routineDiff(w([s(0, { setKind: 'drop', loadKg: 40 })]), day).hasChanges).toBe(false);
  });
});

describe('SEANCE-0292 C-016 : isCompletedWorkSet ne compte ni dégressive ni partielle comme travail', () => {
  it('travail et chronométrée validées : oui ; dégressive, partielle, échauffement : non', () => {
    expect(isCompletedWorkSet(setRow(0, { done: true, reps: 8, loadKg: 60 }))).toBe(true);
    expect(isCompletedWorkSet(setRow(0, { setKind: 'timed', done: true, durationSec: 45 }))).toBe(true);
    expect(isCompletedWorkSet(setRow(0, { setKind: 'drop', done: true, reps: 8, loadKg: 40 }))).toBe(false);
    expect(isCompletedWorkSet(setRow(0, { setKind: 'partial', done: true, reps: 5, loadKg: 70 }))).toBe(false);
    expect(isCompletedWorkSet(setRow(0, { setKind: 'warmup', done: true, reps: 8, loadKg: 40 }))).toBe(false);
  });
});

describe('SEANCE-0292 C-012 : durée d’une série chronométrée = sa durée cible, pas 45 s (§ 12.1, Q-9 option B en choix prudent)', () => {
  const plankDay: RoutineDaySpec = { name: 'Gainage', dayOrder: 1, exercises: [{ exerciseId: 'plank', exerciseName: 'Planche', sets: 3, repMin: 60, repMax: 60, rir: null, restSec: 60, position: 0 }] };

  it('planche 3 × 60 s, repos 60 s : 300 s (3 × 60 + 2 × 60), pas 255 s', () => {
    const s = generateSession(genInput({}, { split: 'full-body', days: [plankDay] }));
    expect(s.status).toBe('ready');
    expect(s.exercises[0]?.estimatedSec).toBe(300);
    expect(s.estimatedSec).toBe(300);
  });

  it('estimateSessionSec avec la métrique des exercices : même durée que la génération ; sans métrique : 45 s par série (comme avant)', () => {
    const metricOf = (id: string) => GEN_LIBRARY.find((e) => e.id === id)?.metric;
    expect(estimateSessionSec(plankDay.exercises, GEN_CONFIG, metricOf)).toBe(300);
    expect(estimateSessionSec(plankDay.exercises, GEN_CONFIG)).toBe(255);
  });

  it('exercice à charge : 45 s par série, inchangé', () => {
    expect(estimateExerciseSec(3, 60, GEN_CONFIG)).toBe(255);
  });
});

describe('SEANCE-0292 C-013 (D-472) : plages du § 12.1.4 pour tout exercice placé par la génération', () => {
  const noBarbell: GenerationEquipment = { kind: 'salle', inventory: { ...GYM.inventory, available: GYM.inventory.available.filter((i) => i !== 'barbell') } };

  it('substitution de même type (rowing barre → haltère, polyarticulaire 6–10) : 5–10 ; isolation substituée (curl barre 8–12) : 8–15', () => {
    const s = generateSession(genInput({ equipment: noBarbell }));
    const sub = s.exercises.find((e) => e.sourceExerciseId === 'row-barbell');
    expect(sub?.origin).toBe('substitution');
    expect(sub?.kind).toBe('compound');
    expect([sub?.repMin, sub?.repMax]).toEqual([5, 10]);
    const curl = s.exercises.find((e) => e.sourceExerciseId === 'curl-barbell');
    expect(curl?.origin).toBe('substitution');
    expect([curl?.repMin, curl?.repMax]).toEqual([8, 15]);
  });

  it('ligne de la routine d’Ali : plage écrite gardée (D-86), 6–10 et 12–15', () => {
    const s = generateSession(genInput());
    const bench = s.exercises.find((e) => e.exerciseId === 'bench-barbell');
    expect(bench?.origin).toBe('routine');
    expect([bench?.repMin, bench?.repMax]).toEqual([6, 10]);
    const raise = s.exercises.find((e) => e.exerciseId === 'lateral-raise-dumbbell');
    expect([raise?.repMin, raise?.repMax]).toEqual([12, 15]);
  });
});

describe('SEANCE-0292 C-014 : replay, instant de validation illisible traité comme absent (ordre par position)', () => {
  const r = (id: string, position: number, doneAt: string | null): WorkoutSet => setRow(0, { id, position, done: true, reps: 8, loadKg: 60, doneAt: doneAt as IsoDateTime | null });

  it('« pas-une-date » entre deux séries datées : placée après la série datée qui la précède par position, comptée sans instant', () => {
    const a = r('a', 0, '2026-11-10T18:00:00.000Z');
    const b = r('b', 1, 'pas-une-date');
    const c = r('c', 2, '2026-11-10T18:05:00.000Z');
    const d = r('d', 3, 'x');
    const out = replayWorkout({ sets: [d, c, b, a] });
    expect(out.steps.map((st) => st.set.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(out.missingInstants).toBe(2);
    expect(out.steps[0]?.rest.deviation).toBe('unknown');
  });
});

describe('SEANCE-0292 C-015 : circuit, un exercice n’en est membre que par ses séries de travail', () => {
  const c = (id: string, exerciseId: string, position: number, setKind: WorkoutSet['setKind'] = 'work'): WorkoutSet =>
    setRow(0, { id, exerciseId, position, setKind, circuitId: 'c1', circuitRestSec: 0, targetRestSec: 90 });

  it('A et B en travail, C en échauffement seulement : superset A + B (C n’est pas membre)', () => {
    const sets = [c('w', 'c-ex', 0, 'warmup'), c('a1', 'a', 1), c('b1', 'b', 2), c('a2', 'a', 3), c('b2', 'b', 4)];
    expect(circuitsOf(sets)).toEqual([{ circuitId: 'c1', exerciseIds: ['a', 'b'], rounds: 2, kind: 'superset', restBetweenSec: 0, restRoundSec: 90 }]);
  });

  it('A en travail, B en échauffement seulement : aucun groupe', () => {
    expect(circuitsOf([c('w', 'b', 0, 'warmup'), c('a1', 'a', 1), c('a2', 'a', 2)])).toEqual([]);
  });
});

describe('SEANCE-0292 C-017 (D-473) : une dernière séance vidée ou supprimée revient dans la rotation (règle figée)', () => {
  const d = (id: string, dayOrder: number, exercises: readonly unknown[] = ['x']) => ({ id, dayOrder, exercises });
  const w = (routineDayId: string) => ({ routineId: 'r', routineDayId });

  it('A, B, C ; A puis C faits : A, le jour qui suit C (rotation ordinaire)', () => {
    expect(nextProgramDay([d('A', 0), d('B', 1), d('C', 2)], [w('C'), w('A')], 'r')).toBe('A');
  });

  it('C fait puis vidé de ses exercices dans la routine : la séance de C ne compte plus, la rotation repart de A (B proposé)', () => {
    expect(nextProgramDay([d('A', 0), d('B', 1), d('C', 2, [])], [w('C'), w('A')], 'r')).toBe('B');
  });

  it('séance de C supprimée (absente des séances closes, `listClosed` écarte `deleted_at`) : la rotation repart de A (B proposé)', () => {
    expect(nextProgramDay([d('A', 0), d('B', 1), d('C', 2)], [w('A')], 'r')).toBe('B');
  });

  it('aucune séance restante : premier jour garni', () => {
    expect(nextProgramDay([d('A', 0, []), d('B', 1), d('C', 2)], [], 'r')).toBe('B');
  });
});

describe('SEANCE-0292 C-019 : jour de la semaine entier ; nom de jour « mot entier » (D-317)', () => {
  const day = (id: string, dayOrder: number, weekday: number | null) => ({ id, dayOrder, weekday, exercises: [{}] });

  it('jour de la semaine 2,5 : ignoré (pas un jour rattaché), jamais rendu comme prochain jour', () => {
    expect(routineTrainingDays([day('a', 0, 2.5), day('b', 1, 4)])).toEqual([4]);
    const choice = programDayFor([day('a', 0, 2.5), day('b', 1, 4)], [], 'r', '2026-11-24' as LocalDate);
    expect(choice).toEqual({ kind: 'rest', nextDayId: 'b', nextWeekday: 4 });
  });

  it('« Lundi2 », « Lundi_x » : aucun jour ; « Lundi — Poussée », « lundi » : lundi', () => {
    expect(weekdayFromDayName('Lundi2')).toBeNull();
    expect(weekdayFromDayName('Lundi_x')).toBeNull();
    expect(weekdayFromDayName('Lundi — Poussée')).toBe(1);
    expect(weekdayFromDayName('lundi')).toBe(1);
    expect(weekdayFromDayName('Mardi: tirage')).toBe(2);
  });
});
