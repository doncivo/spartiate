import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkoutSet } from '../../../domain/training';
import * as training from '../../../domain/training';
import { SetRow, type SetRowProps } from './SetRow';

/** SEANCE-0292 (partie B) : série de la séance active. */
const base = {
  workoutId: 'w1',
  exerciseId: 'pull-up',
  exerciseName: 'Exercice synthétique',
  setKind: 'work',
  targetRepsMin: null,
  targetRepsMax: null,
  targetLoadKg: null,
  targetRestSec: null,
  reps: null,
  loadKg: null,
  durationSec: null,
  rir: null,
  done: false,
  doneAt: null,
};
const make = (over: Partial<WorkoutSet> = {}) => ({ ...base, id: 's1', position: 0, ...over }) as unknown as WorkoutSet;
const row = (props: Partial<SetRowProps> & Record<string, unknown>) =>
  render(
    <ol>
      <SetRow set={make()} number={1} timed={false} source="routine" busy={false} onValidate={vi.fn()} onUnvalidate={vi.fn()} onKind={vi.fn()} onRemove={vi.fn()} {...props} />
    </ol>,
  );

describe('C-071 : tractions et dips, le champ dit « lest » (le poids de corps est compté à part)', () => {
  it('le domaine classe le champ de charge : lest (poids du corps, lesté), assistance (assisté), charge (sinon)', () => {
    const fieldOf = (training as unknown as { loadFieldOf?: (e: Pick<training.ExerciseBase, 'id' | 'metric' | 'equipment' | 'bodyweightFraction'>) => string }).loadFieldOf;
    expect(typeof fieldOf).toBe('function');
    if (fieldOf === undefined) return;
    expect(fieldOf({ id: 'pull-up', metric: 'bodyweight-reps', equipment: ['pull-up-bar'], bodyweightFraction: null })).toBe('ballast');
    expect(fieldOf({ id: 'push-up-weighted', metric: 'load-reps', equipment: ['bodyweight', 'loading-belt'], bodyweightFraction: 0.64 })).toBe('ballast');
    expect(fieldOf({ id: 'pull-up-assisted', metric: 'bodyweight-reps', equipment: ['assisted-pull-up-machine'], bodyweightFraction: null })).toBe('assistance');
    expect(fieldOf({ id: 'bench-press-barbell', metric: 'load-reps', equipment: ['barbell'], bodyweightFraction: null })).toBe('load');
  });

  it('lest : libellé « Lest (kg) » et aide « poids du corps non compris » ; assistance : « Assistance (kg) » ; défaut : « Charge (kg) »', () => {
    const { unmount } = row({ loadField: 'ballast' });
    expect(screen.getByLabelText('Lest (kg)')).toBeInTheDocument();
    expect(screen.getByText(/poids du corps non compris/i)).toBeInTheDocument();
    unmount();
    const second = row({ loadField: 'assistance' });
    expect(screen.getByLabelText('Assistance (kg)')).toBeInTheDocument();
    second.unmount();
    row({});
    expect(screen.getByLabelText('Charge (kg)')).toBeInTheDocument();
  });
});

describe('C-080 : type de série parcouru au clavier', () => {
  it('flèches dans « Type » : rien n’est écrit pendant le parcours ; écrit une fois, la dernière valeur, à la sortie du champ', () => {
    const onKind = vi.fn();
    row({ onKind });
    const select = screen.getByLabelText('Type de série');
    for (const value of ['failure', 'warmup', 'drop']) {
      fireEvent.keyDown(select, { key: 'ArrowDown' });
      fireEvent.change(select, { target: { value } });
    }
    expect(onKind).not.toHaveBeenCalled();
    fireEvent.blur(select);
    expect(onKind).toHaveBeenCalledTimes(1);
    expect(onKind).toHaveBeenCalledWith('drop');
  });

  it('choix au doigt ou à la souris (sans flèche) : écrit aussitôt, comme avant', () => {
    const onKind = vi.fn();
    row({ onKind });
    fireEvent.change(screen.getByLabelText('Type de série'), { target: { value: 'warmup' } });
    expect(onKind).toHaveBeenCalledWith('warmup');
  });
});
