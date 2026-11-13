import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CardioSessionInput } from '../../domain/cardio';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { CardioProgress } from './CardioProgress';

/** I6-06 (D-223) : Progrès › Cardio, quatre semaines, sans faux zéro. Fixtures synthétiques. */
const DEVICE = '60000000-0000-4000-8000-0000000000cb' as DeviceId;
const NOW = '2026-11-13T18:00:00.000Z';
let db: TestDb;
const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } })}>
      <CardioProgress timeZone="Europe/Paris" />
    </AppContainerProvider>,
  );
const add = async (over: Partial<CardioSessionInput>) =>
  (await db.data.repos.cardio()).add({ kind: 'run', startedAt: '2026-11-13T07:00:00.000Z', durationSec: 1800, distanceM: 5000, avgHr: null, rpe: 6, notes: '', source: 'manual', ...over });

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Progrès › Cardio', () => {
  it('sans séance : la carte le dit, aucun total à zéro', async () => {
    mount();
    expect(await screen.findByText('Aucune séance de cardio sur les quatre dernières semaines.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cardio' })).toBeInTheDocument();
    expect(screen.queryByText(/0 km/)).toBeNull();
  });

  it('séances par semaine (du lundi), la plus récente d’abord ; distance inconnue dite, jamais comptée 0', async () => {
    await add({});
    await add({ startedAt: '2026-11-10T07:00:00.000Z', durationSec: 2700, distanceM: null, kind: 'row' });
    await add({ startedAt: '2026-11-04T07:00:00.000Z', durationSec: 3600, distanceM: 10000 });
    mount();
    expect(await screen.findByText('Semaine du 9 nov. 2026')).toBeInTheDocument();
    expect(screen.getByText('2 séances · 1 h 15 min · 5 km (1 sans distance)')).toBeInTheDocument();
    expect(screen.getByText('1 séance · 1 h 00 min · 10 km')).toBeInTheDocument();
    expect(screen.getAllByText('aucune séance')).toHaveLength(2);
  });
});
