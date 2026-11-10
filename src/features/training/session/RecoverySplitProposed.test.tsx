import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RecoveryDayOutput } from '../../../domain/recovery';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { localDayOf } from '../cycle/currentCycle';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I5-02 point 2.2 : Recovery Split sur la « Séance proposée » (muscle principal de chaque exercice proposé, « inconnu » sans ligne, suggestion
 * prudente sans modifier la proposition) ; blocs et textes à la demande, jamais importés statiquement par l'écran de séance.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000ea' as DeviceId;
const u = (n: number): string => `4d3c2b00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (n: number, exerciseId: string, exerciseName: string) => ({ id: u(10 + n), exerciseId, exerciseName, sets: 3, repMin: 6, repMax: 10, rir: null, restSec: 120, position: n });
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut',
  mode: 'programme',
  days: [{ id: u(2), name: 'Haut A', dayOrder: 1, exercises: [line(0, 'bench-press-barbell', 'Développé couché à la barre'), line(1, 'row-barbell', 'Rowing à la barre')] }],
};

let db: TestDb;
const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'other' }} />
    </AppContainerProvider>,
  );
};

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Recovery Split, séance proposée', () => {
  it('pectoraux à 30 % : à ménager et signalé ; dos sans ligne : inconnu ; la proposition reste la même', async () => {
    const day = localDayOf(db.clock.nowMs());
    const now = new Date(db.clock.nowMs()).toISOString();
    const output: RecoveryDayOutput = {
      summary: {
        day, level: 'C', recovery: 70, abstainReason: null, quality: 'good', exertion: 2, exertionPrevDay: 3, sleepMinutes: null, sleepNeedMinutes: 450, sleepScore: null,
        bedtimeSigmaMinutes: null, targetZone: null, hrvMs: null, restingHr: null, learningNights: 14, contributors: [], explanationKeys: [], computedAt: now,
      },
      muscles: [{ day, muscleId: 'chest', group: 'Torse', percent: 30, hours: 72, lastWorkedAt: now, readyAt: now }],
    };
    await (await db.data.repos.recovery()).saveDay(output);
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Proposer une séance' }));
    const region = await screen.findByRole('region', { name: 'Séance proposée' });
    const split = await within(region).findByRole('region', { name: 'Récupération par muscle' });
    expect(await within(split).findByText('Pectoraux : 30 % · à ménager')).toBeInTheDocument();
    expect(within(split).getByText(/ : inconnu$/)).toBeInTheDocument();
    expect(within(split).getByText('À ménager aujourd’hui : Pectoraux (moins de 50 %). La séance n’est pas modifiée.')).toBeInTheDocument();
    const list = within(region).getByRole('list', { name: 'Exercices proposés' });
    expect(within(list).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Développé couché à la barre', 'Rowing à la barre']);
  });

  it('à la demande : import() depuis l’écran de séance et la séance proposée, textes dans un catalogue à part', () => {
    for (const file of ['ActiveSession.tsx', 'GeneratedSession.tsx']) {
      const src = readFileSync(`src/features/training/session/${file}`, 'utf8');
      expect(src).toContain("import('./RecoverySession')");
      expect(src).not.toMatch(/from '\.\/RecoverySession'/);
      // Types seulement (`import type`) : le module d'état arrive par import().
      expect(src).not.toMatch(/^import \{[^}]*\} from '\.\/redDayState'/m);
      expect(src).not.toContain('trainingRecoveryText');
    }
    expect(readFileSync('src/features/training/session/RecoverySession.tsx', 'utf8')).toContain('trainingRecoveryText');
    expect(readFileSync('src/i18n/fr.training.ts', 'utf8')).not.toContain('trainingRecovery');
  });
});
