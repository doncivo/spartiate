import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { CardioView, type GpsReport } from './CardioView';

/** SEANCE-0292 (C-078) : un report GPS n'écrase pas une saisie en cours sans le demander. Données synthétiques, aucune position réelle. */
const DEVICE = '60000000-0000-4000-8000-0000000000cb' as DeviceId;
let db: TestDb;
let report: ((r: GpsReport) => void) | null = null;
const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } })}>
      <CardioView
        timeZone="Europe/Paris"
        gps={(onReport) => {
          report = onReport;
          return null;
        }}
      />
    </AppContainerProvider>,
  );
const GPS: GpsReport = { startedAt: '2026-11-13T17:00:00.000Z', durationSec: 1_800, distanceM: 5_000, track: [] };

beforeEach(async () => {
  report = null;
  db = await openBaseDb(DEVICE, '2026-11-13T18:00:00.000Z');
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('aucune requête réseau attendue'))));
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('C-078 : report GPS et saisie en cours', () => {
  it('saisie commencée (durée 45) : le report ne l’écrase pas ; « Remplacer » applique le suivi, « Garder ma saisie » le laisse', async () => {
    mount();
    const duration = await screen.findByLabelText(/^Durée/);
    fireEvent.change(duration, { target: { value: '45' } });
    act(() => report?.(GPS));
    expect(screen.getByLabelText(/^Durée/)).toHaveValue('45');
    fireEvent.click(screen.getByRole('button', { name: 'Remplacer par le suivi GPS' }));
    expect(screen.getByLabelText(/^Durée/)).toHaveValue('30:00');
    expect(screen.getByLabelText(/^Distance/)).toHaveValue('5');
  });

  it('formulaire vierge : le report remplit directement (comportement inchangé)', async () => {
    mount();
    await screen.findByLabelText(/^Durée/);
    act(() => report?.(GPS));
    expect(screen.getByLabelText(/^Durée/)).toHaveValue('30:00');
  });

  it('« Garder ma saisie » : la saisie reste, le suivi est abandonné', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText(/^Durée/), { target: { value: '45' } });
    act(() => report?.(GPS));
    fireEvent.click(screen.getByRole('button', { name: 'Garder ma saisie' }));
    expect(screen.getByLabelText(/^Durée/)).toHaveValue('45');
    expect(screen.queryByRole('button', { name: 'Remplacer par le suivi GPS' })).toBeNull();
  });
});
