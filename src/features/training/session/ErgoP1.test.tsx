import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import { createMesocycleSpec } from '../../../domain/training/mesocycle';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { TodaySessionCard } from './TodaySessionCard';

/**
 * ERGO-01b P1 (D-238, maquette docs/maquettes/propositions/ergo-01-structure/P1-Aujourdhui-lancer-direct.svg) : avec un programme suivi
 * (cycle actif), la carte « Séance du jour » désigne le jour et le lance en un tap ; sans programme, la carte est inchangée.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f1' as DeviceId;
const u = (n: number): string => `5e4d3c00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (id: number, exerciseId: string, exerciseName: string, position: number) => ({ id: u(id), exerciseId, exerciseName, sets: 3, repMin: 8, repMax: 10, rir: null, restSec: 120, position });
const PROGRAM: RoutineInput = {
  id: u(10),
  name: 'Haut / Bas',
  mode: 'programme',
  days: [
    { id: u(11), name: 'Haut A', dayOrder: 1, exercises: [line(12, 'bench-press-barbell', 'Développé couché à la barre', 0), line(13, 'barbell-row', 'Rowing à la barre', 1)] },
    { id: u(14), name: 'Bas A', dayOrder: 2, exercises: [line(15, 'back-squat-barbell', 'Squat à la barre', 0)] },
  ],
};

let db: TestDb;
const mount = () => {
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <TodaySessionCard />
    </AppContainerProvider>,
  );
};
async function followProgram(): Promise<void> {
  await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(PROGRAM));
  const spec = createMesocycleSpec({ routineId: PROGRAM.id ?? '', startDate: '2026-11-09' as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
  if (spec === null) throw new Error('spec');
  await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec));
}
const openWorkout = () => db.data.repos.workouts().then((r) => r.getOpen());

// FIX-0223 : la carte attend son aperçu (module à la demande) ; premier import fait avant les attentes, pas pendant.
beforeAll(async () => {
  await import('./todaySessionPreview');
});
beforeEach(async () => {
  // ERGO-02 : la carte a une disposition PC (tableau) ; ces vérifications portent sur l'iPhone, viewport étroit déclaré (jsdom : 1 024 px = PC).
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-10T07:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('ERGO-01b P1 : séance du jour en un tap', () => {
  it('programme suivi : « Séance du jour », le jour désigné et ses exercices, « Lancer la séance » en action rouge unique', async () => {
    await followProgram();
    mount();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    expect(within(card).getByText('Haut A')).toBeInTheDocument();
    // FIX-0223 : la ligne porte la durée estimée (2 × 375 s → 13 min).
    expect(within(card).getByText('≈ 13 min · 2 exercices')).toBeInTheDocument();
    expect(within(card).getByText('Développé couché à la barre')).toBeInTheDocument();
    const launch = within(card).getByRole('button', { name: 'Lancer la séance' });
    expect(launch).toHaveClass('ct-button--primary');
    expect(card.querySelectorAll('.ct-button--primary')).toHaveLength(1);
    expect(within(card).getByRole('button', { name: 'Autre séance…' })).not.toHaveClass('ct-button--primary');
  });

  it('un tap : la séance du jour est ouverte depuis la routine du programme et l’écran de séance s’affiche', async () => {
    await followProgram();
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer la séance' }));
    await waitFor(async () => expect((await openWorkout())?.routineDayId).toBe(u(11)));
    const open = await openWorkout();
    expect(open?.routineId).toBe(u(10));
    expect(open?.sets.length).toBe(6);
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training', screen: 'session' });
  });

  it('après « Haut A » clos, le jour suivant du programme est proposé', async () => {
    await followProgram();
    const repo = await db.data.repos.workouts();
    const w = await repo.start({ source: 'routine', routineId: u(10), dayId: u(11) });
    for (const s of w.sets) await repo.validateSet(s.id, { reps: 8, loadKg: 60 });
    await db.data.transaction(async (repos) => (await repos.workouts()).close(w.id));
    mount();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    expect(within(card).getByText('Bas A')).toBeInTheDocument();
  });

  it('« Autre séance… » mène aux options actuelles (écran de départ), sans rien ouvrir', async () => {
    await followProgram();
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Autre séance…' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training', screen: 'session' });
    expect(await openWorkout()).toBeNull();
  });

  it('sans programme : la carte « Séance » d’avant (« Commencer une séance »)', async () => {
    mount();
    const card = await screen.findByRole('region', { name: 'Séance' });
    expect(within(card).getByRole('button', { name: 'Commencer une séance' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lancer la séance' })).toBeNull();
  });
});
