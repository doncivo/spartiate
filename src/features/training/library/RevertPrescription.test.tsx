import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import { prescribe } from '../../../domain/training/prescribe';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { formatExerciseLoad, tTraining } from '../../../i18n/trainingText';
import { input, session } from '../../../../tests/fixtures/training/progression';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * MOTEUR-0281b (§ 11.5) : « Revenir à la prescription précédente » depuis la fiche d'un exercice ; confirmation avant écriture, décision tracée,
 * rien d'effacé. Données SYNTHÉTIQUES.
 */
const DEVICE = '60000000-0000-4000-8000-0000000002b6' as DeviceId;
const u = (n: number): string => `2b4c6d8e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NAME = 'Développé couché à la barre';
let db: TestDb;
const base = prescribe(input({ history: [session(3, 60, [10, 10, 10])] }));
const decisionCount = async (): Promise<number> => (await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM recommendation_decision'))[0]?.n ?? 0;

async function seed(loads: readonly number[]): Promise<void> {
  const r = await db.data.repos.workouts();
  for (const [i, loadKg] of loads.entries()) {
    await r.start({ source: 'empty', id: u(i + 1), name: 'A' });
    const w = await r.addExercise(u(i + 1), { exerciseId: 'bench-press-barbell', exerciseName: NAME, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
    await (await db.data.repos.progression()).recordDecision({ exerciseId: 'bench-press-barbell', workoutId: u(i + 1), prescription: base, accepted: false, chosenLoadKg: loadKg, chosenReps: [10, 10, 10] });
    for (const s of w.sets) await r.validateSet(s.id, { reps: 10, loadKg });
    await db.data.transaction(async (repos) => (await repos.workouts()).close(u(i + 1)));
    db.clock.advance(3 * 86_400_000);
  }
}
async function openSheet(): Promise<HTMLElement> {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'library' } as Route));
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: NAME }));
  return screen.findByRole('region', { name: tTraining('revertTitle') });
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-04T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('MOTEUR-0281b : fiche, retour à la prescription précédente', () => {
  it('B1 B2 après une hausse : valeurs proposées, « Annuler » n’écrit rien, « Revenir » écrit une décision tracée', async () => {
    await seed([60, 62.5]);
    const region = await openSheet();
    const button = await within(region).findByRole('button', { name: tTraining('revertButton') });
    const value = tTraining('revertValue', { load: formatExerciseLoad(60, 1), reps: [10, 10, 10].join(tTraining('revertJoin')) });
    expect(within(region).getByText((text) => text.includes(value))).toBeInTheDocument();
    fireEvent.click(button);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: tTraining('cancel') }));
    expect(await decisionCount()).toBe(2);
    fireEvent.click(within(region).getByRole('button', { name: tTraining('revertButton') }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: tTraining('revertConfirm') }));
    expect(await within(region).findByText(tTraining('revertDone'))).toBeInTheDocument();
    expect(await decisionCount()).toBe(3);
    const [row] = await db.driver.select<{ chosen_load_kg: number; accepted: number; reasons: string; workout_id: string }>(
      'SELECT chosen_load_kg, accepted, reasons, workout_id FROM recommendation_decision ORDER BY decided_at DESC LIMIT 1',
    );
    expect(row).toMatchObject({ chosen_load_kg: 60, accepted: 0, workout_id: u(2) });
    expect(JSON.parse(row?.reasons ?? '[]')).toContain('revert-previous');
    expect(within(region).queryByRole('button', { name: tTraining('revertButton') })).toBeNull();
  });

  it('B4 sans hausse : pas de bouton, la fiche dit pourquoi', async () => {
    await seed([60, 60]);
    const region = await openSheet();
    expect(await within(region).findByText(tTraining('revertNone'))).toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: tTraining('revertButton') })).toBeNull();
  });
});
