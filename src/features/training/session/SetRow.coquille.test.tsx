import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkoutSet } from '../../../domain/training';
import { tTraining } from '../../../i18n/trainingText';
import { SetRow } from './SetRow';

/** FIX-COQUILLE (C-068) : retrait d'une série saisie confirmé ; focus conservé après validation au clavier. */
const base = {
  workoutId: 'w1',
  exerciseId: 'bench-press-barbell',
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
const make = (id: string, position: number, done = false) => ({ ...base, id, position, done }) as unknown as WorkoutSet;

describe('C-068 : retrait d’une série', () => {
  it('série intacte : retirée sans question', () => {
    const onRemove = vi.fn();
    render(
      <ol>
        <SetRow set={make('s1', 0)} number={1} timed={false} source="routine" busy={false} onValidate={vi.fn()} onUnvalidate={vi.fn()} onKind={vi.fn()} onRemove={onRemove} />
      </ol>,
    );
    fireEvent.click(screen.getByRole('button', { name: tTraining('sessionRemoveSet') }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('série saisie : confirmation d’abord ; « Annuler » ne retire rien, « Retirer » retire', () => {
    const onRemove = vi.fn();
    render(
      <ol>
        <SetRow set={make('s1', 0)} number={1} timed={false} source="routine" busy={false} onValidate={vi.fn()} onUnvalidate={vi.fn()} onKind={vi.fn()} onRemove={onRemove} />
      </ol>,
    );
    fireEvent.change(screen.getByLabelText(tTraining('sessionLoad')), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: tTraining('sessionRemoveSet') }));
    expect(onRemove).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(tTraining('sessionRemoveSetTitle'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: tTraining('sessionRemoveSet') }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: tTraining('sessionRemoveConfirm') }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

function Two() {
  const [done, setDone] = useState(false);
  return (
    <ol>
      <SetRow set={make('s1', 0, done)} number={1} timed={false} source="routine" busy={false} onValidate={() => setDone(true)} onUnvalidate={vi.fn()} onKind={vi.fn()} onRemove={vi.fn()} />
      <SetRow set={make('s2', 1)} number={2} timed={false} source="routine" busy={false} onValidate={vi.fn()} onUnvalidate={vi.fn()} onKind={vi.fn()} onRemove={vi.fn()} />
    </ol>
  );
}

describe('C-068 : focus après Entrée', () => {
  it('Entrée dans « Répétitions » : le focus passe à la série suivante, jamais à body', async () => {
    render(<Two />);
    const [first, second] = screen.getAllByRole('group');
    if (!first || !second) throw new Error('séries absentes');
    fireEvent.change(within(first).getByLabelText(tTraining('sessionLoad')), { target: { value: '40' } });
    const reps = within(first).getByLabelText(tTraining('sessionReps'));
    fireEvent.change(reps, { target: { value: '8' } });
    reps.focus();
    fireEvent.keyDown(reps, { key: 'Enter' });
    await waitFor(() => expect(within(second).getByLabelText(tTraining('sessionLoad'))).toHaveFocus());
  });
});

describe('C-068 : focus sans série suivante', () => {
  it('dernière série validée au clavier : le focus reste dans la ligne, pas sur body', async () => {
    function Alone() {
      const [done, setDone] = useState(false);
      return (
        <ol>
          <SetRow set={make('s1', 0, done)} number={1} timed={false} source="routine" busy={false} onValidate={() => setDone(true)} onUnvalidate={vi.fn()} onKind={vi.fn()} onRemove={vi.fn()} />
        </ol>
      );
    }
    render(<Alone />);
    fireEvent.change(screen.getByLabelText(tTraining('sessionLoad')), { target: { value: '40' } });
    const reps = screen.getByLabelText(tTraining('sessionReps'));
    fireEvent.change(reps, { target: { value: '8' } });
    reps.focus();
    fireEvent.keyDown(reps, { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('group')).toHaveFocus());
  });
});

describe('C-068 : focus sur la série SUIVANTE', () => {
  it('une série à faire située avant la ligne validée ne prend pas le focus', async () => {
    function Three() {
      const [done, setDone] = useState(false);
      return (
        <ol>
          <SetRow set={make('s0', 0)} number={1} timed={false} source="routine" busy={false} onValidate={vi.fn()} onUnvalidate={vi.fn()} onKind={vi.fn()} onRemove={vi.fn()} />
          <SetRow set={make('s1', 1, done)} number={2} timed={false} source="routine" busy={false} onValidate={() => setDone(true)} onUnvalidate={vi.fn()} onKind={vi.fn()} onRemove={vi.fn()} />
          <SetRow set={make('s2', 2)} number={3} timed={false} source="routine" busy={false} onValidate={vi.fn()} onUnvalidate={vi.fn()} onKind={vi.fn()} onRemove={vi.fn()} />
        </ol>
      );
    }
    render(<Three />);
    const [, second, third] = screen.getAllByRole('group');
    if (!second || !third) throw new Error('séries absentes');
    fireEvent.change(within(second).getByLabelText(tTraining('sessionLoad')), { target: { value: '40' } });
    const reps = within(second).getByLabelText(tTraining('sessionReps'));
    fireEvent.change(reps, { target: { value: '8' } });
    reps.focus();
    fireEvent.keyDown(reps, { key: 'Enter' });
    await waitFor(() => expect(within(third).getByLabelText(tTraining('sessionLoad'))).toHaveFocus());
  });
});
