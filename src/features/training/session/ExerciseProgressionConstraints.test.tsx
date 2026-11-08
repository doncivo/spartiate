import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I2-02 : alertes et choix facultatifs dans le bloc Proposition (fatigue, deload manuel). Rien n'est appliqué d'office : un choix ne remplit
 * les séries qu'au geste d'Ali et se trace dans `recommendation_decision` comme une modification ; « Refuser » trace un refus ; un deload
 * retenu sort la séance des statistiques du moteur. Base SQLite réelle (wasm), contenu embarqué, profil Fitness Park Antony (barre 2,5 kg).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e4' as DeviceId;
const u = (n: number): string => `3c5d7e9f-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CURRENT = u(9);
const BENCH = 'Développé couché à la barre';
const BENCH_ID = 'bench-press-barbell';

const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };

let db: TestDb;
const openSession = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};

/** Séance close de développé couché à `loadKg`, une série par valeur de `reps` ; trois jours passent ensuite. */
async function seedPast(id: string, loadKg: number, reps: readonly number[]): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id, name: 'Haut A' });
  const w = await r.addExercise(id, { exerciseId: BENCH_ID, exerciseName: BENCH, sets: reps.length, targetRepsMin: 8, targetRepsMax: 10 });
  for (const [i, s] of w.sets.entries()) await r.validateSet(s.id, { reps: reps[i] ?? 0, loadKg });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(id));
  db.clock.advance(3 * 86_400_000);
}
async function seedCurrent(): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: CURRENT, name: 'Haut B' });
  await r.addExercise(CURRENT, { exerciseId: BENCH_ID, exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
}
const block = async () => screen.findByRole('region', { name: BENCH });
const proposal = async () => within(await block()).findByRole('group', { name: 'Proposition' });
/** I2-03 : séries de TRAVAIL seulement (« Série n ») ; les rampes d'échauffement sont vérifiées dans ExerciseWarmup.test.tsx. */
const loadInputs = async () => within(await block()).getAllByRole('group', { name: /^Série \d+$/ }).map((g) => (within(g).getByLabelText('Charge (kg)') as HTMLInputElement).value);
const decisions = () =>
  db.driver.select<{ accepted: number; chosen_load_kg: number | null; chosen_reps: string; prescription: string }>('SELECT accepted, chosen_load_kg, chosen_reps, prescription FROM recommendation_decision ORDER BY decided_at');

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-01T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('fatigue (D-72 point 7)', () => {
  beforeEach(async () => {
    await seedPast(u(1), 100, [10, 10, 10]);
    await seedPast(u(2), 100, [7, 7, 7]);
    await seedCurrent();
  });

  it('maintien affiché, deux choix facultatifs en texte ; rien n’est rempli ni écrit sans geste', async () => {
    openSession();
    const p = await proposal();
    expect(await within(p).findByText('100 kg × 7 · 7 · 7')).toBeInTheDocument();
    expect(within(p).getByText('Même charge, mêmes répétitions : plus de 20 % de répétitions en moins qu’à la dernière séance à cette charge.')).toBeInTheDocument();
    const options = within(p).getByRole('group', { name: 'Choix facultatifs' });
    expect(within(options).getByText('−5 % de charge : 95 kg × 7 · 7 · 7.')).toBeInTheDocument();
    expect(within(options).getByText('2 répétitions de moins par série : 100 kg × 5 · 5 · 5.')).toBeInTheDocument();
    expect(within(options).getAllByRole('button', { name: /^Choisir : / })).toHaveLength(2);
    expect(await loadInputs()).toEqual(['', '', '']);
    expect(await decisions()).toEqual([]);
  });

  it('choisir −5 % : séries à faire remplies, tracé comme une modification avec la proposition et ses choix', async () => {
    openSession();
    fireEvent.click(await within(await proposal()).findByRole('button', { name: 'Choisir : −5 % de charge : 95 kg × 7 · 7 · 7.' }));
    expect(await within(await proposal()).findByText('Valeurs retenues : 95 kg × 7.')).toBeInTheDocument();
    expect(await loadInputs()).toEqual(['95', '95', '95']);
    const [d] = await decisions();
    expect(d).toMatchObject({ accepted: 0, chosen_load_kg: 95, chosen_reps: '[7,7,7]' });
    expect((JSON.parse(d?.prescription ?? '{}') as { options: unknown[] }).options).toHaveLength(2);
    expect(within(await proposal()).queryByRole('group', { name: 'Choix facultatifs' })).toBeNull();
  });

  it('refuser : rien n’est rempli, le refus est tracé (la proposition présentée garde ses choix)', async () => {
    openSession();
    fireEvent.click(await within(await proposal()).findByRole('button', { name: 'Refuser' }));
    expect(await within(await proposal()).findByText('Proposition refusée : tu saisis toi-même.')).toBeInTheDocument();
    expect(await loadInputs()).toEqual(['', '', '']);
    const [d] = await decisions();
    expect(d).toMatchObject({ accepted: 0, chosen_load_kg: null, chosen_reps: '[]' });
    expect((JSON.parse(d?.prescription ?? '{}') as { reasons: string[] }).reasons).toContain('fatigue-drop');
  });
});

describe('deload manuel (D-72 point 9)', () => {
  beforeEach(async () => {
    await seedPast(u(1), 100, [8, 8, 8]);
    await seedCurrent();
  });

  it('demandé par Ali : état dit en texte et par aria-pressed ; 1 série à 80 kg, RIR 4 ; retiré : proposition d’origine', async () => {
    openSession();
    const p = await proposal();
    expect(await within(p).findByText('100 kg × 9 · 8 · 8')).toBeInTheDocument();
    const toggle = within(p).getByRole('button', { name: 'Deload pour cette séance' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(await within(p).findByText('80 kg × 8')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(within(p).getByText('Deload demandé : proposition allégée, séries hors statistiques une fois retenues.')).toBeInTheDocument();
    expect(within(p).getByText('Deload : moitié des séries (1), charge allégée, au moins 4 répétitions en réserve ; hors statistiques.')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(await within(p).findByText('100 kg × 9 · 8 · 8')).toBeInTheDocument();
    expect(await decisions()).toEqual([]);
  });

  it('deload puis « Modifier » à la charge pleine (100 kg × 8) : la séance n’est PAS exclue des statistiques', async () => {
    openSession();
    fireEvent.click(within(await proposal()).getByRole('button', { name: 'Deload pour cette séance' }));
    await within(await proposal()).findByText('80 kg × 8');
    fireEvent.click(within(await proposal()).getByRole('button', { name: 'Modifier' }));
    const p = await proposal();
    fireEvent.change(within(p).getByLabelText('Charge proposée (kg)'), { target: { value: '100' } });
    fireEvent.change(within(p).getByLabelText('Répétitions proposées'), { target: { value: '8' } });
    fireEvent.click(within(p).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(await proposal()).findByText('Valeurs retenues : 100 kg × 8.')).toBeInTheDocument();
    const r = await db.data.repos.workouts();
    for (const set of (await r.get(CURRENT))?.sets ?? []) if (set.loadKg !== null) await r.validateSet(set.id, { reps: 8, loadKg: 100 });
    cleanup();
    await db.data.transaction(async (repos) => (await repos.workouts()).close(CURRENT));
    const history = await (await db.data.repos.progression()).history(BENCH_ID);
    expect(history.map((s) => [s.workoutId, s.deload === true])).toEqual([
      [CURRENT, false],
      [u(1), false],
    ]);
  });

  it('accepté puis séance close : la séance de deload reste dans l’historique, marquée, et sort des statistiques du moteur', async () => {
    openSession();
    fireEvent.click(within(await proposal()).getByRole('button', { name: 'Deload pour cette séance' }));
    await within(await proposal()).findByText('80 kg × 8');
    fireEvent.click(within(await proposal()).getByRole('button', { name: 'Accepter' }));
    expect(await within(await proposal()).findByText('Proposition acceptée.')).toBeInTheDocument();
    expect(await loadInputs()).toEqual(['80', '', '']);
    const r = await db.data.repos.workouts();
    const current = await r.get(CURRENT);
    for (const s of current?.sets ?? []) if (s.loadKg !== null) await r.validateSet(s.id, { reps: 8, loadKg: 80 });
    cleanup();
    await db.data.transaction(async (repos) => (await repos.workouts()).close(CURRENT));
    const history = await (await db.data.repos.progression()).history(BENCH_ID);
    expect(history.map((s) => [s.workoutId, s.deload === true])).toEqual([
      [CURRENT, true],
      [u(1), false],
    ]);
  });
});
