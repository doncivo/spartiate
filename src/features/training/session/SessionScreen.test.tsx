import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity, LiveActivityAvailability, LiveActivityStartInput } from '../../../platform/liveActivity';
import type { TimerNotifier, TimerNotifierPermission } from '../../../platform/notifications/timerNotification';
import { PAST_WORKOUT_ID, seedPastWorkout } from '../../../../tests/fixtures/training/workout';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';
import { TodaySessionCard } from './TodaySessionCard';

/**
 * I1-02 (interface), tests DOM sur base SQLite réelle (wasm) et contenu embarqué réel : démarrage vide / routine / copie, validation qui écrit
 * en base, reprise après remontage avec cinq séries validées, minuteur de repos (automatique, réglable, « Passer », « +30 s », recalcul depuis
 * la date de fin, échéance), notifications refusées, Live Activity indisponible, PC sans notification, clavier.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000c2' as DeviceId;
const u = (n: number): string => `3c2b1a00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut / Bas',
  mode: 'programme',
  days: [
    {
      id: u(2),
      name: 'Haut A',
      dayOrder: 1,
      exercises: [
        { id: u(3), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 },
        { id: u(4), exerciseId: 'row-barbell', exerciseName: 'Rowing à la barre', sets: 2, repMin: 8, repMax: 12, rir: null, restSec: 120, position: 1 },
      ],
    },
  ],
};

function fakes(options: { permission?: TimerNotifierPermission; availability?: LiveActivityAvailability } = {}) {
  const scheduled: number[] = [];
  const calls = { permission: 0, cancel: 0, starts: [] as LiveActivityStartInput[], ends: 0 };
  const notifier: TimerNotifier = {
    permission: async () => (calls.permission++, options.permission ?? 'granted'),
    requestPermission: async () => options.permission ?? 'granted',
    isPending: async () => scheduled.length > 0,
    schedule: async ({ endMs }) => (scheduled.push(endMs), true),
    cancel: async () => void calls.cancel++,
  };
  const liveActivity: LiveActivity = {
    isAvailable: async () => options.availability ?? { available: true },
    start: async (input) => (calls.starts.push(input), { started: true }),
    end: async () => (calls.ends++, { ended: true, count: 1 }),
  };
  return { notifier, liveActivity, scheduled, calls };
}

let db: TestDb;
const container = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
const openSession = (f = fakes(), os: 'ios' | 'other' = 'ios') => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  return render(
    <AppContainerProvider container={container()}>
      <TrainingScreen session={{ os, notifier: f.notifier, liveActivity: f.liveActivity }} />
    </AppContainerProvider>,
  );
};
const one = async <T,>(sql: string, params: unknown[] = []): Promise<T> => {
  const [row] = await db.driver.select<T & Record<string, string | number | null>>(sql, params as (string | number | null)[]);
  if (!row) throw new Error(`aucune ligne : ${sql}`);
  return row;
};
const count = async (sql: string): Promise<number> => (await one<{ n: number }>(sql)).n;
const setGroups = async (exercise: string) => within(await screen.findByRole('region', { name: exercise })).getAllByRole('group', { name: /^Série/ });
const firstOpenSet = async (exercise: string) => {
  const groups = await setGroups(exercise);
  const open = groups.find((g) => within(g).queryByRole('button', { name: 'Valider la série' }) !== null);
  if (!open) throw new Error('aucune série à valider');
  return open;
};
/**
 * Saisit la charge et les répétitions de la première série à faire, puis la valide. ERGO-02 (D-261) : pour deux haltères (curl marteau), le champ
 * s'appelle « Charge par haltère (kg) » ; la valeur saisie est la même (un haltère).
 */
async function validateNext(exercise: string, load: string, reps: string): Promise<void> {
  const set = await firstOpenSet(exercise);
  fireEvent.change(within(set).getByLabelText(/^Charge( par haltère)? \(kg\)$/), { target: { value: load } });
  fireEvent.change(within(set).getByLabelText('Répétitions'), { target: { value: reps } });
  fireEvent.click(within(set).getByRole('button', { name: 'Valider la série' }));
  await within(set).findByText('Validée');
}
// La routine est créée avant le montage (beforeEach) : les jours proposés sont lus au montage.
const startFromRoutine = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^Démarrer « Haut A »/ }));
  await screen.findByRole('heading', { level: 2, name: 'Haut A' });
};
const restTimer = () => screen.findByRole('timer', { name: 'Repos restant' });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('démarrer une séance (critère 1)', () => {
  it('sans séance ouverte : séance vide, routine ou copie ; sans historique, la copie dit pourquoi', async () => {
    openSession();
    expect(await screen.findByRole('button', { name: 'Séance vide' })).toBeInTheDocument();
    expect(await screen.findByText(/Aucune séance terminée pour l’instant/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Copier/ })).toBeNull();
  });

  it('séance vide : une séance locale ouverte, sans série, « Séance libre »', async () => {
    openSession();
    fireEvent.click(await screen.findByRole('button', { name: 'Séance vide' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Séance libre' })).toBeInTheDocument();
    expect(await one('SELECT source, ended_at FROM workout')).toEqual({ source: 'empty', ended_at: null });
    expect(await count('SELECT COUNT(*) AS n FROM workout_set')).toBe(0);
  });

  it('depuis un jour de routine : exercices et séries de la routine, cibles affichées, aucune charge inventée', async () => {
    openSession();
    await startFromRoutine();
    expect(await setGroups('Développé couché à la barre')).toHaveLength(3);
    expect(await setGroups('Rowing à la barre')).toHaveLength(2);
    expect(screen.getAllByText('Cible : 6 à 10 répétitions')).toHaveLength(3);
    expect(screen.getByText('0 / 5 séries validées')).toBeInTheDocument();
    const [first] = await setGroups('Développé couché à la barre');
    expect(within(first as HTMLElement).getByLabelText('Charge (kg)')).toHaveValue('');
    expect(await one('SELECT source, routine_day_id FROM workout')).toEqual({ source: 'routine', routine_day_id: u(2) });
  });

  it('copie d’une séance passée : exercices et dernières charges, aucune routine créée', async () => {
    await seedPastWorkout(db.driver);
    openSession();
    fireEvent.click(await screen.findByRole('button', { name: /^Copier « Haut A »/ }));
    expect(await screen.findByText('Dernière fois : 60 kg × 8')).toBeInTheDocument();
    const work = (await setGroups('Développé couché à la barre'))[1] as HTMLElement;
    expect(within(work).getByLabelText('Charge (kg)')).toHaveValue('60');
    expect(within(work).getByLabelText('Répétitions')).toHaveValue('8');
    expect(await one('SELECT source, copied_from_workout_id FROM workout WHERE ended_at IS NULL')).toEqual({ source: 'copy', copied_from_workout_id: PAST_WORKOUT_ID });
    expect(await count('SELECT COUNT(*) AS n FROM routine')).toBe(1);
  });

  it('séance ouverte : l’onglet Entraînement et Aujourd’hui proposent « Reprendre la séance »', async () => {
    await db.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'empty', name: 'Jambes' }));
    act(() => useNavigationStore.getState().navigate({ tab: 'training' }));
    const view = render(
      <AppContainerProvider container={container()}>
        <TrainingScreen />
      </AppContainerProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Reprendre la séance' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training', screen: 'session' });
    view.unmount();
    act(() => useNavigationStore.getState().navigate({ tab: 'today' }));
    render(
      <AppContainerProvider container={container()}>
        <TodaySessionCard />
      </AppContainerProvider>,
    );
    expect(await screen.findByText('Jambes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre la séance' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training', screen: 'session' });
  });

  it('Aujourd’hui sans séance ouverte : « Commencer une séance »', async () => {
    render(
      <AppContainerProvider container={container()}>
        <TodaySessionCard />
      </AppContainerProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Commencer une séance' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training', screen: 'session' });
  });
});

describe('saisie et validation (critère 2)', () => {
  it('« Valider la série » écrit la série dans SQLite tout de suite ; le résumé suit ; annuler la validation la remet à faire', async () => {
    openSession();
    await startFromRoutine();
    await validateNext('Développé couché à la barre', '60', '8');
    expect(await one("SELECT done, load_kg, reps FROM workout_set WHERE position = 0 AND deleted_at IS NULL")).toEqual({ done: 1, load_kg: 60, reps: 8 });
    expect(screen.getByText('1 / 5 séries validées')).toBeInTheDocument();
    const [first] = await setGroups('Développé couché à la barre');
    expect(within(first as HTMLElement).getByText('60 kg × 8')).toBeInTheDocument();
    fireEvent.click(within(first as HTMLElement).getByRole('button', { name: 'Annuler la validation' }));
    expect(await within(first as HTMLElement).findByRole('button', { name: 'Valider la série' })).toBeInTheDocument();
    expect(await one("SELECT done FROM workout_set WHERE position = 0")).toEqual({ done: 0 });
  });

  it('saisie incomplète refusée sans rien écrire : jamais une série de travail réussie par défaut', async () => {
    openSession();
    await startFromRoutine();
    const set = await firstOpenSet('Développé couché à la barre');
    fireEvent.click(within(set).getByRole('button', { name: 'Valider la série' }));
    expect(await within(set).findByRole('alert')).toHaveTextContent('Indique les répétitions');
    expect(await count('SELECT COUNT(*) AS n FROM workout_set WHERE done = 1')).toBe(0);
  });

  it('type de série : « Normale » par défaut, autres types au choix, aide d’une ligne', async () => {
    openSession();
    await startFromRoutine();
    const set = await firstOpenSet('Développé couché à la barre');
    const select = within(set).getByLabelText('Type de série') as HTMLSelectElement;
    expect(select.value).toBe('work');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Normale', 'Échauffement', 'Dégressive', 'Partielle']);
    expect(within(set).queryByText('Travail')).toBeNull();
    expect(within(set).getByText(/Normale : comptée dans le volume et les records/)).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'drop' } });
    expect(await one('SELECT set_kind FROM workout_set WHERE position = 0')).toEqual({ set_kind: 'drop' });
  });

  it('REV-01 constat 10 (non-régression de la 0.2.3) : Dégressive et Partielle se choisissent depuis une série normale et s’enregistrent', async () => {
    openSession();
    await startFromRoutine();
    const set = await firstOpenSet('Développé couché à la barre');
    const select = within(set).getByLabelText('Type de série') as HTMLSelectElement;
    expect(select.value).toBe('work');
    fireEvent.change(select, { target: { value: 'drop' } });
    expect(await one('SELECT set_kind FROM workout_set WHERE position = 0')).toEqual({ set_kind: 'drop' });
    fireEvent.change(within(await firstOpenSet('Développé couché à la barre')).getByLabelText('Type de série'), { target: { value: 'partial' } });
    expect(await one('SELECT set_kind FROM workout_set WHERE position = 0')).toEqual({ set_kind: 'partial' });
    fireEvent.change(within(await firstOpenSet('Développé couché à la barre')).getByLabelText('Type de série'), { target: { value: 'work' } });
    expect(await one('SELECT set_kind FROM workout_set WHERE position = 0')).toEqual({ set_kind: 'work' });
  });

  it('échauffement : type changé en base, validé sans lancer de repos', async () => {
    const f = fakes();
    openSession(f);
    await startFromRoutine();
    const set = await firstOpenSet('Développé couché à la barre');
    fireEvent.change(within(set).getByLabelText('Type de série'), { target: { value: 'warmup' } });
    expect(await within(set).findByText('É')).toBeInTheDocument();
    await validateNext('Développé couché à la barre', '40', '8');
    expect(await one('SELECT set_kind, done FROM workout_set WHERE position = 0')).toEqual({ set_kind: 'warmup', done: 1 });
    expect(await one('SELECT rest_timer_end_at FROM workout')).toEqual({ rest_timer_end_at: null });
    expect(screen.queryByRole('timer', { name: 'Repos restant' })).toBeNull();
    expect(f.calls.starts).toEqual([]);
  });

  it('ajouter et retirer une série ; ajouter un exercice filtré par le matériel actif ; retirer un exercice', async () => {
    openSession();
    await startFromRoutine();
    const region = await screen.findByRole('region', { name: 'Rowing à la barre' });
    fireEvent.click(within(region).getByRole('button', { name: 'Ajouter une série' }));
    await waitFor(() => expect(within(region).getAllByRole('group', { name: /^Série/ })).toHaveLength(3));
    fireEvent.click(within((await setGroups('Rowing à la barre'))[2] as HTMLElement).getByRole('button', { name: 'Retirer la série' }));
    await waitFor(() => expect(within(region).getAllByRole('group', { name: /^Série/ })).toHaveLength(2));
    expect(await count('SELECT COUNT(*) AS n FROM workout_set WHERE deleted_at IS NULL')).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    const picker = await screen.findByRole('region', { name: 'Ajouter un exercice à la séance' });
    fireEvent.change(within(picker).getByLabelText('Rechercher un exercice'), { target: { value: 'curl' } });
    expect(within(picker).queryByRole('button', { name: 'Curl nordique' })).toBeNull();
    fireEvent.click(within(picker).getByRole('button', { name: /^Curl marteau$/ }));
    expect(await screen.findByRole('region', { name: 'Curl marteau' })).toBeInTheDocument();
    expect(await count("SELECT COUNT(*) AS n FROM workout_set WHERE exercise_id = 'hammer-curl' AND deleted_at IS NULL")).toBe(3);
    fireEvent.click(within(screen.getByRole('region', { name: 'Curl marteau' })).getByRole('button', { name: 'Retirer l’exercice' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Retirer' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Curl marteau' })).toBeNull());
    expect(await count("SELECT COUNT(*) AS n FROM workout_set WHERE exercise_id = 'hammer-curl' AND deleted_at IS NULL")).toBe(0);
  });

  it('exercice chronométré : durée saisie et écrite', async () => {
    openSession();
    fireEvent.click(await screen.findByRole('button', { name: 'Séance vide' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un exercice' }));
    const picker = await screen.findByRole('region', { name: 'Ajouter un exercice à la séance' });
    fireEvent.change(within(picker).getByLabelText('Rechercher un exercice'), { target: { value: 'planche' } });
    fireEvent.click(within(picker).getByRole('button', { name: /^Planche$/ }));
    const set = await firstOpenSet('Planche');
    expect(within(set).queryByLabelText('Répétitions')).toBeNull();
    fireEvent.change(within(set).getByLabelText('Durée (s)'), { target: { value: '45' } });
    fireEvent.click(within(set).getByRole('button', { name: 'Valider la série' }));
    await within(set).findByText('Validée');
    expect(await one("SELECT duration_sec, reps, done FROM workout_set WHERE exercise_id = 'plank' AND position = 0")).toEqual({ duration_sec: 45, reps: null, done: 1 });
  });

  it('abandonner : confirmation, séance supprimée logiquement, retour aux options de départ', async () => {
    const f = fakes();
    openSession(f);
    await startFromRoutine();
    await validateNext('Développé couché à la barre', '60', '8');
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner la séance' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Abandonner' }));
    expect(await screen.findByRole('button', { name: 'Séance vide' })).toBeInTheDocument();
    expect(await count('SELECT COUNT(*) AS n FROM workout WHERE deleted_at IS NULL')).toBe(0);
    expect(f.calls.ends).toBeGreaterThanOrEqual(1);
  });

  it('I1-03 : « Terminer la séance » est proposé dans la séance active', async () => {
    openSession();
    await startFromRoutine();
    expect(screen.getByRole('button', { name: 'Terminer la séance' })).toBeInTheDocument();
  });
});

describe('reprise (critère 3)', () => {
  it('cinq séries validées, remontage (fermeture forcée) : séance, séries et ordre restaurés, sans doublon', async () => {
    const first = openSession();
    await startFromRoutine();
    for (const [load, reps] of [
      ['60', '8'],
      ['60', '8'],
      ['62,5', '7'],
    ] as const)
      await validateNext('Développé couché à la barre', load, reps);
    await validateNext('Rowing à la barre', '50', '10');
    await validateNext('Rowing à la barre', '50', '9');
    const before = await db.driver.select('SELECT id, position, reps, load_kg, done FROM workout_set WHERE deleted_at IS NULL ORDER BY position');
    first.unmount();
    act(() => useNavigationStore.setState(INITIAL_NAVIGATION));
    openSession();
    expect(await screen.findByText('5 / 5 séries validées')).toBeInTheDocument();
    const bench = await setGroups('Développé couché à la barre');
    expect(bench.map((g) => within(g).getByText(/kg ×/).textContent)).toEqual(['60 kg × 8', '60 kg × 8', '62,5 kg × 7']);
    expect(await db.driver.select('SELECT id, position, reps, load_kg, done FROM workout_set WHERE deleted_at IS NULL ORDER BY position')).toEqual(before);
    expect(await count('SELECT COUNT(*) AS n FROM workout')).toBe(1);
  });
});

describe('minuteur de repos (critère 4)', () => {
  it('démarre seul à la validation d’une série de travail, durée de la routine ; Live Activity « Repos » ; notification', async () => {
    const f = fakes();
    openSession(f);
    await startFromRoutine();
    await validateNext('Développé couché à la barre', '60', '8');
    expect(await restTimer()).toHaveTextContent('2:30');
    expect(await one('SELECT rest_timer_end_at FROM workout')).toEqual({ rest_timer_end_at: '2026-11-09T17:02:30.000Z' });
    expect(f.calls.starts).toEqual([{ endDateMs: Date.parse('2026-11-09T17:02:30.000Z'), label: 'Repos', finishedLabel: 'Terminé' }]);
    expect(f.scheduled).toEqual([Date.parse('2026-11-09T17:02:30.000Z')]);
  });

  it('durée réglable : « Repos par défaut » persisté localement, appliqué quand la routine n’en fixe pas', async () => {
    openSession();
    fireEvent.click(await screen.findByRole('button', { name: 'Séance vide' }));
    fireEvent.change(await screen.findByLabelText('Repos par défaut'), { target: { value: '60' } });
    await waitFor(async () => expect(await db.data.repos.settings.get('training.restSeconds')).toBe(60));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    const picker = await screen.findByRole('region', { name: 'Ajouter un exercice à la séance' });
    fireEvent.change(within(picker).getByLabelText('Rechercher un exercice'), { target: { value: 'curl marteau' } });
    fireEvent.click(within(picker).getByRole('button', { name: /^Curl marteau$/ }));
    await validateNext('Curl marteau', '14', '12');
    expect(await restTimer()).toHaveTextContent('1:00');
  });

  it('« +30 s » repousse l’échéance persistée ; « Passer » l’efface et ferme l’activité', async () => {
    const f = fakes();
    openSession(f);
    await startFromRoutine();
    await validateNext('Développé couché à la barre', '60', '8');
    await restTimer();
    fireEvent.click(screen.getByRole('button', { name: '+30 s' }));
    expect(await screen.findByText('3:00')).toBeInTheDocument();
    expect(await one('SELECT rest_timer_end_at FROM workout')).toEqual({ rest_timer_end_at: '2026-11-09T17:03:00.000Z' });
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
    await waitFor(() => expect(screen.queryByRole('timer', { name: 'Repos restant' })).toBeNull());
    expect(await one('SELECT rest_timer_end_at FROM workout')).toEqual({ rest_timer_end_at: null });
    expect(f.calls.ends).toBeGreaterThanOrEqual(1);
    expect(f.calls.cancel).toBeGreaterThanOrEqual(1);
  });

  it('verrouillage : le reste est recalculé depuis la date de fin ; au retour après l’échéance, repos terminé proprement', async () => {
    const f = fakes();
    const first = openSession(f);
    await startFromRoutine();
    await validateNext('Développé couché à la barre', '60', '8');
    await restTimer();
    first.unmount();
    db.clock.advance(100_000);
    openSession(f);
    expect(await restTimer()).toHaveTextContent('0:50');
    expect(f.scheduled).toHaveLength(1);
    db.clock.advance(60_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await screen.findByText('Repos terminé')).toBeInTheDocument();
    expect(screen.queryByRole('timer', { name: 'Repos restant' })).toBeNull();
    expect(await one('SELECT rest_timer_end_at FROM workout')).toEqual({ rest_timer_end_at: null });
    expect(f.calls.ends).toBeGreaterThanOrEqual(1);
  });

  it('notifications refusées : le dit, sans rien promettre', async () => {
    const f = fakes({ permission: 'denied' });
    openSession(f);
    await startFromRoutine();
    await validateNext('Développé couché à la barre', '60', '8');
    expect(await screen.findByText(/Notifications refusées/)).toBeInTheDocument();
    expect(screen.queryByText(/Une notification sonnera/)).toBeNull();
    expect(f.scheduled).toEqual([]);
  });

  it('Live Activity indisponible : minuteur dans l’app et phrase de repli', async () => {
    const f = fakes({ availability: { available: false, reason: 'disabled', error: null } });
    openSession(f);
    await startFromRoutine();
    await validateNext('Développé couché à la barre', '60', '8');
    expect(await restTimer()).toHaveTextContent('2:30');
    expect(await screen.findByText(/Live Activity indisponible/)).toBeInTheDocument();
    expect(f.calls.starts).toEqual([]);
  });

  it('PC : minuteur dans l’app seulement, aucune notification ni Live Activity', async () => {
    const f = fakes({ permission: 'unavailable' });
    openSession(f, 'other');
    await startFromRoutine();
    await validateNext('Développé couché à la barre', '60', '8');
    expect(await restTimer()).toHaveTextContent('2:30');
    expect(f.calls.permission).toBe(0);
    expect(f.calls.starts).toEqual([]);
    expect(f.scheduled).toEqual([]);
  });
});

describe('clavier PC (critère 5)', () => {
  it('Entrée dans un champ valide la série ; Échap ferme le choix d’un exercice', async () => {
    openSession(fakes(), 'other');
    await startFromRoutine();
    const set = await firstOpenSet('Développé couché à la barre');
    fireEvent.change(within(set).getByLabelText('Charge (kg)'), { target: { value: '60' } });
    const reps = within(set).getByLabelText('Répétitions');
    fireEvent.change(reps, { target: { value: '8' } });
    fireEvent.keyDown(reps, { key: 'Enter' });
    expect(await within(set).findByText('Validée')).toBeInTheDocument();
    expect(await count('SELECT COUNT(*) AS n FROM workout_set WHERE done = 1')).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    const picker = await screen.findByRole('region', { name: 'Ajouter un exercice à la séance' });
    fireEvent.keyDown(picker, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Ajouter un exercice à la séance' })).toBeNull();
  });

  it('champs de saisie : pavé numérique, état écrit en texte (pas seulement en couleur)', async () => {
    openSession();
    await startFromRoutine();
    const set = await firstOpenSet('Développé couché à la barre');
    expect(within(set).getByLabelText('Charge (kg)')).toHaveAttribute('inputmode', 'decimal');
    expect(within(set).getByLabelText('Répétitions')).toHaveAttribute('inputmode', 'numeric');
    expect(within(set).getByLabelText('RIR (facultatif)')).toHaveAttribute('inputmode', 'numeric');
    expect(within(set).getByText('À faire')).toBeInTheDocument();
  });
});
