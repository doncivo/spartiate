import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import type { DataAccess, Repositories } from '../../db/repositories/dataAccess';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { applyRemoteChanges } from '../sync/remoteChanges';
import { NutritionScreen } from './NutritionScreen';
import { useNutritionData } from './useNutritionData';

/** REV-01 constat 4 : un échec de relecture après un premier succès garde les valeurs mais dit qu'elles sont peut-être périmées. */
const logged = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('../../platform/desktop/log', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, logFailure: (...args: unknown[]) => void logged.calls.push(args), logDesktopFailure: (...args: unknown[]) => void logged.calls.push(args) };
});

const DEVICE = '60000000-0000-4000-8000-0000000000d6' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
let db: TestDb;
const control = { fail: false };

function flaky(): DataAccess {
  const original = db.data.repos.bodyWeights as unknown as () => Promise<Record<string, unknown>>;
  const repos = {
    ...db.data.repos,
    bodyWeights: async () => {
      const repo = await original();
      return { ...repo, listRecent: (...args: unknown[]) => (control.fail ? Promise.reject(new Error('panne simulée')) : (repo['listRecent'] as (...a: unknown[]) => unknown)(...args)) };
    },
  } as unknown as Repositories;
  return { ...db.data, repos };
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  control.fail = false;
  logged.calls.length = 0;
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('REV-01 constat 4 : relecture de Nutrition en échec', () => {
  it('le hook garde les dernières valeurs, les marque périmées, journalise un événement fixe, et efface la marque au succès', async () => {
    const data = flaky();
    const { result } = renderHook(() => useNutritionData(data, TODAY));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    const first = result.current.state;
    control.fail = true;
    await act(async () => result.current.reload());
    expect(result.current.state).toMatchObject({ status: 'ready', stale: true });
    if (first.status === 'ready' && result.current.state.status === 'ready') expect(result.current.state.snapshot).toBe(first.snapshot);
    expect(logged.calls.some((c) => c[1] === 'nutrition-reload-failed')).toBe(true);
    control.fail = false;
    await act(async () => result.current.reload());
    expect(result.current.state).toMatchObject({ status: 'ready', stale: false });
  });

  it('l’écran affiche le message périmé en français avec Réessayer, qui le retire au succès', async () => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: flaky() });
    render(
      <AppContainerProvider container={container}>
        <NutritionScreen />
      </AppContainerProvider>,
    );
    await screen.findByText('Rien de saisi aujourd’hui');
    expect(screen.queryByRole('alert')).toBeNull();
    control.fail = true;
    await act(async () => {
      await applyRemoteChanges(container, { tables: new Set(['meal_entry']) } as never);
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ces valeurs sont peut-être périmées : la relecture de Nutrition a échoué.');
    expect(screen.getByText('Rien de saisi aujourd’hui')).toBeInTheDocument();
    control.fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
