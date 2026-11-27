import { describe, expect, it } from 'vitest';
import { summarizeWorkout, workoutDurationSec, type WorkoutSet, type WorkoutWithSets } from './index';
import { healthWorkoutOf, STRENGTH_TRAINING_MET } from './healthWorkout';
import { effectiveElapsedMs, endPause, isPaused, pausedMsAt, startPause } from './pause';
import { replayWorkout } from './replay';

/**
 * SESS-0302 (BL-110, D-658, § 13.2) : vraie pause de séance. Durée effective = fin − début − cumul des pauses (− pause en cours) ; elle sert au chrono,
 * au résumé, à l'énergie envoyée à Apple Santé et au replay. Une ligne d'avant la migration 0024 (sans les deux champs) vaut 0. Valeurs inventées.
 */
const T0 = Date.parse('2026-11-27T17:00:00.000Z');
const iso = (min: number): string => new Date(T0 + min * 60_000).toISOString();
const MIN = 60_000;

describe('pause.ts : cumul, pause en cours, durée effective', () => {
  it('sans champ (ancienne ligne) : aucune pause, cumul 0', () => {
    expect(isPaused({})).toBe(false);
    expect(pausedMsAt({}, T0)).toBe(0);
    expect(pausedMsAt({ pausedAt: null, pausedMs: null }, T0)).toBe(0);
    expect(effectiveElapsedMs({ startedAt: iso(0), endedAt: null }, T0 + 30 * MIN)).toBe(30 * MIN);
  });

  it('pause en cours : comptée jusqu’à maintenant, ajoutée au cumul ; chrono figé pendant la pause', () => {
    const w = { startedAt: iso(0), endedAt: null, pausedAt: iso(20), pausedMs: 5 * MIN };
    expect(isPaused(w)).toBe(true);
    expect(pausedMsAt(w, T0 + 30 * MIN)).toBe(15 * MIN);
    expect(effectiveElapsedMs(w, T0 + 30 * MIN)).toBe(15 * MIN);
    expect(effectiveElapsedMs(w, T0 + 50 * MIN)).toBe(15 * MIN);
  });

  it('plusieurs pauses : chaque reprise ajoute sa durée au cumul ; pause déjà prise : inchangée ; reprise sans pause : inchangée', () => {
    let s = startPause({ pausedAt: null, pausedMs: 0 }, T0 + 10 * MIN);
    expect(s).toEqual({ pausedAt: iso(10), pausedMs: 0 });
    expect(startPause(s, T0 + 12 * MIN)).toEqual(s);
    s = endPause(s, T0 + 14 * MIN);
    expect(s).toEqual({ pausedAt: null, pausedMs: 4 * MIN });
    expect(endPause(s, T0 + 15 * MIN)).toEqual(s);
    s = endPause(startPause(s, T0 + 30 * MIN), T0 + 36 * MIN);
    expect(s).toEqual({ pausedAt: null, pausedMs: 10 * MIN });
    expect(effectiveElapsedMs({ startedAt: iso(0), endedAt: iso(60), ...s }, T0 + 90 * MIN)).toBe(50 * MIN);
  });

  it('horloge reculée ou instant illisible : jamais de durée négative, jamais NaN', () => {
    expect(endPause({ pausedAt: iso(10), pausedMs: 2 * MIN }, T0 + 5 * MIN)).toEqual({ pausedAt: null, pausedMs: 2 * MIN });
    expect(pausedMsAt({ pausedAt: 'oups', pausedMs: 3 * MIN }, T0)).toBe(3 * MIN);
    expect(effectiveElapsedMs({ startedAt: iso(0), endedAt: null, pausedMs: 90 * MIN }, T0 + 30 * MIN)).toBe(0);
    expect(effectiveElapsedMs({ startedAt: 'oups', endedAt: null }, T0)).toBeNull();
  });
});

const set = (n: number, doneMin: number | null, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `s${String(n)}`,
  workoutId: 'w',
  exerciseId: 'bench-press-barbell',
  exerciseName: 'Développé couché',
  position: n,
  setKind: 'work',
  targetRepsMin: 8,
  targetRepsMax: 10,
  targetLoadKg: 80,
  targetRestSec: 120,
  reps: 8,
  loadKg: 80,
  durationSec: null,
  rir: null,
  done: doneMin !== null,
  doneAt: doneMin === null ? null : (iso(doneMin) as WorkoutSet['doneAt']),
  createdAt: iso(0) as WorkoutSet['createdAt'],
  updatedAt: iso(0) as WorkoutSet['updatedAt'],
  deletedAt: null,
  deviceId: 'd' as WorkoutSet['deviceId'],
  hlc: 'h' as WorkoutSet['hlc'],
  ...extra,
});
const closed = (pausedMs: number | undefined, sets: WorkoutSet[] = [set(0, 2), set(1, 4)]): WorkoutWithSets =>
  ({
    id: 'w',
    routineId: null,
    routineDayId: null,
    name: 'Séance',
    startedAt: iso(0),
    endedAt: iso(60),
    source: 'empty',
    copiedFromWorkoutId: null,
    restTimerEndAt: null,
    restTimerSeconds: 0,
    notes: '',
    createdAt: iso(0),
    updatedAt: iso(60),
    deletedAt: null,
    deviceId: 'd',
    hlc: 'h',
    ...(pausedMs === undefined ? {} : { pausedAt: null, pausedMs }),
    sets,
  }) as unknown as WorkoutWithSets;

describe('résumé et durée d’une séance close', () => {
  it('durée = fin − début − cumul ; ancienne séance sans champ : durée brute', () => {
    expect(workoutDurationSec(closed(undefined))).toBe(3600);
    expect(workoutDurationSec(closed(0))).toBe(3600);
    expect(workoutDurationSec(closed(15 * MIN))).toBe(2700);
    expect(summarizeWorkout(closed(15 * MIN)).durationSec).toBe(2700);
  });

  it('pause restée ouverte sur une séance close (base ancienne, import) : comptée jusqu’à la fin, pas au-delà', () => {
    const w = { ...closed(5 * MIN), pausedAt: iso(50) } as WorkoutWithSets;
    expect(workoutDurationSec(w)).toBe(3600 - 15 * 60);
  });
});

describe('Apple Santé : HKWorkout traditionalStrengthTraining, énergie sur la durée effective', () => {
  it('début et fin réels, énergie = MET × kg × heures effectives (arrondie) ; sans poids : énergie inconnue ; séance ouverte : rien', () => {
    const payload = healthWorkoutOf(closed(15 * MIN), 80);
    expect(payload).toEqual({ activity: 'traditionalStrengthTraining', startedAt: iso(0), endedAt: iso(60), activeSec: 2700, energyKcal: Math.round(STRENGTH_TRAINING_MET * 80 * 0.75) });
    expect(healthWorkoutOf(closed(0), 80)?.energyKcal).toBe(Math.round(STRENGTH_TRAINING_MET * 80));
    expect(healthWorkoutOf(closed(15 * MIN), null)?.energyKcal).toBeNull();
    expect(healthWorkoutOf(closed(15 * MIN), 0)?.energyKcal).toBeNull();
    expect(healthWorkoutOf({ ...closed(0), endedAt: null }, 80)).toBeNull();
  });
});

describe('replay : la pause est retirée du repos qui la contient', () => {
  it('un seul repos assez long pour la contenir : pause retirée de ce repos, signalée ; les autres inchangés', () => {
    const r = replayWorkout(closed(10 * MIN, [set(0, 2), set(1, 4), set(2, 16), set(3, 18)]));
    expect(r.steps.map((s) => s.rest.actualSec)).toEqual([120, 120, 120, null]);
    expect(r.steps.map((s) => s.rest.pausedSec ?? 0)).toEqual([0, 600, 0, 0]);
    expect(r.pause).toEqual({ pausedSec: 600, placed: true });
  });

  it('aucun ou plusieurs repos possibles : rien n’est retiré au hasard, la pause est dite non située', () => {
    const several = replayWorkout(closed(3 * MIN, [set(0, 2), set(1, 8), set(2, 14)]));
    expect(several.steps.map((s) => s.rest.actualSec)).toEqual([360, 360, null]);
    expect(several.pause).toEqual({ pausedSec: 180, placed: false });
    const none = replayWorkout(closed(30 * MIN, [set(0, 2), set(1, 4)]));
    expect(none.pause).toEqual({ pausedSec: 1800, placed: false });
  });

  it('sans pause ou ancienne séance : déroulé inchangé, aucune mention', () => {
    expect(replayWorkout(closed(undefined)).pause).toBeUndefined();
    expect(replayWorkout(closed(0)).pause).toBeUndefined();
    expect(replayWorkout(closed(0)).steps.map((s) => s.rest.actualSec)).toEqual([120, null]);
  });
});
