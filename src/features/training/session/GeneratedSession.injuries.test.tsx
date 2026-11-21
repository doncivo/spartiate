import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import { declareInjury } from '../../../domain/training/injuries';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/** BLESSURES-a : une gêne active écarte de la proposition les exercices qui sollicitent le muscle déclaré (jamais l'inverse). */
const DEVICE = '60000000-0000-4000-8000-0000000000c6' as DeviceId;
const u = (n: number): string => `4d3c2b00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (n: number, exerciseId: string, exerciseName: string) => ({ id: u(10 + n), exerciseId, exerciseName, sets: 3, repMin: 6, repMax: 10, rir: null, restSec: 90, position: n });
const BENCH = 'Développé couché à la barre';
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut',
  mode: 'programme',
  days: [{ id: u(2), name: 'Haut A', dayOrder: 1, exercises: [line(0, 'bench-press-barbell', BENCH), line(1, 'row-barbell', 'Rowing à la barre')] }],
};

let db: TestDb;
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function headings(): Promise<string[]> {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  render(
    <AppContainerProvider container={container}>
      <TrainingScreen session={{ os: 'other' }} />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Proposer une séance' }));
  const region = await screen.findByRole('region', { name: 'Séance proposée' });
  const list = within(region).getByRole('list', { name: 'Exercices proposés' });
  return within(list).getAllByRole('listitem').map((li) => within(li).getByRole('heading').textContent ?? '');
}

describe('séance proposée et gênes (BLESSURES-a)', () => {
  it('sans gêne : le développé couché est proposé (témoin)', async () => {
    expect(await headings()).toContain(BENCH);
  });

  it('gêne active sur les pectoraux : aucun exercice qui les sollicite n’est proposé ; guérie : il revient', async () => {
    const r = declareInjury({ v: 1, items: [] }, { id: 'g1', muscleId: 'chest', patterns: [], startedOn: '2026-11-01' as LocalDate, note: null }, '2026-11-09' as LocalDate);
    if (!r.ok) throw new Error(r.issue);
    await db.data.repos.settings.set('training.injuries', r.value);
    const shown = await headings();
    expect(shown).not.toContain(BENCH);
    expect(shown).toContain('Rowing à la barre');
  });
});
