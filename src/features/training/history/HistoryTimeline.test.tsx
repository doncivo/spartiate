import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { WorkoutWithSets } from '../../../domain/training';
import type { DeviceId, IsoDateTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { PAST, PAST_WORKOUT_ID, seedPastWorkout, setRow } from '../../../../tests/fixtures/training/workout';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I6-03b (§ 13.8 « Replay set par set », constat 11 de la relecture Codex du 12/11) : depuis le détail d'une séance du journal, « Voir le déroulé série
 * par série » montre les séries dans l'ordre RÉEL des validations, la charge, les répétitions et le repos réels face aux cibles, avec des écarts dits
 * en TEXTE (§ 18.6 : jamais la couleur seule) ; un instant manquant donne un repos inconnu, jamais 0. Rien n'est écrit. Distinct de « Refaire cette
 * séance » (copie en nouvelle séance).
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e7' as DeviceId;
const iso = (v: string): IsoDateTime => v as IsoDateTime;
const u = (n: number): string => `5e1a0c2d-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base = { workoutId: PAST_WORKOUT_ID, targetRestSec: 120 };
const SOURCE: WorkoutWithSets = {
  ...PAST,
  sets: [
    setRow(0, { ...base, id: u(31), position: 0, done: true, reps: 8, loadKg: 60, targetLoadKg: 60, doneAt: iso('2026-10-26T21:00:00.000Z') }),
    setRow(3, { ...base, id: u(32), position: 1, targetRepsMin: 8, targetRepsMax: 12, done: true, reps: 5, loadKg: 50, targetLoadKg: 50, doneAt: iso('2026-10-26T21:03:30.000Z') }),
    setRow(0, { ...base, id: u(33), position: 2, done: true, reps: 7, loadKg: 62.5, targetLoadKg: 60, doneAt: null }),
    setRow(3, { ...base, id: u(34), position: 3 }),
  ],
};

let db: TestDb;
async function openTimeline(): Promise<HTMLElement> {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'history' } as Route));
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Haut A/ }));
  await screen.findByRole('region', { name: 'Détail de la séance' });
  fireEvent.click(screen.getByRole('button', { name: 'Voir le déroulé série par série' }));
  return screen.findByRole('region', { name: 'Déroulé série par série' });
}

beforeAll(async () => {
  await Promise.all([import('../TrainingScreen'), import('./HistoryView'), import('./HistoryTimelineView')]);
}, 60_000);
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-12T17:00:00.000Z');
  await seedPastWorkout(db.driver, SOURCE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('déroulé série par série', () => {
  it('ordre réel, écarts en texte, repos réel face à la cible, repos inconnu pour un instant manquant', async () => {
    const timeline = await openTimeline();
    const steps = within(timeline).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    const [first, second, third] = steps as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(first).getByText('1. Développé couché à la barre · série 1')).toBeInTheDocument();
    expect(within(first).getByText(/^Validée à \d{2}:00$/)).toBeInTheDocument();
    expect(within(first).getByText('Charge : 60 kg (cible 60 kg) — conforme')).toBeInTheDocument();
    expect(within(first).getByText('Répétitions : 8 (cible 6 à 10) — conforme')).toBeInTheDocument();
    expect(within(first).getByText('Repos ensuite : 3 min 30 s (cible 2 min) — plus long de 1 min 30 s')).toBeInTheDocument();
    expect(within(second).getByText('2. Rowing à la barre · série 1')).toBeInTheDocument();
    expect(within(second).getByText('Répétitions : 5 (cible 8 à 12) — 3 de moins')).toBeInTheDocument();
    expect(within(second).getByText('Repos ensuite : inconnu (instant de validation manquant)')).toBeInTheDocument();
    expect(within(third).getByText('3. Développé couché à la barre · série 2')).toBeInTheDocument();
    expect(within(third).getByText('Instant de validation inconnu')).toBeInTheDocument();
    expect(within(third).getByText('Charge : 62,5 kg (cible 60 kg) — 2,5 kg de plus')).toBeInTheDocument();
    expect(within(third).getByText('Dernière série de la séance.')).toBeInTheDocument();
    expect(within(timeline).getByText('1 série non validée, absente du déroulé.')).toBeInTheDocument();
    expect(within(timeline).getByText('1 série sans instant de validation : sa place est estimée, son repos est inconnu.')).toBeInTheDocument();
    // 24 h, jamais « AM » / « PM » ; aucune valeur « 0 s » inventée pour un repos inconnu.
    expect(timeline.textContent).not.toMatch(/AM|PM/);
    expect(within(second).queryByText(/Repos ensuite : 0 s/)).toBeNull();
  });

  it('lecture seule : aucune séance créée, aucune écriture ; « Refaire cette séance » reste un bouton distinct', async () => {
    const outbox = () => db.driver.select('SELECT table_name, row_id, field FROM sync_outbox ORDER BY table_name, row_id, field');
    const before = await outbox();
    await openTimeline();
    expect(await db.driver.select('SELECT 1 FROM workout WHERE ended_at IS NULL')).toEqual([]);
    expect(await outbox()).toEqual(before);
    expect(screen.getByRole('button', { name: 'Refaire cette séance' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rejouer cette séance' })).toBeNull();
    // Le bouton se replie.
    fireEvent.click(screen.getByRole('button', { name: 'Voir le déroulé série par série' }));
    expect(screen.queryByRole('region', { name: 'Déroulé série par série' })).toBeNull();
  });
});
