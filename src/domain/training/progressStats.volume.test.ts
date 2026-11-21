import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { DEFAULT_PROGRESS_CONFIG } from './config';
import { weeklyMuscleVolume, type ProgressWorkout } from './progressStats';
import type { MuscleWeight } from './types';

/** PROGRES-a (§ 17.1 « Volume », § 14.1 poids des muscles) : séries validées par muscle et par semaine, 8 semaines glissantes. Valeurs synthétiques. */

const d = (s: string): LocalDate => s as LocalDate;
const MUSCLES: Readonly<Record<string, readonly MuscleWeight[]>> = {
  bench: [
    { id: 'chest', weight: 1 },
    { id: 'triceps', weight: 0.5 },
    { id: 'front-delts', weight: 0.3 },
  ],
  row: [
    { id: 'lats', weight: 1 },
    { id: 'biceps', weight: 0.5 },
  ],
  plank: [{ id: 'abs', weight: 1 }],
};
const musclesOf = (id: string): readonly MuscleWeight[] | null => MUSCLES[id] ?? null;
const set = (exerciseId: string, setKind: ProgressWorkout['sets'][number]['setKind'] = 'work', done = true) => ({ exerciseId, setKind, done });

describe('weeklyMuscleVolume', () => {
  it('compte les séries validées de travail et chrono, pondérées par le poids du muscle (§ 14.1), sur 8 semaines du lundi', () => {
    const workouts: ProgressWorkout[] = [
      { day: d('2026-11-16'), sets: [set('bench', 'warmup'), set('bench'), set('bench'), set('bench'), set('plank', 'timed')] },
      { day: d('2026-11-18'), sets: [set('row'), set('row', 'work', false), set('row', 'drop'), set('row', 'partial')] },
      // Semaine précédente (lundi 9) et hors fenêtre (plus de 8 semaines).
      { day: d('2026-11-15'), sets: [set('bench')] },
      { day: d('2026-09-20'), sets: [set('bench')] },
    ];
    const v = weeklyMuscleVolume({ workouts, musclesOf, today: d('2026-11-18') });
    expect(v.weekStarts).toHaveLength(DEFAULT_PROGRESS_CONFIG.volumeWeeks);
    expect(v.weekStarts[0]).toBe('2026-09-28');
    expect(v.weekStarts.at(-1)).toBe('2026-11-16');
    const of = (id: string) => v.muscles.find((m) => m.muscleId === id);
    expect(of('chest')?.perWeek).toEqual([0, 0, 0, 0, 0, 0, 1, 3]);
    expect(of('chest')?.total).toBe(4);
    expect(of('triceps')?.perWeek.at(-1)).toBe(1.5);
    expect(of('front-delts')?.perWeek.at(-1)).toBe(0.9);
    expect(of('lats')?.perWeek.at(-1)).toBe(1);
    expect(of('biceps')?.perWeek.at(-1)).toBe(0.5);
    expect(of('abs')?.perWeek.at(-1)).toBe(1);
    expect(v.muscles.map((m) => m.muscleId)).toEqual(['chest', 'triceps', 'front-delts', 'abs', 'lats', 'biceps']);
    expect(v.unknownSets).toBe(0);
  });

  it('début de semaine réglable ; exercice inconnu compté à part ; aucune séance : liste vide, jamais de faux zéro par muscle', () => {
    const workouts: ProgressWorkout[] = [{ day: d('2026-11-15'), sets: [set('bench'), set('ghost'), set('ghost', 'work', false)] }];
    const sunday = weeklyMuscleVolume({ workouts, musclesOf, today: d('2026-11-18'), firstWeekday: 'sunday' });
    expect(sunday.weekStarts.at(-1)).toBe('2026-11-15');
    expect(sunday.muscles.find((m) => m.muscleId === 'chest')?.perWeek.at(-1)).toBe(1);
    expect(sunday.unknownSets).toBe(1);
    expect(weeklyMuscleVolume({ workouts: [], musclesOf, today: d('2026-11-18') }).muscles).toEqual([]);
  });

  it('somme sans dérive flottante (dixième) et entrée inchangée', () => {
    const workouts: ProgressWorkout[] = [{ day: d('2026-11-17'), sets: Array.from({ length: 10 }, () => set('bench')) }];
    const frozen = JSON.stringify(workouts);
    const v = weeklyMuscleVolume({ workouts, musclesOf, today: d('2026-11-18'), weeks: 2 });
    expect(v.weekStarts).toEqual(['2026-11-09', '2026-11-16']);
    expect(v.muscles.find((m) => m.muscleId === 'front-delts')?.perWeek).toEqual([0, 3]);
    expect(JSON.stringify(workouts)).toBe(frozen);
  });
});
