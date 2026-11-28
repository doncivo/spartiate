import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { createHlcClock } from '../../domain/hlc';
import type { RoutineInput } from '../../domain/training';
import type { DeviceId } from '../../domain/types';
import type { TestDb } from '../../db/repositories/sql/testSetup';
import { seedPastWorkout } from '../../../tests/fixtures/training/workout';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { readTrainingData } from './trainingState';
import { TrainingScreen } from './TrainingScreen';

/**
 * FIX-0302c (tests seulement, jamais importé par l'app) : préchauffe, en `beforeAll`, tous les modules chargés à la demande par les écrans de
 * séance (lazy, `import()`, JSON du catalogue, fabriques de dépôts), pour qu'aucun import à froid ne tombe pendant une attente `findBy*` d'une
 * seconde. Un montage à blanc de la séance et de l'historique (détail compris) termine le préchauffage : mesuré, la première attente d'un fichier
 * passe de 284 à 975 ms à 80 à 120 ms (premier rendu des blocs, hors import). La garde `warmTraining.test.ts` exige que chaque `import()` littéral de src/features/training figure ici.
 */
export async function warmTraining(db: TestDb): Promise<void> {
  await Promise.all([
    import('./TrainingScreen'),
    import('./history/HistoryView'),
    import('./history/HistoryTimelineView'),
    import('./cycle/CycleView'),
    import('../cardio/CardioView'),
    import('./media/ExerciseMedia'),
    import('./RoutineCircuitUi'),
    import('./import/ProgramImportView'),
    import('./import/PdfReader'),
    import('./session/CircuitUi'),
    import('./session/ExerciseExtras'),
    import('./session/ExerciseProgression'),
    import('./session/RecoverySession'),
    import('./session/ReplaceExercise'),
    import('./session/outlierCheck'),
    import('./session/redDayState'),
    import('./session/sessionGestures'),
    import('./session/WorkoutSummary'),
    import('./session/GeneratedSession'),
    import('./session/todaySessionPreview'),
    import('../../../content/equipment-profiles/profiles.json'),
    import('../../../content/exercises/equipment.json'),
    import('../../../content/exercises/exercises.json'),
    import('../../../content/exercises/muscles.json'),
    import('../../../content/programs/full-body-3j.json'),
    import('../../../content/programs/haut-bas-4j.json'),
    import('../../../content/programs/maison-halteres-3j.json'),
    import('../../../content/programs/ppl-6j.json'),
  ]);
  await readTrainingData(db.data);
  const repos = db.data.repos as unknown as Record<string, unknown>;
  for (const key of Object.keys(repos)) {
    const factory = repos[key];
    if (typeof factory === 'function') await (factory as () => unknown).call(repos);
  }
  await warmMount(db);
}

const ROUTINE: RoutineInput = {
  id: '4d3c2b00-0000-4000-8000-0000000000a1',
  name: 'Haut / Bas',
  mode: 'programme',
  days: [
    {
      id: '4d3c2b00-0000-4000-8000-0000000000a2',
      name: 'Haut A',
      dayOrder: 1,
      exercises: [{ id: '4d3c2b00-0000-4000-8000-0000000000a3', exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 }],
    },
  ],
};

/** Montage à blanc (séance puis historique et son détail) sur une base à part, sans délai allongé : on attend les vrais repères, au besoin 30 s. */
async function warmMount(db: TestDb): Promise<void> {
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
  await seedPastWorkout(db.driver);
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: '60000000-0000-4000-8000-0000000000f0' as DeviceId }), data: db.data });
  const mount = async (route: Route, button: RegExp): Promise<void> => {
    useNavigationStore.setState(INITIAL_NAVIGATION);
    act(() => useNavigationStore.getState().navigate(route));
    render(createElement(AppContainerProvider, { container, children: createElement(TrainingScreen) }));
    const found = await screen.findByRole('button', { name: button }, { timeout: 30_000 });
    if (route.tab === 'training' && route.screen === 'history') {
      fireEvent.click(found);
      await screen.findByRole('region', { name: 'Détail de la séance' }, { timeout: 30_000 });
    }
    cleanup();
  };
  try {
    await mount({ tab: 'training', screen: 'session' } as Route, /^Démarrer « Haut A »/);
    await mount({ tab: 'training', screen: 'history' } as Route, /Haut A/);
  } finally {
    cleanup();
    useNavigationStore.setState(INITIAL_NAVIGATION);
  }
}
