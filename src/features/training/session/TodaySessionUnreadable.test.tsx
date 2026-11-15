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
import type * as TrainingStateModule from '../trainingState';
import type * as PrescriptionContextModule from './prescriptionContext';
import type * as TodaySessionPreviewModule from './todaySessionPreview';
import { TodaySessionCard } from './TodaySessionCard';

const flags = vi.hoisted(() => ({ unreadable: false, trainingUnreadable: false, previewFails: false }));
vi.mock('../trainingState', async (importOriginal) => {
  const original = await importOriginal<typeof TrainingStateModule>();
  return {
    ...original,
    readTrainingData: (...args: Parameters<typeof original.readTrainingData>) => (flags.trainingUnreadable ? Promise.reject(new Error('lecture impossible')) : original.readTrainingData(...args)),
  };
});
vi.mock('./todaySessionPreview', async (importOriginal) => {
  const original = await importOriginal<typeof TodaySessionPreviewModule>();
  return {
    ...original,
    loadTodaySessionPreview: (...args: Parameters<typeof original.loadTodaySessionPreview>) => (flags.previewFails ? Promise.reject(new Error('aperçu impossible')) : original.loadTodaySessionPreview(...args)),
  };
});
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
/** `timed` : l'aperçu a abouti (durée affichée) ; sans aperçu, la ligne dit seulement le nombre d'exercices. */
const loadCells = async (timed = true): Promise<string[]> => {
  const card = await screen.findByRole('region', { name: 'Séance du jour' });
  const table = await within(card).findByRole('table', { name: 'Exercices de la séance du jour' });
  if (timed) await within(card).findByText(/≈ \d+ min/);
  else expect(within(card).queryByText(/≈ \d+ min/)).toBeNull();
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
  flags.trainingUnreadable = false;
  flags.previewFails = false;
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

  it('lecture des données d’entraînement impossible : toutes les lignes « — aperçu illisible », jamais « à saisir »', async () => {
    flags.trainingUnreadable = true;
    await follow();
    mount();
    const cells = await loadCells();
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell).toContain('aperçu illisible');
      expect(cell).not.toContain('à saisir');
    }
  });

  it('aperçu absent (chargement en échec) : toutes les lignes « — aperçu illisible », jamais « à saisir »', async () => {
    flags.previewFails = true;
    await follow();
    mount();
    const cells = await loadCells(false);
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell).toContain('aperçu illisible');
      expect(cell).not.toContain('à saisir');
    }
  });
});
