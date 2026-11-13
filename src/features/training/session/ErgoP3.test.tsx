import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkoutSet } from '../../../domain/training';
import { stepLoad } from '../../../domain/training/loadGrid';
import { SetRow } from './SetRow';

/**
 * ERGO-01b P3 (D-238, maquette docs/maquettes/propositions/ergo-01-structure/P3-Seance-pas-de-charge.svg) : « − / + » sur la charge (au cran
 * du matériel) et sur les répétitions de la série en cours ; un tap par cran, sans clavier ; le champ reste éditable.
 */

const SET = {
  id: 's1',
  workoutId: 'w1',
  exerciseId: 'bench-press-barbell',
  exerciseName: 'Développé couché à la barre',
  position: 0,
  setKind: 'work',
  targetRepsMin: 8,
  targetRepsMax: 8,
  targetLoadKg: 70,
  targetRestSec: 120,
  reps: null,
  loadKg: null,
  durationSec: null,
  rir: null,
  done: false,
  doneAt: null,
} as unknown as WorkoutSet;

const row = (props: { readonly current?: boolean; readonly loads?: readonly number[] | null; readonly onValidate?: () => void }) =>
  render(
    <ol>
      <SetRow set={SET} number={1} current={props.current ?? true} timed={false} source="routine" busy={false} loads={props.loads ?? null} onValidate={props.onValidate ?? vi.fn()} onUnvalidate={vi.fn()} onKind={vi.fn()} onRemove={vi.fn()} />
    </ol>,
  );

describe('ERGO-01b P3 : cran de charge (domaine)', () => {
  it('grille du matériel : charge disponible suivante ou précédente ; aux bornes, la charge reste', () => {
    const loads = [20, 40, 60, 62.5, 65, 70, 72.5];
    expect(stepLoad(70, loads, 1)).toBe(72.5);
    expect(stepLoad(70, loads, -1)).toBe(65);
    expect(stepLoad(72.5, loads, 1)).toBe(72.5);
    expect(stepLoad(20, loads, -1)).toBe(20);
    expect(stepLoad(null, loads, 1)).toBe(20);
  });

  it('sans grille (profil absent ou matériel sans palier) : 2,5 kg, jamais sous zéro', () => {
    expect(stepLoad(70, null, 1)).toBe(72.5);
    expect(stepLoad(70, null, -1)).toBe(67.5);
    expect(stepLoad(1, null, -1)).toBe(0);
    expect(stepLoad(null, null, 1)).toBe(2.5);
    expect(stepLoad(null, null, -1)).toBeNull();
  });
});

describe('ERGO-01b P3 : − / + de la série en cours', () => {
  it('un tap = un cran du matériel sur la charge, une répétition sur les reps ; la validation porte les valeurs', () => {
    const onValidate = vi.fn();
    row({ loads: [60, 62.5, 65, 67.5, 70, 72.5, 75], onValidate });
    const load = screen.getByLabelText('Charge (kg)');
    expect(load).toHaveValue('70');
    fireEvent.click(screen.getByRole('button', { name: 'Charge : un cran de plus' }));
    expect(load).toHaveValue('72,5');
    fireEvent.click(screen.getByRole('button', { name: 'Charge : un cran de moins' }));
    fireEvent.click(screen.getByRole('button', { name: 'Charge : un cran de moins' }));
    expect(load).toHaveValue('67,5');
    const reps = screen.getByLabelText('Répétitions');
    fireEvent.click(screen.getByRole('button', { name: 'Répétitions : une de plus' }));
    expect(reps).toHaveValue('9');
    fireEvent.click(screen.getByRole('button', { name: 'Répétitions : une de moins' }));
    fireEvent.click(screen.getByRole('button', { name: 'Répétitions : une de moins' }));
    expect(reps).toHaveValue('7');
    fireEvent.change(load, { target: { value: '68' } });
    expect(load).toHaveValue('68');
    fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));
    expect(onValidate).toHaveBeenCalledWith({ reps: 7, loadKg: 68, durationSec: null, rir: null });
  });

  it('boutons de 44 px au moins (classe partagée), seulement sur la série en cours', () => {
    row({ loads: null });
    const plus = screen.getByRole('button', { name: 'Charge : un cran de plus' });
    expect(plus).toHaveClass('ct-session__step');
    row({ current: false, loads: null });
    expect(screen.getAllByRole('button', { name: 'Charge : un cran de plus' })).toHaveLength(1);
  });
});
