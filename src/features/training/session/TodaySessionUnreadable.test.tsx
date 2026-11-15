import { cleanup, render, screen, within } from '@testing-library/react';
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
import type * as PrescriptionContextModule from './prescriptionContext';
import { TodaySessionCard } from './TodaySessionCard';

const flags = vi.hoisted(() => ({ unreadable: false }));
vi.mock('./prescriptionContext', async (importOriginal) => {
  const original = await importOriginal<typeof PrescriptionContextModule>();
  return {
    ...original,
    loadPrescriptionContext: (...args: Parameters<typeof original.loadPrescriptionContext>) => (flags.unreadable ? Promise.reject(new Error('lecture impossible')) : original.loadPrescriptionContext(...args)),
  };
});

/**
 * ERGO-02b (critère 5, revue d'ERGO-02 point 5) : dans le tableau de la séance du jour (PC), une charge qu'on ne peut pas proposer faute
 * d'historique dit « à saisir » ; une charge dont l'aperçu n'a pas pu être lu dit « aperçu illisible » (jamais le même mot).
 */
const DEVICE = '60000000-0000-4000-8000-0000000000f6' as DeviceId;
const u = (n: number): string => `5e4d3c00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (id: number, exerciseId: string, exerciseName: string, position: number) => ({ id: u(id), exerciseId, exerciseName, sets: 3, repMin: 8, repMax: 10, rir: null, restSec: 120, position });
const PROGRAM: RoutineInput = {
  id: u(20),
  name: 'Haut seul',
  mode: 'programme',
  days: [{ id: u(21), name: 'Haut A', dayOrder: 1, exercises: [line(22, 'bench-press-barbell', 'Développé couché barre', 0), line(23, 'curl-barbell', 'Curl barre', 1)] }],
};
let db: TestDb;
const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TodaySessionCard />
    </AppContainerProvider>,
  );
async function follow(): Promise<void> {
  await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(PROGRAM));
  const spec = createMesocycleSpec({ routineId: PROGRAM.id ?? '', startDate: '2026-11-09' as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
  if (spec === null) throw new Error('spec');
  await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec));
}
const loadCells = async (): Promise<string[]> => {
  const card = await screen.findByRole('region', { name: 'Séance du jour' });
  const table = await within(card).findByRole('table', { name: 'Exercices de la séance du jour' });
  await within(card).findByText(/≈ \d+ min/);
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[3]?.textContent ?? '');
};

beforeAll(async () => {
  await import('./todaySessionPreview');
});
beforeEach(async () => {
  flags.unreadable = false;
  useNavigationStore.setState(INITIAL_NAVIGATION);
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === PC_MEDIA_QUERY, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  db = await openBaseDb(DEVICE, '2026-11-10T07:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('ERGO-02b : « à saisir » et « aperçu illisible » sont deux raisons distinctes', () => {
  it('aucun historique : « — à saisir » (rien à proposer), jamais « aperçu illisible »', async () => {
    await follow();
    mount();
    const cells = await loadCells();
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell).toContain('à saisir');
      expect(cell).not.toContain('aperçu illisible');
    }
  });

  it('lecture de l’aperçu impossible : « — aperçu illisible », jamais « à saisir »', async () => {
    flags.unreadable = true;
    await follow();
    mount();
    const cells = await loadCells();
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell).toContain('aperçu illisible');
      expect(cell).not.toContain('à saisir');
    }
  });
});
