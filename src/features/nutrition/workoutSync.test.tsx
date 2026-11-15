import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { applyRemoteChanges } from '../sync/remoteChanges';
import { NutritionRemainingCard } from './NutritionRemainingCard';
import { useNutritionData } from './useNutritionData';

/**
 * FIX-0243 critère 3 (relecture Codex n° 11) : une séance reçue par la synchro (tables workout et workout_set) pendant l'affichage change le type
 * du jour et la cible, sans remontage. Lundi 9 novembre 2026 prévu en repos : 2 400 kcal (repos) puis 2 600 (entraînement). Valeurs synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000d7' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const WORKOUT = '7e2d1c3a-0000-4000-8000-0000000000e1';
let db: TestDb;
const fr = (n: number): string => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
const heroLine =
  (text: string) =>
  (_: string, el: Element | null): boolean =>
    (el?.classList.contains('ct-hero') ?? false) && (el?.textContent ?? '').replace(/[\u202f\u00a0]/g, ' ') === text;
const container = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });

const recordRestPlan = async () =>
  (await db.data.repos.nutritionTargets()).record({
    weekStart: TODAY,
    target: { kcal: 2600, proteinG: 150, fatG: 80, carbG: 320 },
    source: 'manual',
    accepted: true,
    engineVersion: null,
    lowFloorConfirmed: false,
    restPlan: { rest: { kcal: 2400, proteinG: 150, fatG: 80, carbG: 270 }, trainingDays: [2, 4, 5, 6] as const },
  });

/** Séance de musculation close aujourd'hui, comme si la synchro venait de l'écrire. */
const receiveClosedWorkout = async () => {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: WORKOUT, name: 'Séance' });
  const w = await r.addExercise(WORKOUT, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 1 });
  for (const set of w.sets) await r.validateSet(set.id, { reps: 8, loadKg: 60 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(WORKOUT));
};
const notify = (tables: string[]) => act(async () => void (await applyRemoteChanges(container(), { tables: new Set(tables), ids: new Map<string, ReadonlySet<string>>() })));

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('FIX-0243 : séance reçue pendant l’affichage', () => {
  it('la carte d’Aujourd’hui passe de « Jour de repos » 2 400 à « Jour d’entraînement » 2 600 sans remontage', async () => {
    await recordRestPlan();
    render(
      <AppContainerProvider container={container()}>
        <NutritionRemainingCard />
      </AppContainerProvider>,
    );
    expect(await screen.findByText('Jour de repos')).toBeInTheDocument();
    expect(screen.getByText(heroLine(`${fr(2400)} kcal restantes`))).toBeInTheDocument();
    await receiveClosedWorkout();
    await notify(['workout', 'workout_set']);
    expect(await screen.findByText('Jour d’entraînement')).toBeInTheDocument();
    expect(screen.getByText(heroLine(`${fr(2600)} kcal restantes`))).toBeInTheDocument();
  });

  it('un lot d’une seule des deux tables suffit à relire (workout seul, puis workout_set seul)', async () => {
    await recordRestPlan();
    render(
      <AppContainerProvider container={container()}>
        <NutritionRemainingCard />
      </AppContainerProvider>,
    );
    expect(await screen.findByText('Jour de repos')).toBeInTheDocument();
    await receiveClosedWorkout();
    await notify(['workout_set']);
    expect(await screen.findByText('Jour d’entraînement')).toBeInTheDocument();
  });

  it('le hook du journal et du tableau de bord relit les jours de séance : la cible du jour passe à l’entraînement', async () => {
    await recordRestPlan();
    const { result } = renderHook(() => useNutritionData(db.data, TODAY));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const days = () => (result.current.state.status === 'ready' ? [...(result.current.state.snapshot.strengthDays ?? [])] : []);
    expect(days()).toEqual([]);
    await receiveClosedWorkout();
    await notify(['workout']);
    await waitFor(() => expect(days()).toEqual([TODAY]));
  });
});
