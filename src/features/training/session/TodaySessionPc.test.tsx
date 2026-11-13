import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import { createMesocycleSpec } from '../../../domain/training/mesocycle';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { PC_MEDIA_QUERY } from '../../../ui';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { TodaySessionCard } from './TodaySessionCard';

/**
 * ERGO-02 : (1) charge aux haltères « 2 × 26 kg » (deux haltères) ou « 26 kg » (un seul), iPhone et PC, affichage seulement (D-261) ;
 * (2) sur PC, la séance du jour est un tableau (rang, exercice, cible, charge) de tous les exercices avec « Saisir la séance ici »
 * (PC-Aujourdhui-apres.dc.html), même départ que « Lancer la séance ».
 */
const DEVICE = '60000000-0000-4000-8000-0000000000f4' as DeviceId;
const u = (n: number): string => `5e4d3c00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (id: number, exerciseId: string, exerciseName: string, position: number, repMin = 8, repMax = 10) => ({ id: u(id), exerciseId, exerciseName, sets: 3, repMin, repMax, rir: null, restSec: 120, position });
const PROGRAM: RoutineInput = {
  id: u(20),
  name: 'Haut seul',
  mode: 'programme',
  days: [
    {
      id: u(21),
      name: 'Haut A',
      dayOrder: 1,
      exercises: [
        line(22, 'bench-press-barbell', 'Développé couché barre', 0, 6, 10),
        line(23, 'incline-press-dumbbell', 'Développé incliné haltères', 1),
        line(24, 'row-dumbbell-one-arm', 'Rowing un bras', 2),
        line(25, 'curl-barbell', 'Curl barre', 3),
        line(26, 'lateral-raise-dumbbell', 'Élévations latérales', 4),
      ],
    },
  ],
};
const DONE: Readonly<Record<string, number>> = { 'bench-press-barbell': 80, 'incline-press-dumbbell': 26, 'row-dumbbell-one-arm': 26, 'curl-barbell': 30, 'lateral-raise-dumbbell': 10 };

let db: TestDb;
function viewport(layout: 'pc' | 'mobile'): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === PC_MEDIA_QUERY && layout === 'pc', media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TodaySessionCard />
    </AppContainerProvider>,
  );
async function followAndCloseOnce(): Promise<void> {
  await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(PROGRAM));
  const spec = createMesocycleSpec({ routineId: PROGRAM.id ?? '', startDate: '2026-11-09' as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
  if (spec === null) throw new Error('spec');
  await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec));
  const repo = await db.data.repos.workouts();
  const w = await repo.start({ source: 'routine', routineId: u(20), dayId: u(21) });
  for (const s of w.sets) await repo.validateSet(s.id, { reps: 8, loadKg: DONE[s.exerciseId] ?? 0 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(w.id));
}

beforeAll(async () => {
  await import('./todaySessionPreview');
});
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-10T07:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('ERGO-02 : charge aux haltères sur Aujourd’hui (iPhone)', () => {
  beforeEach(() => viewport('mobile'));

  it('deux haltères : « 2 × 26 kg » ; barre : « 80 kg » ; un seul haltère : « 26 kg »', async () => {
    await followAndCloseOnce();
    mount();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    await within(card).findByText('≈ 31 min · 5 exercices');
    const items = within(within(card).getByRole('list', { name: 'Exercices de la séance du jour' })).getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('.ct-session-card__load')?.textContent)).toEqual(['80 kg', '2 × 26 kg', '26 kg']);
  });
});

describe('ERGO-02 : séance du jour en tableau sur PC', () => {
  beforeEach(() => viewport('pc'));

  it('tableau de tous les exercices : rang, exercice, cible « 3 × 6–10 », charge ; haltères « 2 × 26 kg », un haltère « 26 kg »', async () => {
    await followAndCloseOnce();
    mount();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    const table = await within(card).findByRole('table', { name: 'Exercices de la séance du jour' });
    await within(table).findByText('2 × 26 kg');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5);
    const cells = (row: HTMLElement): string[] => within(row).getAllByRole('cell').map((c) => c.textContent ?? '');
    expect(cells(rows[0] as HTMLElement)).toEqual(['1', 'Développé couché barre', '3 × 6–10', '80 kg']);
    expect(cells(rows[1] as HTMLElement)).toEqual(['2', 'Développé incliné haltères', '3 × 8–10', '2 × 26 kg']);
    expect(cells(rows[2] as HTMLElement)[3]).toBe('26 kg');
    expect(cells(rows[4] as HTMLElement)[3]).toBe('2 × 10 kg');
    expect(within(card).queryByText(/^\+ \d+ exercices?$/)).toBeNull();
  });

  it('« Saisir la séance ici » ouvre la séance depuis le jour (comme « Lancer la séance »), seule action rouge ; « Autre séance… » en contour', async () => {
    await followAndCloseOnce();
    mount();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    expect(within(card).queryByRole('button', { name: 'Lancer la séance' })).toBeNull();
    const enter = await within(card).findByRole('button', { name: 'Saisir la séance ici' });
    expect(enter).toHaveClass('ct-button--primary');
    expect(card.querySelectorAll('.ct-button--primary')).toHaveLength(1);
    expect(within(card).getByRole('button', { name: 'Autre séance…' })).not.toHaveClass('ct-button--primary');
    fireEvent.click(enter);
    await vi.waitFor(() => expect(useNavigationStore.getState().route).toEqual({ tab: 'training', screen: 'session' }));
    const open = await (await db.data.repos.workouts()).getOpen();
    expect(open?.routineDayId).toBe(u(21));
  });
});
