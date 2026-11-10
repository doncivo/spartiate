import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RecoveryDayOutput } from '../../../domain/recovery';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { localDayOf } from '../cycle/currentCycle';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I5-02 point 2.2 (§ 16.4, § 16.7) : au lancement d'une séance, Recovery ≤ 33 lue dans `recovery_day` → bandeau « Journée rouge : maintien
 * des charges proposé », un tap pour accepter ou ignorer, choix gardé pour la séance (réglage local), jamais imposé ; Recovery nulle ou
 * absente : aucun bandeau. Accepté : la proposition ne monte pas et le dit ; ignoré : inchangée. Recovery Split : pourcentage par muscle
 * principal, muscle sans ligne « inconnu ». Base SQLite réelle (wasm), contenu embarqué, profil Fitness Park Antony (barre 2,5 kg).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e9' as DeviceId;
const u = (n: number): string => `3c5d7e9f-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CURRENT = u(9);
const BENCH = 'Développé couché à la barre';
const BENCH_ID = 'bench-press-barbell';
const SQUAT_ID = 'squat-barbell';
const BANNER = 'Journée rouge : maintien des charges proposé';

const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };

let db: TestDb;
const openSession = (os: 'ios' | 'other' = 'other') => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os, notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};

/** Séance close de développé couché à 100 kg, haut de plage atteint (10 · 10 · 10) ; trois jours passent ensuite. */
async function seedPast(): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: u(1), name: 'Haut A' });
  const w = await r.addExercise(u(1), { exerciseId: BENCH_ID, exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 10, loadKg: 100 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(u(1)));
  db.clock.advance(3 * 86_400_000);
}
async function seedCurrent(withSquat = false): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: CURRENT, name: 'Haut B' });
  await r.addExercise(CURRENT, { exerciseId: BENCH_ID, exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  if (withSquat) await r.addExercise(CURRENT, { exerciseId: SQUAT_ID, exerciseName: 'Squat à la barre', sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
}
/** Résumé du jour de la séance (écrit comme l'iPhone), Recovery `recovery` (null : abstention) ; muscles fournis. */
async function seedRecovery(recovery: number | null, muscles: readonly { readonly muscleId: string; readonly percent: number }[] = []): Promise<void> {
  const day = localDayOf(db.clock.nowMs());
  const now = new Date(db.clock.nowMs()).toISOString();
  const output: RecoveryDayOutput = {
    summary: {
      day, level: recovery === null ? 'A' : 'C', recovery, abstainReason: recovery === null ? 'baseline_incomplete' : null, quality: recovery === null ? 'insufficient' : 'good',
      exertion: 2, exertionPrevDay: 3, sleepMinutes: null, sleepNeedMinutes: 450, sleepScore: null, bedtimeSigmaMinutes: null, targetZone: null, hrvMs: null, restingHr: null,
      learningNights: recovery === null ? 3 : 14, contributors: [], explanationKeys: [], computedAt: now,
    },
    muscles: muscles.map((m) => ({ day, muscleId: m.muscleId, group: 'Torse', percent: m.percent, hours: 72, lastWorkedAt: now, readyAt: now })),
  };
  await (await db.data.repos.recovery()).saveDay(output);
}
const block = async () => screen.findByRole('region', { name: BENCH });
const proposal = async () => within(await block()).findByRole('group', { name: 'Proposition' });
const banner = async () => screen.findByRole('region', { name: 'Journée rouge' });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-01T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('bandeau « journée rouge » (§ 16.7)', () => {
  beforeEach(async () => {
    await seedPast();
    await seedCurrent();
  });

  it.each(['other', 'ios'] as const)('Recovery 20 (%s) : bandeau, rien n’est appliqué sans geste ; accepter : aucune hausse, dit dans la phrase, gardé à la reprise', async (os) => {
    await seedRecovery(20);
    const view = openSession(os);
    const b = await banner();
    expect(within(b).getByText(BANNER)).toBeInTheDocument();
    // D-93 révisée : la phrase dit le maintien, jamais une baisse automatique.
    expect(within(b).getByText(/aucune baisse automatique/)).toBeInTheDocument();
    // Proposition habituelle tant qu'Ali n'a rien choisi.
    expect(await within(await proposal()).findByText('102,5 kg × 8 · 8 · 8')).toBeInTheDocument();
    fireEvent.click(within(b).getByRole('button', { name: 'Accepter le maintien' }));
    expect(await within(await proposal()).findByText('100 kg × 10 · 10 · 10')).toBeInTheDocument();
    expect(within(await proposal()).getByText('Journée rouge : charges maintenues, aucune hausse ni baisse automatique ; estimation, pas un avis médical.')).toBeInTheDocument();
    expect(await within(await banner()).findByText('Journée rouge : maintien des charges accepté pour cette séance.')).toBeInTheDocument();
    expect(within(await banner()).queryByRole('button', { name: 'Accepter le maintien' })).toBeNull();
    // Reprise (fermeture puis réouverture) : le choix vaut pour cette séance, sans nouvelle question.
    view.unmount();
    openSession(os);
    expect(await within(await banner()).findByText('Journée rouge : maintien des charges accepté pour cette séance.')).toBeInTheDocument();
    expect(await within(await proposal()).findByText('100 kg × 10 · 10 · 10')).toBeInTheDocument();
  });

  it('ignorer : proposition inchangée, choix dit et gardé', async () => {
    await seedRecovery(33);
    const view = openSession();
    fireEvent.click(within(await banner()).getByRole('button', { name: 'Ignorer' }));
    expect(await within(await banner()).findByText('Journée rouge ignorée : propositions habituelles pour cette séance.')).toBeInTheDocument();
    expect(await within(await proposal()).findByText('102,5 kg × 8 · 8 · 8')).toBeInTheDocument();
    view.unmount();
    openSession();
    expect(await within(await banner()).findByText('Journée rouge ignorée : propositions habituelles pour cette séance.')).toBeInTheDocument();
    expect(await within(await proposal()).findByText('102,5 kg × 8 · 8 · 8')).toBeInTheDocument();
  });

  it('choix d’une autre séance : sans effet, la question est reposée', async () => {
    await seedRecovery(20);
    await db.data.repos.settings.set('training.redDay', { v: 1, workoutId: u(1), choice: 'accepted' });
    openSession();
    expect(within(await banner()).getByRole('button', { name: 'Accepter le maintien' })).toBeInTheDocument();
    expect(await within(await proposal()).findByText('102,5 kg × 8 · 8 · 8')).toBeInTheDocument();
  });

  it.each([
    ['Recovery nulle (abstention)', async () => seedRecovery(null)],
    ['Recovery 34', async () => seedRecovery(34)],
    ['aucun résumé du jour', async () => undefined],
  ])('%s : aucun bandeau, proposition habituelle', async (_label, seed) => {
    await seed();
    openSession();
    expect(await within(await proposal()).findByText('102,5 kg × 8 · 8 · 8')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Journée rouge' })).toBeNull();
    expect(screen.queryByText(BANNER)).toBeNull();
  });
});

describe('Recovery Split sur la séance', () => {
  beforeEach(async () => {
    await seedPast();
    await seedCurrent(true);
  });

  it('pourcentage et repère par muscle principal ; muscle sans ligne « inconnu » ; suggestion prudente sous 50 %, séance inchangée', async () => {
    await seedRecovery(70, [{ muscleId: 'chest', percent: 40 }, { muscleId: 'lats', percent: 10 }]);
    openSession();
    const split = await screen.findByRole('region', { name: 'Récupération par muscle' });
    expect(await within(split).findByText('Pectoraux : 40 % · à ménager')).toBeInTheDocument();
    expect(within(split).getByText('Quadriceps : inconnu')).toBeInTheDocument();
    // Muscle hors séance (dos) : jamais montré ; inconnu : jamais 0 ni 100 %.
    expect(within(split).queryByText(/Grand dorsal/)).toBeNull();
    expect(within(split).queryByText(/Quadriceps : (0|100) %/)).toBeNull();
    expect(within(split).getByText('À ménager aujourd’hui : Pectoraux (moins de 50 %). La séance n’est pas modifiée.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Journée rouge' })).toBeNull();
  });

  it('aucune ligne du jour : tous les muscles « inconnu », aucune suggestion', async () => {
    openSession();
    const split = await screen.findByRole('region', { name: 'Récupération par muscle' });
    expect(await within(split).findByText('Pectoraux : inconnu')).toBeInTheDocument();
    expect(within(split).getByText('Quadriceps : inconnu')).toBeInTheDocument();
    expect(within(split).queryByText(/À ménager aujourd’hui/)).toBeNull();
  });

  it('muscle prêt (≥ 50 %)', async () => {
    await seedRecovery(80, [{ muscleId: 'chest', percent: 85 }, { muscleId: 'quads', percent: 50 }]);
    openSession();
    const split = await screen.findByRole('region', { name: 'Récupération par muscle' });
    expect(await within(split).findByText('Pectoraux : 85 % · prêt')).toBeInTheDocument();
    expect(within(split).getByText('Quadriceps : 50 % · prêt')).toBeInTheDocument();
    expect(within(split).queryByText(/À ménager aujourd’hui/)).toBeNull();
  });
});
