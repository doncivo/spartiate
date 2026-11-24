import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import { recordsOfSet } from '../../../domain/training/sessionRecords';
import type { DeviceId } from '../../../domain/types';
import type { DataAccess } from '../../../db/repositories';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { createFakeHaptics, type FakeHaptics } from '../../../platform/haptics/fake';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { loadTrainingContent } from '../content';
import { TrainingScreen } from '../TrainingScreen';

/**
 * SEANCE-0292b (§ 17.1 a, C-191, D-540) : record signalé EN SÉANCE, à la validation de la série qui l'établit (texte dans l'écran, lu par
 * les technologies d'assistance, et retour haptique), sur l'iPhone comme sur le PC ; aucune notification système (l'app est au premier plan).
 */
const DEVICE = '60000000-0000-4000-8000-0000000002e7' as DeviceId;
const u = (n: number): string => `4d6e8f0a-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = 'Développé couché à la barre';
const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };

let db: TestDb;
let haptics: FakeHaptics;
const mount = (data: DataAccess = db.data) => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data, haptics })}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};

// Intermittence (relecture, 76d1feb7) : les `findBy` (1 s) attendaient aussi la PREMIÈRE importation des modules à la demande (contenu JSON,
// progression, contrôle d'aberration à la validation, journée rouge…), transformée à froid pendant le test : sur un poste chargé, l'écran
// restait « Chargement… » ou la série validée n'était pas encore écrite. Préchauffées ici (précédent : Circuit.test.tsx), aucun délai allongé.
beforeAll(async () => {
  await Promise.all([
    loadTrainingContent(),
    import('./ActiveSession'),
    import('./ExerciseProgression'),
    import('./outlierCheck'),
    import('./redDayState'),
    import('./RecoverySession'),
    import('./ExerciseExtras'),
    import('../media/ExerciseMedia'),
    import('./WorkoutSummary'),
  ]);
});

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  haptics = createFakeHaptics();
  db = await openBaseDb(DEVICE, '2026-11-04T17:00:00.000Z');
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: u(1), name: 'Haut A' });
  const w = await r.addExercise(u(1), { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 10, loadKg: 60 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(u(1)));
  db.clock.advance(3 * 86_400_000);
  await r.start({ source: 'empty', id: u(2), name: 'Haut B' });
  await r.addExercise(u(2), { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('§ 17.1 a : records signalés en séance', () => {
  it('recordsOfSet : seuls les records établis par la série validée', () => {
    const recs = [
      { exerciseId: 'a', exerciseName: 'A', kind: 'load' as const, value: 65, previous: 60, setId: 's1' },
      { exerciseId: 'a', exerciseName: 'A', kind: 'set-volume' as const, value: 650, previous: 600, setId: 's2' },
    ];
    expect(recordsOfSet(recs, 's1').map((r) => r.kind)).toEqual(['load']);
    expect(recordsOfSet(recs, 'x')).toEqual([]);
  });

  it('65 kg × 8 après 60 kg × 10 : « Record » dit à la validation, retour haptique ; une série sans record ne dit rien', async () => {
    mount();
    const block = await screen.findByRole('region', { name: BENCH });
    const rows = within(block).getAllByRole('group', { name: /^Série \d+$/ });
    const first = rows[0] as HTMLElement;
    fireEvent.change(within(first).getByLabelText('Charge (kg)'), { target: { value: '55' } });
    fireEvent.change(within(first).getByLabelText('Répétitions'), { target: { value: '8' } });
    fireEvent.click(within(first).getByRole('button', { name: 'Valider la série' }));
    expect(await within(first).findByText('55 kg × 8')).toBeInTheDocument();
    expect(screen.queryByText(/^Record/)).toBeNull();
    const second = within(block).getAllByRole('group', { name: /^Série \d+$/ })[1] as HTMLElement;
    fireEvent.change(within(second).getByLabelText('Charge (kg)'), { target: { value: '65' } });
    fireEvent.change(within(second).getByLabelText('Répétitions'), { target: { value: '8' } });
    fireEvent.click(within(second).getByRole('button', { name: 'Valider la série' }));
    const status = await screen.findByText(/^Record · Développé couché à la barre/);
    expect(status.closest('[role="status"]')).not.toBeNull();
    expect(status.textContent).toContain('65 kg');
    expect(haptics.calls).toContainEqual({ type: 'impact', style: 'heavy' });
  });

  // Relecture (E) : la lecture des records n'est pas attendue ; une réponse ancienne (série précédente, lecture lente) ne doit pas écraser
  // l'état dit pour la série validée ensuite (ni dire un record après coup, ni vibrer).
  it('lecture lente de la série 1 (record) rendue après la série 2 (sans record) : rien n’est dit après coup, aucun retour haptique', async () => {
    let armed = false;
    let release: (() => void) | null = null;
    const workouts = async () => {
      const repo = await db.data.repos.workouts();
      return new Proxy(repo, {
        get(target, key, receiver) {
          if (key === 'summary') {
            return async (id: string) => {
              const res = await target.summary(id);
              if (armed) {
                armed = false;
                await new Promise<void>((resolve) => {
                  release = resolve;
                });
              }
              return res;
            };
          }
          const v = Reflect.get(target, key, receiver) as unknown;
          return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
      });
    };
    const data = { ...db.data, repos: new Proxy(db.data.repos, { get: (t, k, r) => (k === 'workouts' ? workouts : (Reflect.get(t, k, r) as unknown)) }) } as DataAccess;
    mount(data);
    const block = await screen.findByRole('region', { name: BENCH });
    const first = within(block).getAllByRole('group', { name: /^Série \d+$/ })[0] as HTMLElement;
    armed = true;
    fireEvent.change(within(first).getByLabelText('Charge (kg)'), { target: { value: '65' } });
    fireEvent.change(within(first).getByLabelText('Répétitions'), { target: { value: '8' } });
    fireEvent.click(within(first).getByRole('button', { name: 'Valider la série' }));
    expect(await within(first).findByText('65 kg × 8')).toBeInTheDocument();
    const second = within(block).getAllByRole('group', { name: /^Série \d+$/ })[1] as HTMLElement;
    fireEvent.change(within(second).getByLabelText('Charge (kg)'), { target: { value: '50' } });
    fireEvent.change(within(second).getByLabelText('Répétitions'), { target: { value: '8' } });
    fireEvent.click(within(second).getByRole('button', { name: 'Valider la série' }));
    expect(await within(second).findByText('50 kg × 8')).toBeInTheDocument();
    // Aucun délai fixe (relecture de SEANCE-0292b) : on attend que la lecture des records de la première série soit en attente,
    // puis on la libère et on vide la file des microtâches (la réponse ancienne doit être ignorée par le jeton).
    await waitFor(() => expect(release).not.toBeNull());
    await act(async () => {
      release?.();
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    expect(screen.queryByText(/^Record/)).toBeNull();
    expect(haptics.calls).not.toContainEqual({ type: 'impact', style: 'heavy' });
  });
});
