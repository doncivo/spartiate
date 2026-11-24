import { describe, expect, it } from 'vitest';

import { BENCH, CURL, FITNESS_PARK_ANTONY, daysAgo, input, session, target } from '../../../tests/fixtures/training/progression';
import { GEN_LIBRARY, GYM, input as genInput } from '../../../tests/fixtures/training/generation';
import { T0, setRow, workoutRow } from '../../../tests/fixtures/training/workout';
import type { DeviceId, Hlc, IsoDateTime, LocalDate } from '../types';
import { circuitsOf } from './circuit';
import { compareInstants } from './estimate1rm';
import { routineDiff } from './closure';
import { DEFAULT_GENERATION_CONFIG as GEN_CONFIG } from './config';
import { estimateExerciseSec, estimateSessionSec, generateSession } from './generateSession';
import type { GenerationEquipment } from './generationTypes';
import { loadGrid } from './loadGrid';
import { prescribe } from './prescribe';
import { recoverySplit } from './recoverySplit';
import { nextProgramDay, programDayFor, routineTrainingDays, weekdayFromDayName } from './programDay';
import { replayWorkout } from './replay';
import { strengthScore, type StrengthExercise, type StrengthStandards } from './strengthScore';
import { type WorkoutSet, type WorkoutWithSets } from './session';
import { warmupForExercise } from './warmup';
import type { ExerciseSession, ProgressionEquipment, RoutineDay, RoutineDaySpec } from './types';

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

describe('SEANCE-0292 C-021 : Recovery Split, seuil comparé à la valeur mesurée, pas à l’arrondi', () => {
  it('49,6 % : à ménager (affiché 50 %) ; 50 % : prêt ; 49,4 % : à ménager', () => {
    const split = recoverySplit(['a', 'b', 'c'], [
      { muscleId: 'a', percent: 49.6 },
      { muscleId: 'b', percent: 50 },
      { muscleId: 'c', percent: 49.4 },
    ]);
    expect(split.map((m) => [m.percent, m.readiness])).toEqual([
      [50, 'spare'],
      [50, 'ready'],
      [49, 'spare'],
    ]);
  });
});

describe('SEANCE-0292 C-023 : Strength Score, à score égal la borne départage (« > 99 » l’emporte sur « 99 »)', () => {
  const LIGHT = { upToKg: 80, sampleSize: 1000, kg: [50, 60, 80, 100, 120, 130, 150] };
  const standards: StrengthStandards = {
    percentiles: [10, 25, 50, 75, 90, 95, 99],
    lifts: [
      { key: 'bench', sourceLift: 'bench_press', groups: ['chest'], totalLoad: false, male: [LIGHT], female: [LIGHT] },
      { key: 'incline-bench', sourceLift: 'incline_bench_press', groups: ['chest'], totalLoad: false, male: [{ ...LIGHT, kg: [40, 50, 60, 70, 80, 90, 100] }], female: [LIGHT] },
    ],
  };
  const ex = (id: string, key: string, history: readonly ExerciseSession[]): StrengthExercise => ({ id, nameFr: `Nom ${id}`, key, history });
  const score = (exercises: StrengthExercise[]) => strengthScore({ sex: 'male', bodyweightKg: 75, standards, exercises }).groups.find((g) => g.group === 'chest');

  it('développé couché à 99 pile (1RM 150 kg) et incliné au-delà de la table (« > 99 ») : le groupe dit « > 99 »', () => {
    const chest = score([ex('b', 'bench', [session(2, 100, [15])]), ex('i', 'incline-bench', [session(2, 100, [15])])]);
    expect(chest).toMatchObject({ kind: 'value', score: 99, bound: 'above' });
  });

  it('à 10 : « 10 » l’emporte sur « < 10 »', () => {
    // Incliné : 1RM 39 kg (30 × 9), sous sa table (« < 10 ») ; couché : 1RM 50 kg pile (37,5 × 10), son 10e centile.
    const chest = score([ex('i', 'incline-bench', [session(2, 30, [9])]), ex('b', 'bench', [session(2, 37.5, [10])])]);
    expect(chest).toMatchObject({ kind: 'value', score: 10, bound: null });
  });
});

describe('SEANCE-0292 C-024 (vérification) : tractions, la charge saisie est le lest ; le Strength Score ajoute le poids de corps une fois', () => {
  const ROW = { upToKg: null, sampleSize: 1000, kg: [50, 60, 80, 100, 120, 130, 150] };
  const standards: StrengthStandards = {
    percentiles: [10, 25, 50, 75, 90, 95, 99],
    lifts: [{ key: 'pull-up', sourceLift: 'pullup', groups: ['back'], totalLoad: true, male: [ROW], female: [ROW] }],
  };
  const lift = (lestKg: number) => {
    const back = strengthScore({ sex: 'male', bodyweightKg: 80, standards, exercises: [{ id: 'pull-up', nameFr: 'Tractions', key: 'pull-up', history: [session(2, lestKg, [15])] }] }).groups.find((g) => g.group === 'back');
    return back?.kind === 'value' ? back.lift.oneRmKg : null;
  };

  it('lest 0 × 15 à 80 kg : 1RM sur 80 kg (120) ; lest 10 × 15 : sur 90 kg (135), jamais 80 + 80', () => {
    expect(lift(0)).toBe(120);
    expect(lift(10)).toBe(135);
  });
});

describe('SEANCE-0292 C-025 : inactivité en jours civils ; instants comparés comme instants, pas comme chaînes', () => {
  const at = (iso: string) => iso as IsoDateTime;
  const now = at('2026-11-28T18:00:00.000Z');

  it('dernière séance le 7/11 à 20:00 UTC, maintenant le 28/11 à 18:00 : 21 jours civils (pas 20,9 tranches de 24 h) → décote d’inactivité', () => {
    const p = prescribe(input({ exercise: BENCH, now, history: [{ ...session(0, 100, [8, 8, 8]), endedAt: at('2026-11-07T20:00:00.000Z') }], target: target(8, 10) }));
    expect(p.reasons).toContain('inactivity-discount');
    expect(p.inactivityCut).toBeGreaterThan(0);
  });

  it('décalage horaire donné (UTC+1) : 7/11 23:30 heure locale (22:30 UTC) → 28/11 00:30 locale (27/11 23:30 UTC) : 21 jours civils locaux', () => {
    const hist = [{ ...session(0, 100, [8, 8, 8]), endedAt: at('2026-11-07T22:30:00.000Z') }];
    const local = prescribe(input({ exercise: BENCH, now: at('2026-11-27T23:30:00.000Z'), history: hist, target: target(8, 10), utcOffsetMinutes: 60 }));
    expect(local.reasons).toContain('inactivity-discount');
    const utc = prescribe(input({ exercise: BENCH, now: at('2026-11-27T23:30:00.000Z'), history: hist, target: target(8, 10) }));
    expect(utc.reasons).not.toContain('inactivity-discount');
  });

  it('décision prise à 18:30Z après une séance close à 19:00+01:00 (18:00Z) : la décision l’emporte (comparaison d’instants)', () => {
    const p = prescribe(
      input({
        exercise: BENCH,
        now: at('2026-11-08T10:00:00.000Z'),
        history: [{ ...session(0, 100, [8, 8, 8]), endedAt: at('2026-11-07T19:00:00.000+01:00') }],
        lastDecision: { decidedAt: at('2026-11-07T18:30:00.000Z'), accepted: false, loadKg: 90, reps: [8, 8, 8] },
        target: target(8, 10),
      }),
    );
    expect(p.headline).toBe('decision');
    expect(p.loadKg).toBe(90);
  });

  it('ordre total (relecture A) : un instant illisible toujours après les lisibles, aucun cycle a < b < c < a', () => {
    const a = '2026-11-07T19:00:00+01:00'; // 18:00Z
    const b = '2026-11-07T18:30:00Z';
    const c = '2026-11-07T18:45:00?'; // illisible ; entre b et a dans l'ordre des chaînes
    expect(compareInstants(a, b)).toBeLessThan(0);
    expect(compareInstants(b, c)).toBeLessThan(0);
    expect(compareInstants(a, c)).toBeLessThan(0);
    expect(compareInstants(c, a)).toBeGreaterThan(0);
    expect(compareInstants(c, '2026-11-07T18:44:00?')).toBeGreaterThan(0);
    expect([c, b, a].sort(compareInstants)).toEqual([a, b, c]);
  });
});

describe('SEANCE-0292 C-026 (vérification) : une décision postérieure à la dernière séance est rendue sans contrainte (I2-02, question Q-11)', () => {
  // Test rouge 2e4894f6 réécrit : la règle « l'entrée d'Ali l'emporte, jamais modulée » est voulue (I2-02, constraints.test.ts et redDay.test.ts
  // la figent) ; la réduire en décharge, pause ou journée rouge change une règle de progression : question Q-11 à Ali (docs/SEANCE-0292.md).
  const hist = [session(3, 100, [8, 8, 8])];
  const decision = { decidedAt: daysAgo(1), accepted: false, loadKg: 90, reps: [8, 8, 8] };

  it('sans contrainte, en décharge, en journée rouge : la décision est reprise telle quelle (90 kg × 8, 8, 8)', () => {
    const plain = prescribe(input({ exercise: BENCH, history: hist, lastDecision: decision, target: target(8, 10) }));
    const deload = prescribe(input({ exercise: BENCH, history: hist, lastDecision: decision, target: target(8, 10), deload: true }));
    const red = prescribe(input({ exercise: BENCH, history: hist, lastDecision: decision, target: target(8, 10), recovery: { recovery: 20, sleepHours: null, restingHrDelta: null, redDay: true } }));
    for (const p of [plain, deload, red]) {
      expect(p.headline).toBe('decision');
      expect(p.loadKg).toBe(90);
      expect(p.sets.map((x) => x.reps)).toEqual([8, 8, 8]);
      expect(p.reasons).toEqual(['decision-reference']);
    }
  });

  it('décision antérieure à la dernière séance : la séance est la référence, les contraintes s’appliquent (décharge : 80 kg, une série)', () => {
    const p = prescribe(input({ exercise: BENCH, history: hist, lastDecision: { ...decision, decidedAt: daysAgo(4) }, target: target(8, 10), deload: true }));
    expect(p.headline).toBe('deload');
    expect(p.loadKg).toBe(80);
    expect(p.sets).toHaveLength(1);
  });
});

describe('SEANCE-0292 C-027 (D-474) : « Dur » bloque seulement la hausse de charge ; l’échelle de répétitions reste libre (règle figée)', () => {
  it('plage 6–8, [8, 7, 6] « Dur » : même charge, une répétition de plus sur une série ([8, 8, 6])', () => {
    const p = prescribe(input({ exercise: BENCH, history: [session(3, 100, [8, 7, 6], { difficulty: 'hard' })], target: target(6, 8) }));
    expect(p.loadKg).toBe(100);
    expect(p.sets.map((s) => s.reps)).toEqual([8, 8, 6]);
    expect(p.headline).toBe('rep-ladder');
  });

  it('haut de plage atteint et « Dur » (ou RIR ≤ 1) : aucun cran, mêmes répétitions', () => {
    const hard = prescribe(input({ exercise: BENCH, history: [session(3, 100, [10, 10, 10], { difficulty: 'hard' })], target: target(8, 10) }));
    expect(hard.headline).toBe('hold-hard');
    expect(hard.loadKg).toBe(100);
    expect(hard.sets.map((s) => s.reps)).toEqual([10, 10, 10]);
    expect(hard.reasons).toContain('hard-blocks-increase');
  });
});

describe('SEANCE-0292 C-029 : grille de charges robuste (pile illisible, plusieurs poulies, matériel interdit)', () => {
  const base = FITNESS_PARK_ANTONY.inventory;
  const profile = (inventory: Partial<ProgressionEquipment['inventory']>): ProgressionEquipment => ({ inventory: { ...base, ...inventory }, increments: FITNESS_PARK_ANTONY.increments });

  it('machine au maximum illisible (NaN, ligne synchronisée abîmée) : aucune grille, jamais 2 000 charges', () => {
    const p = profile({ machines: [{ equipmentId: 'leg-press-machine', stackMinKg: 5, stackMaxKg: Number.NaN, stepKg: 5 }] });
    expect(loadGrid(['leg-press-machine'], p)).toBeNull();
    const step = profile({ machines: [{ equipmentId: 'leg-press-machine', stackMinKg: 5, stackMaxKg: 100, stepKg: Number.NaN }] });
    expect(loadGrid(['leg-press-machine'], step)).toBeNull();
  });

  it('deux poulies (5 à 50 par 5 ; 2,5 à 40 par 2,5) : seules les charges des deux (5 à 40 par 5), jamais 45 kg propre à une seule', () => {
    const p = profile({ cables: [{ minKg: 5, maxKg: 50, stepKg: 5 }, { minKg: 2.5, maxKg: 40, stepKg: 2.5 }] });
    expect(loadGrid(['high-pulley'], p)?.loads).toEqual([5, 10, 15, 20, 25, 30, 35, 40]);
  });

  it('matériel interdit dans le profil (barre) : il ne fournit pas la grille (le suivant, haltères, oui)', () => {
    const p = profile({ forbidden: ['barbell'] });
    expect(loadGrid(['barbell'], p)).toBeNull();
    expect(loadGrid(['barbell', 'dumbbell'], p)?.source).toBe('dumbbell');
  });
});

describe('SEANCE-0292 C-030 : échauffement d’un exercice lesté calculé sur la charge totale (corps + lest)', () => {
  const WEIGHTED = { metric: 'load-reps', equipment: ['pull-up-bar', 'loading-belt', 'dumbbell'], bodyweightFraction: 1 } as const;

  it('tractions lestées 40 kg à 80 kg de corps (total 120) : 40 % = 48 → poids du corps × 8, 60 % = 72 → poids du corps (fusionné), 80 % = 96 → lest 16 × 2', () => {
    expect(warmupForExercise(WEIGHTED, 40, FITNESS_PARK_ANTONY, undefined, 80)).toEqual([
      { loadKg: 0, reps: 8 },
      { loadKg: 16, reps: 2 },
    ]);
  });

  it('poids de corps inconnu : aucune rampe (jamais 40 % du lest seul, ≈ 95 % de la charge totale)', () => {
    expect(warmupForExercise(WEIGHTED, 40, FITNESS_PARK_ANTONY)).toEqual([]);
    expect(warmupForExercise(WEIGHTED, 40, FITNESS_PARK_ANTONY, undefined, null)).toEqual([]);
  });

  it('exercice à charge ordinaire : rampe inchangée (100 kg : 40, 60, 80)', () => {
    expect(warmupForExercise(BENCH, 100, FITNESS_PARK_ANTONY).map((s) => s.loadKg)).toEqual([40, 60, 80]);
  });
});

describe('SEANCE-0292 § 11 : constantes du moteur ajustables par exercice (surcharges bornées, tracées dans `activeConfig`)', () => {
  it('décharge à 0,9 et plafond de hausse à 5 % pour cet exercice : appliqués et tracés ; les autres constantes restent celles par défaut', () => {
    const exercise = { ...BENCH, configOverrides: { deloadLoad: 0.9, maxGainPerSession: 0.05 } };
    const deload = prescribe(input({ exercise, history: [session(3, 100, [10, 10, 10])], target: target(8, 10), deload: true }));
    expect(deload.loadKg).toBe(90);
    expect(deload.activeConfig.deloadLoad).toBe(0.9);
    expect(deload.activeConfig.maxGainPerSession).toBe(0.05);
    expect(deload.activeConfig.snapTolerance).toBe(0.03);
  });

  it('surcharge illisible ou hors bornes (NaN, négative, clé inconnue, liste) : ignorée, valeur par défaut', () => {
    const exercise = { ...BENCH, configOverrides: { deloadLoad: Number.NaN, maxGainPerSession: -1, recencyWeights: [5], bogus: 3 } as never };
    const p = prescribe(input({ exercise, history: [session(3, 100, [10, 10, 10])], target: target(8, 10), deload: true }));
    expect(p.loadKg).toBe(80);
    expect(p.activeConfig.deloadLoad).toBe(0.8);
    expect(p.activeConfig.maxGainPerSession).toBe(0.1);
    expect(p.activeConfig.recencyWeights).toEqual([1, 0.6, 0.3]);
  });

  it('la décharge de cycle (deloadLoad de l’entrée, 4 ou 6 semaines) l’emporte sur la surcharge de l’exercice', () => {
    const exercise = { ...BENCH, configOverrides: { deloadLoad: 0.7 } };
    const p = prescribe(input({ exercise, history: [session(3, 100, [10, 10, 10])], target: target(8, 10), deload: true, deloadLoad: 0.9 }));
    expect(p.loadKg).toBe(90);
  });
});
