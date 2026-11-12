import { describe, expect, it } from 'vitest';
import { setRow } from '../../../tests/fixtures/training/workout';
import { REPLAY_REST_TOLERANCE_SEC, replayWorkout } from './replay';
import type { WorkoutSet } from './session';
import type { IsoDateTime } from '../types';

/**
 * I6-03b (§ 13.8 « Replay set par set », constat 11 de la relecture Codex du 12/11) : déroulé chronologique d'une séance passée, série par série,
 * dans l'ordre RÉEL d'exécution (instants de validation), repos réel face à la cible, écarts en catégories (le texte est à l'écran). Un instant
 * manquant donne un repos INCONNU, jamais 0. Vecteurs synthétiques.
 */
const at = (hhmmss: string): IsoDateTime => `2026-11-10T${hhmmss}.000Z` as IsoDateTime;
let n = 0;
const s = (over: Partial<WorkoutSet>): WorkoutSet => {
  n += 1;
  return setRow(0, { id: `s-${String(n).padStart(2, '0')}`, done: true, reps: 8, loadKg: 60, targetLoadKg: 60, targetRepsMin: 6, targetRepsMax: 10, targetRestSec: 120, ...over });
};
const ids = (sets: readonly WorkoutSet[]) => replayWorkout({ sets }).steps.map((step) => step.set.id);

describe('ordre réel d’exécution', () => {
  it('trié par instant de validation, pas par position', () => {
    const a = s({ position: 0, doneAt: at('18:10:00') });
    const b = s({ position: 1, doneAt: at('18:00:00') });
    const c = s({ position: 2, doneAt: at('18:05:00') });
    expect(ids([a, b, c])).toEqual([b.id, c.id, a.id]);
    expect(replayWorkout({ sets: [a, b, c] }).steps.map((step) => step.order)).toEqual([1, 2, 3]);
  });

  it('instants égaux : ordre des positions', () => {
    const a = s({ position: 1, doneAt: at('18:00:00') });
    const b = s({ position: 0, doneAt: at('18:00:00') });
    expect(ids([a, b])).toEqual([b.id, a.id]);
  });

  it('série validée sans instant : placée juste après la série datée qui la précède dans la séance (en tête s’il n’y en a pas)', () => {
    const a = s({ position: 0, doneAt: at('18:05:00') });
    const b = s({ position: 1, doneAt: at('18:00:00') });
    const c = s({ position: 2, doneAt: null });
    const d = s({ position: 3, doneAt: at('18:10:00') });
    expect(ids([a, b, c, d])).toEqual([b.id, c.id, a.id, d.id]);
    const first = s({ position: 0, doneAt: null });
    const second = s({ position: 1, doneAt: at('18:00:00') });
    expect(ids([second, first])).toEqual([first.id, second.id]);
  });

  it('séries non validées : absentes du déroulé, comptées ; instants manquants comptés', () => {
    const replay = replayWorkout({ sets: [s({ position: 0, doneAt: at('18:00:00') }), s({ position: 1, done: false, reps: null, doneAt: null }), s({ position: 2, doneAt: null })] });
    expect(replay.steps).toHaveLength(2);
    expect(replay.notDone).toBe(1);
    expect(replay.missingInstants).toBe(1);
  });

  it('numéro de série par exercice (échauffement à part) et tour d’un groupe', () => {
    const w = s({ position: 0, setKind: 'warmup', doneAt: at('17:55:00'), targetRestSec: null });
    const a1 = s({ position: 1, exerciseId: 'a', circuitId: 'g', circuitRestSec: 0, doneAt: at('18:00:00') });
    const b1 = s({ position: 2, exerciseId: 'b', circuitId: 'g', circuitRestSec: 0, doneAt: at('18:01:00') });
    const a2 = s({ position: 3, exerciseId: 'a', circuitId: 'g', circuitRestSec: 0, doneAt: at('18:03:00') });
    const b2 = s({ position: 4, exerciseId: 'b', circuitId: 'g', circuitRestSec: 0, doneAt: at('18:04:00') });
    const steps = replayWorkout({ sets: [w, a1, b1, a2, b2] }).steps;
    expect(steps.map((step) => [step.setNumber, step.round])).toEqual([
      [null, null],
      [1, 1],
      [1, 1],
      [2, 2],
      [2, 2],
    ]);
  });
});

describe('repos réel face à la cible', () => {
  it('repos = d’une validation à la suivante (secondes) ; écart au-delà de la tolérance : plus long ou plus court ; dans la tolérance : conforme', () => {
    expect(REPLAY_REST_TOLERANCE_SEC).toBe(15);
    const sets = [s({ position: 0, doneAt: at('18:00:00') }), s({ position: 1, doneAt: at('18:03:00') }), s({ position: 2, doneAt: at('18:04:30') }), s({ position: 3, doneAt: at('18:06:40') })];
    const rests = replayWorkout({ sets }).steps.map((step) => step.rest);
    expect(rests[0]).toEqual({ actualSec: 180, targetSec: 120, deviation: 'longer', deltaSec: 60 });
    expect(rests[1]).toEqual({ actualSec: 90, targetSec: 120, deviation: 'shorter', deltaSec: -30 });
    expect(rests[2]).toEqual({ actualSec: 130, targetSec: 120, deviation: 'onTarget', deltaSec: 10 });
    expect(rests[3]).toEqual({ actualSec: null, targetSec: null, deviation: 'last', deltaSec: null });
  });

  it('tolérance comprise : 15 s d’écart reste conforme, 16 s ne l’est plus', () => {
    const sets = [s({ position: 0, doneAt: at('18:00:00') }), s({ position: 1, doneAt: at('18:02:15') }), s({ position: 2, doneAt: at('18:04:31') })];
    expect(replayWorkout({ sets }).steps.map((step) => step.rest.deviation)).toEqual(['onTarget', 'longer', 'last']);
  });

  it('instant manquant d’un côté ou de l’autre : repos INCONNU (null), jamais 0', () => {
    const sets = [s({ position: 0, doneAt: at('18:00:00') }), s({ position: 1, doneAt: null }), s({ position: 2, doneAt: at('18:06:00') })];
    const rests = replayWorkout({ sets }).steps.map((step) => step.rest);
    expect(rests[0]).toEqual({ actualSec: null, targetSec: 120, deviation: 'unknown', deltaSec: null });
    expect(rests[1]).toEqual({ actualSec: null, targetSec: 120, deviation: 'unknown', deltaSec: null });
    expect(rests.every((r) => r.actualSec !== 0)).toBe(true);
  });

  it('deux validations au même instant : repos réel de 0 s (mesuré), pas inconnu', () => {
    const sets = [s({ position: 0, doneAt: at('18:00:00') }), s({ position: 1, doneAt: at('18:00:00') })];
    expect(replayWorkout({ sets }).steps[0]?.rest).toEqual({ actualSec: 0, targetSec: 120, deviation: 'shorter', deltaSec: -120 });
  });

  it('série suivante chronométrée : sa durée est retirée de l’intervalle (au plus jusqu’à 0)', () => {
    const sets = [s({ position: 0, doneAt: at('18:00:00') }), s({ position: 1, setKind: 'timed', reps: null, durationSec: 60, targetRepsMin: 60, targetRepsMax: 60, doneAt: at('18:03:00') })];
    expect(replayWorkout({ sets }).steps[0]?.rest).toMatchObject({ actualSec: 120, deviation: 'onTarget' });
    const tight = [s({ position: 0, doneAt: at('18:00:00') }), s({ position: 1, setKind: 'timed', reps: null, durationSec: 90, doneAt: at('18:01:00') })];
    expect(replayWorkout({ sets: tight }).steps[0]?.rest.actualSec).toBe(0);
  });

  it('cible absente : écart « sans cible », repos réel tout de même donné', () => {
    const sets = [s({ position: 0, targetRestSec: null, doneAt: at('18:00:00') }), s({ position: 1, doneAt: at('18:02:00') })];
    expect(replayWorkout({ sets }).steps[0]?.rest).toEqual({ actualSec: 120, targetSec: null, deviation: 'noTarget', deltaSec: null });
  });

  it('groupe : entre deux exercices d’un même tour, la cible est le repos du groupe (0 = aucun) ; en fin de tour, le repos de la série', () => {
    const a1 = s({ position: 0, exerciseId: 'a', circuitId: 'g', circuitRestSec: 10, targetRestSec: 90, doneAt: at('18:00:00') });
    const b1 = s({ position: 1, exerciseId: 'b', circuitId: 'g', circuitRestSec: 10, targetRestSec: 90, doneAt: at('18:00:40') });
    const a2 = s({ position: 2, exerciseId: 'a', circuitId: 'g', circuitRestSec: 10, targetRestSec: 90, doneAt: at('18:02:10') });
    const b2 = s({ position: 3, exerciseId: 'b', circuitId: 'g', circuitRestSec: 0, targetRestSec: 90, doneAt: at('18:02:20') });
    const rests = replayWorkout({ sets: [a1, b1, a2, b2] }).steps.map((step) => [step.rest.targetSec, step.rest.deviation]);
    expect(rests).toEqual([
      [10, 'longer'],
      [90, 'onTarget'],
      [10, 'onTarget'],
      [null, 'last'],
    ]);
  });
});

describe('charge et répétitions face aux cibles', () => {
  it('charge : au-dessus, en dessous, conforme, sans cible, non saisie ; écart arrondi au centième', () => {
    const load = (over: Partial<WorkoutSet>) => replayWorkout({ sets: [s({ position: 0, doneAt: at('18:00:00'), ...over })] }).steps[0]?.load;
    expect(load({ loadKg: 62.5, targetLoadKg: 60 })).toEqual({ actual: 62.5, target: 60, deviation: 'above', delta: 2.5 });
    expect(load({ loadKg: 57.5, targetLoadKg: 60 })).toEqual({ actual: 57.5, target: 60, deviation: 'below', delta: -2.5 });
    expect(load({ loadKg: 60, targetLoadKg: 60 })).toEqual({ actual: 60, target: 60, deviation: 'onTarget', delta: 0 });
    expect(load({ loadKg: 0.1 + 0.2, targetLoadKg: 0.3 })).toMatchObject({ deviation: 'onTarget', delta: 0 });
    expect(load({ loadKg: 60, targetLoadKg: null })).toEqual({ actual: 60, target: null, deviation: 'noTarget', delta: null });
    expect(load({ loadKg: null, targetLoadKg: 60 })).toEqual({ actual: null, target: 60, deviation: 'noValue', delta: null });
  });

  it('répétitions : dans la plage conforme, en dessous de la borne basse, au-dessus de la borne haute ; borne seule ; sans cible', () => {
    const effort = (over: Partial<WorkoutSet>) => replayWorkout({ sets: [s({ position: 0, doneAt: at('18:00:00'), ...over })] }).steps[0]?.effort;
    expect(effort({ reps: 8, targetRepsMin: 6, targetRepsMax: 10 })).toEqual({ measure: 'reps', actual: 8, targetMin: 6, targetMax: 10, deviation: 'onTarget', delta: 0 });
    expect(effort({ reps: 5, targetRepsMin: 6, targetRepsMax: 10 })).toMatchObject({ deviation: 'below', delta: -1 });
    expect(effort({ reps: 12, targetRepsMin: 6, targetRepsMax: 10 })).toMatchObject({ deviation: 'above', delta: 2 });
    expect(effort({ reps: 12, targetRepsMin: 8, targetRepsMax: null })).toMatchObject({ deviation: 'onTarget', delta: 0 });
    expect(effort({ reps: 8, targetRepsMin: null, targetRepsMax: null })).toMatchObject({ deviation: 'noTarget', delta: null });
    expect(effort({ reps: null, targetRepsMin: 6, targetRepsMax: 10 })).toMatchObject({ deviation: 'noValue', delta: null });
  });

  it('série chronométrée : durée face à la cible (portée par les bornes de répétitions, comme la saisie)', () => {
    const effort = replayWorkout({ sets: [s({ position: 0, setKind: 'timed', reps: null, durationSec: 40, targetRepsMin: 45, targetRepsMax: 45, doneAt: at('18:00:00') })] }).steps[0]?.effort;
    expect(effort).toEqual({ measure: 'duration', actual: 40, targetMin: 45, targetMax: 45, deviation: 'below', delta: -5 });
  });
});

describe('séance vide', () => {
  it('aucune série validée : déroulé vide', () => {
    expect(replayWorkout({ sets: [] })).toEqual({ steps: [], notDone: 0, missingInstants: 0 });
  });
});
