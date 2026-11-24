import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkoutSet } from '../../../domain/training';
import { HistorySetRow, type HistorySetRowProps } from './HistorySetRow';

/** SEANCE-0292 (C-072) : correction d'une série d'une séance close, charge d'un exercice à charge jamais vidée. */
const set = {
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
  loadKg: 80,
  durationSec: null,
  rir: null,
  done: true,
  doneAt: '2026-11-20T17:10:00.000Z',
  correctedAt: null,
} as unknown as WorkoutSet;

describe('C-072 : charge vidée à la correction', () => {
  it('exercice à charge : vider la charge est refusé avec un message, rien n’est envoyé', async () => {
    const onCorrect = vi.fn(async () => true);
    const props = { set, number: 1, timedExercise: false, busy: false, onCorrect, metric: 'load-reps' } as HistorySetRowProps & { metric: string };
    render(
      <ol>
        <HistorySetRow {...props} />
      </ol>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Corriger' }));
    fireEvent.change(screen.getByLabelText('Charge (kg)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la correction' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/charge/i);
    expect(onCorrect).not.toHaveBeenCalled();
  });
});
