import { describe, expect, it } from 'vitest';
import { dayExertion } from './exertion';
import type { RecoverySet, RecoveryWorkout } from './types';

/** NUTRI-0292 (C-051) : une séance à date illisible ne fait jamais planter l'Exertion du jour. Valeurs inventées. */
const TZ = 'Europe/Paris';
const set = (over: Partial<RecoverySet> = {}): RecoverySet => ({ kg: 100, reps: 10, difficulty: 'ok', isWarmup: false, completed: true, muscles: [{ id: 'quads', weight: 1 }], ...over });

describe('C-051 : séance à date illisible', () => {
  it('ignorée, les autres séances du jour comptent', () => {
    const good: RecoveryWorkout = { endedAt: '2026-11-07T17:00:00.000Z', sets: [set()] };
    const broken: RecoveryWorkout = { endedAt: 'pas une date', sets: [set()] };
    expect(() => dayExertion([broken, good], '2026-11-07', TZ)).not.toThrow();
    expect(dayExertion([broken, good], '2026-11-07', TZ)).toEqual(dayExertion([good], '2026-11-07', TZ));
  });

  it('chaîne vide : ignorée aussi', () => {
    expect(dayExertion([{ endedAt: '', sets: [set()] }], '2026-11-07', TZ).value).toBe(0);
  });
});

describe('relecture A : répétitions infinies', () => {
  it('une série à répétitions infinies ne rend jamais une Exertion infinie : ignorée comme une valeur illisible', () => {
    const w: RecoveryWorkout = { endedAt: '2026-11-07T17:00:00.000Z', sets: [set({ reps: Number.POSITIVE_INFINITY }), set()] };
    const r = dayExertion([w], '2026-11-07', TZ);
    expect(Number.isFinite(r.value)).toBe(true);
    expect(r.value).toBe(dayExertion([{ ...w, sets: [set()] }], '2026-11-07', TZ).value);
  });
});
