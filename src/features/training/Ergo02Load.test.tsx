import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { WorkoutSet } from '../../domain/training';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../platform/liveActivity';
import type { TimerNotifier } from '../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { targetText } from './session/SetRow';
import { TrainingScreen } from './TrainingScreen';

/**
 * ERGO-02 (D-261, révise D-260) : une charge d'exercice aux haltères s'affiche « 2 × 26 kg » quand deux haltères sont tenus (développé couché aux
 * haltères), « 26 kg » quand un seul l'est (rowing unilatéral). Séance active (saisie, « − / + », série faite, « Dernière fois »), fiche exercice,
 * journal (séries, records, déroulé) : la valeur stockée reste la charge d'UN haltère. Base SQLite réelle (wasm), contenu embarqué réel.
 */

const DEVICE = '60000000-0000-4000-8000-0000000002e1' as DeviceId;
const PAIR = { id: 'bench-press-dumbbell', name: 'Développé couché aux haltères' };
const SINGLE = { id: 'row-dumbbell-one-arm', name: 'Rowing unilatéral à l’haltère' };
const notifier: TimerNotifier = {
  permission: async () => 'granted',
  requestPermission: async () => 'granted',
  isPending: async () => false,
  schedule: async () => true,
  cancel: async () => undefined,
};
const liveActivity: LiveActivity = {
  isAvailable: async () => ({ available: true }),
  start: async () => ({ started: true }),
  end: async () => ({ ended: true, count: 1 }),
};

let db: TestDb;
const mount = (screenId: 'session' | 'library' | 'history') => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: screenId } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'ios', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};

/** Séance close par le repository : une série de travail par couple (charge d'UN haltère, répétitions) et par exercice. */
async function closeWorkout(name: string, lines: readonly { readonly id: string; readonly name: string; readonly sets: readonly (readonly [number, number])[] }[]): Promise<string> {
  const id = await db.data.transaction(async (r) => {
    const repo = await r.workouts();
    const w = await repo.start({ source: 'empty', name });
    for (const line of lines) {
      const next = await repo.addExercise(w.id, { exerciseId: line.id, exerciseName: line.name, sets: line.sets.length, targetRepsMin: 8, targetRepsMax: 12 });
      const sets = next.sets.filter((s) => s.exerciseId === line.id).sort((a, b) => a.position - b.position);
      for (const [i, [loadKg, reps]] of line.sets.entries()) {
        const set = sets[i];
        if (!set) throw new Error('série absente');
        await repo.validateSet(set.id, { loadKg, reps, durationSec: null, rir: null });
      }
    }
    await repo.close(w.id);
    return w.id;
  });
  db.clock.advance(2 * 24 * 3600 * 1000);
  return id;
}

beforeAll(async () => {
  await import('./media/ExerciseMedia');
});
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-02T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('ERGO-02 (D-261) : séance active', () => {
  it('deux haltères : saisie « par haltère », libellé « 2 × 26 kg » qui suit le « − / + », série faite « 2 × 28 kg × 8 » ; un haltère : « 26 kg × 8 »', async () => {
    await db.data.transaction(async (r) => {
      const repo = await r.workouts();
      const w = await repo.start({ source: 'empty', name: 'Haltères' });
      await repo.addExercise(w.id, { exerciseId: PAIR.id, exerciseName: PAIR.name, sets: 2, targetRepsMin: 8, targetRepsMax: 12 });
      await repo.addExercise(w.id, { exerciseId: SINGLE.id, exerciseName: SINGLE.name, sets: 1, targetRepsMin: 8, targetRepsMax: 12 });
    });
    mount('session');
    await screen.findByRole('heading', { level: 2, name: 'Haltères' });
    const pair = screen.getByRole('region', { name: PAIR.name });
    const set = within(pair).getByRole('group', { current: 'step' });
    const load = within(set).getByLabelText('Charge par haltère (kg)');
    fireEvent.change(load, { target: { value: '26' } });
    expect(within(set).getByText('2 × 26 kg')).toBeInTheDocument();
    fireEvent.click(within(set).getByRole('button', { name: 'Charge : un cran de plus' }));
    expect(load).toHaveValue('28');
    expect(within(set).getByText('2 × 28 kg')).toBeInTheDocument();
    fireEvent.change(within(set).getByLabelText('Répétitions'), { target: { value: '8' } });
    fireEvent.click(within(set).getByRole('button', { name: 'Valider la série' }));
    expect(await within(set).findByText('2 × 28 kg × 8')).toBeInTheDocument();
    const [stored] = await db.driver.select<{ load_kg: number }>('SELECT load_kg FROM workout_set WHERE done = 1');
    expect(stored?.load_kg).toBe(28);

    const single = screen.getByRole('region', { name: SINGLE.name });
    const row = within(single).getAllByRole('group')[0] as HTMLElement;
    expect(within(row).queryByLabelText('Charge par haltère (kg)')).toBeNull();
    fireEvent.change(within(row).getByLabelText('Charge (kg)'), { target: { value: '26' } });
    fireEvent.change(within(row).getByLabelText('Répétitions'), { target: { value: '8' } });
    expect(within(row).queryByText(/2 ×/)).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Valider la série' }));
    expect(await within(row).findByText('26 kg × 8')).toBeInTheDocument();
  });

  it('« Dernière fois » et « Cible » d’une séance copiée : « 2 × 26 kg » pour deux haltères, « 26 kg » pour un', () => {
    const set = { targetRepsMin: 8, targetRepsMax: 8, targetLoadKg: 26 } as WorkoutSet;
    expect(targetText(set, false, 'copy', 2)).toBe('Dernière fois : 2 × 26 kg × 8');
    expect(targetText(set, false, 'copy', 1)).toBe('Dernière fois : 26 kg × 8');
    const loadOnly = { targetRepsMin: null, targetRepsMax: null, targetLoadKg: 26 } as WorkoutSet;
    expect(targetText(loadOnly, false, 'empty', 2)).toBe('Cible : 2 × 26 kg');
    expect(targetText(loadOnly, false, 'empty', null)).toBe('Cible : 26 kg');
  });
});

describe('ERGO-02 (D-261) : fiche exercice', () => {
  it('deux haltères : record et dernières séances en « 2 × 26 kg » ; un haltère : « 26 kg »', async () => {
    await closeWorkout('Haltères', [
      { ...PAIR, sets: [[26, 8], [26, 8]] },
      { ...SINGLE, sets: [[26, 8]] },
    ]);
    mount('library');
    fireEvent.click(await screen.findByRole('switch', { name: 'Compatibles avec mon matériel' }));
    fireEvent.change(screen.getByLabelText('Rechercher un exercice'), { target: { value: PAIR.name } });
    fireEvent.click(screen.getAllByRole('button', { name: PAIR.name })[0] as HTMLElement);
    const sheet = await screen.findByRole('article', { name: PAIR.name });
    const recent = await within(sheet).findByRole('list', { name: 'Dernières séances' });
    expect(within(recent).getByText('2 × 26 kg × 8, 8')).toBeInTheDocument();
    expect(within(sheet).getByText('2 × 26 kg × 8', { selector: '.ct-sheet__record' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rechercher un exercice'), { target: { value: SINGLE.name } });
    fireEvent.click(screen.getAllByRole('button', { name: SINGLE.name })[0] as HTMLElement);
    const other = await screen.findByRole('article', { name: SINGLE.name });
    const list = await within(other).findByRole('list', { name: 'Dernières séances' });
    expect(within(list).getByText('26 kg × 8')).toBeInTheDocument();
    expect(other).not.toHaveTextContent(/2 × 26/);
  });
});

describe('ERGO-02 (D-261) : journal', () => {
  it('séries, records et déroulé : « 2 × 26 kg » pour deux haltères, « 26 kg » pour un ; valeur corrigée affichée de même', async () => {
    await closeWorkout('Avant', [{ ...PAIR, sets: [[24, 8]] }]);
    await closeWorkout('Après', [
      { ...PAIR, sets: [[26, 8]] },
      { ...SINGLE, sets: [[26, 8]] },
    ]);
    mount('history');
    fireEvent.click(await screen.findByRole('button', { name: /Après/ }));
    const detail = await screen.findByRole('region', { name: 'Détail de la séance' });
    const pair = await within(detail).findByRole('region', { name: PAIR.name });
    expect(within(pair).getByText('2 × 26 kg × 8')).toBeInTheDocument();
    const single = within(detail).getByRole('region', { name: SINGLE.name });
    expect(within(single).getByText('26 kg × 8')).toBeInTheDocument();
    expect(single).not.toHaveTextContent(/2 × 26/);
    expect(within(detail).getByText('Charge la plus lourde : 2 × 26 kg (avant : 2 × 24 kg)')).toBeInTheDocument();

    fireEvent.click(within(detail).getByRole('button', { name: 'Voir le déroulé série par série' }));
    const replay = await within(detail).findByRole('region', { name: 'Déroulé série par série' });
    expect(replay).toHaveTextContent('2 × 26 kg');
    const steps = within(replay).getAllByRole('listitem');
    const singleStep = steps.find((s) => s.textContent?.includes(SINGLE.name));
    expect(singleStep).toBeDefined();
    expect(singleStep).not.toHaveTextContent(/2 × 26/);
    expect(singleStep).toHaveTextContent('26 kg');

    fireEvent.click(within(pair).getByRole('button', { name: /Corriger/ }));
    expect(within(pair).getByLabelText('Charge par haltère (kg)')).toHaveValue('26');
  });
});
