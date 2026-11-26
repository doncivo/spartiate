import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkoutSet } from '../../../domain/training';
import { HistorySetRow } from './HistorySetRow';

/** SEANCE-0299 (BL-176, D-659, Q-13 B ; C-072, § 13.4, § 13.8 c) : la valeur d'avant la dernière correction est affichée au journal. Valeurs inventées. */
const base = {
  id: 's1',
  workoutId: 'w1',
  exerciseId: 'bench-press-barbell',
  exerciseName: 'Exercice synthétique',
  position: 0,
  setKind: 'work',
  targetRepsMin: 8,
  targetRepsMax: 10,
  targetLoadKg: null,
  targetRestSec: null,
  reps: 8,
  loadKg: 82.5,
  durationSec: null,
  rir: null,
  done: true,
  doneAt: '2026-11-20T17:10:00.000Z',
  correctedAt: '2026-11-21T08:00:00.000Z',
  correctedFrom: { reps: 8, loadKg: 80, durationSec: null, rir: null },
} as unknown as WorkoutSet;

const show = (over: Partial<WorkoutSet>, held: 1 | 2 | null = null): void => {
  render(
    <ol>
      <HistorySetRow set={{ ...base, ...over }} number={1} timedExercise={false} held={held} busy={false} onCorrect={vi.fn(async () => true)} />
    </ol>,
  );
};

describe('BL-176 : « corrigée : 80 → 82,5 kg » au journal', () => {
  it('charge corrigée : valeur d’avant, flèche, virgule décimale et unité', () => {
    show({});
    expect(screen.getByText('corrigée : 80 → 82,5 kg')).toBeInTheDocument();
  });

  it('charge et répétitions corrigées : les deux, séparées par « ; »', () => {
    show({ reps: 10 });
    expect(screen.getByText('corrigée : 80 → 82,5 kg ; 8 → 10 répétitions')).toBeInTheDocument();
  });

  it('RIR et durée : « RIR 2 → 3 », « 30 → 45 s »', () => {
    show({ reps: null, durationSec: 45, loadKg: null, rir: 3, correctedFrom: { reps: null, loadKg: null, durationSec: 30, rir: 2 } });
    expect(screen.getByText('corrigée : 30 → 45 s ; RIR 2 → 3')).toBeInTheDocument();
  });

  it('deux haltères tenus : « 2 × 26 → 2 × 28 kg »', () => {
    show({ loadKg: 28, correctedFrom: { reps: 8, loadKg: 26, durationSec: null, rir: null } }, 2);
    expect(screen.getByText('corrigée : 2 × 26 → 2 × 28 kg')).toBeInTheDocument();
  });

  it('valeur d’avant absente : « — »', () => {
    show({ correctedFrom: { reps: 8, loadKg: null, durationSec: null, rir: null } });
    expect(screen.getByText('corrigée : — → 82,5 kg')).toBeInTheDocument();
  });

  it('aucune valeur d’avant connue, ou valeurs identiques (validation retirée) : « corrigée » seul', () => {
    show({ correctedFrom: null });
    expect(screen.getByText('corrigée')).toBeInTheDocument();
  });

  it('valeurs identiques : « corrigée » seul', () => {
    show({ correctedFrom: { reps: 8, loadKg: 82.5, durationSec: null, rir: null } });
    expect(screen.getByText('corrigée')).toBeInTheDocument();
  });
});
