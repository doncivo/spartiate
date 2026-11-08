import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import { createMesocycleSpec } from '../../../domain/training/mesocycle';
import { pauseProgram } from '../../../domain/training/programPause';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I3-01 (interface) : « Séance proposée », bloc à la demande ouvert depuis « Nouvelle séance ». Base SQLite réelle (wasm), contenu embarqué
 * réel, profil actif par défaut (Fitness Park Antony). Rien n'est écrit avant « Commencer cette séance » ; la routine source reste intacte.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000c3' as DeviceId;
const u = (n: number): string => `4d3c2b00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (n: number, exerciseId: string, exerciseName: string, sets: number, repMin: number, repMax: number, restSec: number) => ({ id: u(10 + n), exerciseId, exerciseName, sets, repMin, repMax, rir: null, restSec, position: n });
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut',
  mode: 'programme',
  days: [
    {
      id: u(2),
      name: 'Haut A',
      dayOrder: 1,
      exercises: [
        line(0, 'bench-press-barbell', 'Développé couché à la barre', 3, 6, 10, 150),
        line(1, 'row-barbell', 'Rowing à la barre', 3, 6, 10, 150),
        line(2, 'lateral-raise-dumbbell', 'Élévation latérale aux haltères', 3, 12, 15, 60),
        line(3, 'curl-barbell', 'Curl à la barre', 2, 8, 12, 60),
        line(4, 'triceps-pushdown-cable', 'Extension triceps à la poulie', 2, 8, 12, 60),
      ],
    },
  ],
};

let db: TestDb;
const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <TrainingScreen session={{ os: 'other' }} />
    </AppContainerProvider>,
  );
};
const one = async <T,>(sql: string): Promise<T> => {
  const [row] = await db.driver.select<T & Record<string, string | number | null>>(sql, []);
  if (!row) throw new Error(sql);
  return row;
};
const count = async (sql: string): Promise<number> => (await one<{ n: number }>(sql)).n;
const proposal = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Proposer une séance' }));
  return screen.findByRole('region', { name: 'Séance proposée' });
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

describe('séance proposée (I3-01)', () => {
  it('bloc à la demande : StartSession le charge par import(), ses textes dans un catalogue à part', () => {
    const start = readFileSync('src/features/training/session/StartSession.tsx', 'utf8');
    expect(start).toContain("import('./GeneratedSession')");
    expect(start).not.toMatch(/from '\.\/GeneratedSession'/);
    expect(start).not.toContain('fr.trainingGeneration');
    expect(readFileSync('src/i18n/fr.training.ts', 'utf8')).not.toContain('fr.trainingGeneration');
    expect(readFileSync('src/features/training/session/GeneratedSession.tsx', 'utf8')).toContain('trainingGenerationText');
  });

  it('propose la séance du jour avec séries, plages et repos, durée estimée ; Importé dit indisponible ; rien n’est écrit', async () => {
    open();
    const region = await proposal();
    const list = within(region).getByRole('list', { name: 'Exercices proposés' });
    expect(within(list).getAllByRole('listitem').map((li) => within(li).getByRole('heading').textContent)).toEqual([
      'Développé couché à la barre',
      'Rowing à la barre',
      'Élévation latérale aux haltères',
      'Curl à la barre',
      'Extension triceps à la poulie',
    ]);
    expect(within(list).getAllByText('3 × 6–10 · repos 2 min 30 s')).toHaveLength(2);
    expect(within(region).getByText('Durée estimée : 24 min')).toBeInTheDocument();
    expect(within(region).getByText(/Importé : indisponible pour l’instant/)).toBeInTheDocument();
    expect(await count('SELECT COUNT(*) AS n FROM workout')).toBe(0);
  });

  it('I3-02 : cycle de cette routine en semaine 1 : une série de moins par exercice, RIR 3, dit ; en pause ou autre routine : routine telle quelle', async () => {
    const spec = createMesocycleSpec({ routineId: ROUTINE.id, startDate: '2026-11-09' as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
    if (spec === null) throw new Error('spec');
    await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec, { id: u(90) }));
    open();
    let region = await proposal();
    let list = within(region).getByRole('list', { name: 'Exercices proposés' });
    expect(within(list).getAllByText('2 × 6–10 · repos 2 min 30 s · RIR 3')).toHaveLength(2);
    expect(within(region).getByText('Cycle : semaine 1 sur 5, une série de moins que la routine par exercice, 3 répétitions en réserve.')).toBeInTheDocument();
    cleanup();
    const paused = pauseProgram(spec, '2026-11-09' as LocalDate);
    if (paused === null) throw new Error('pause');
    await (await db.data.repos.mesocycles()).save(u(90), paused);
    open();
    region = await proposal();
    list = within(region).getByRole('list', { name: 'Exercices proposés' });
    expect(within(list).getAllByText('3 × 6–10 · repos 2 min 30 s')).toHaveLength(2);
    expect(within(region).getByText('Programme en pause : séance proposée selon la routine, sans le cycle.')).toBeInTheDocument();
    expect(await count('SELECT COUNT(*) AS n FROM workout')).toBe(0);
  });

  it('« 20 min » : l’isolation de fin est retirée et dite ; changer les réglages n’écrit rien, la routine reste intacte', async () => {
    const before = await one<{ n: number; u: string }>('SELECT COUNT(*) AS n, MAX(updated_at) AS u FROM routine_exercise');
    open();
    const region = await proposal();
    fireEvent.click(within(within(region).getByRole('radiogroup', { name: 'Temps disponible' })).getByRole('radio', { name: '20 min' }));
    const omitted = await within(region).findByRole('list', { name: 'Exercices retirés' });
    expect(within(omitted).getByText('Extension triceps à la poulie : retiré pour tenir le temps')).toBeInTheDocument();
    expect(within(region).getByText('Durée estimée : 21 min (temps disponible 20 min)')).toBeInTheDocument();
    fireEvent.click(within(within(region).getByRole('radiogroup', { name: 'Style' })).getByRole('radio', { name: 'Pyramide' }));
    fireEvent.click(within(within(region).getByRole('radiogroup', { name: 'Variété' })).getByRole('radio', { name: 'Équilibrée' }));
    fireEvent.click(within(region).getByRole('button', { name: 'Douleur : Poussée horizontale' }));
    expect(within(region).getByRole('button', { name: 'Douleur : Poussée horizontale' })).toHaveAttribute('aria-pressed', 'true');
    expect(await count('SELECT COUNT(*) AS n FROM workout')).toBe(0);
    expect(await one('SELECT COUNT(*) AS n, MAX(updated_at) AS u FROM routine_exercise')).toEqual(before);
  });

  it('« Commencer cette séance » : une séance ouverte nommée comme le jour, exercices et séries proposés, non liée à la routine', async () => {
    open();
    const region = await proposal();
    fireEvent.click(within(within(region).getByRole('radiogroup', { name: 'Temps disponible' })).getByRole('radio', { name: '20 min' }));
    await within(region).findByRole('list', { name: 'Exercices retirés' });
    fireEvent.click(within(region).getByRole('button', { name: 'Commencer cette séance' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Haut A' })).toBeInTheDocument();
    expect(await one('SELECT source, routine_id, routine_day_id, name, ended_at FROM workout')).toEqual({ source: 'empty', routine_id: null, routine_day_id: null, name: 'Haut A', ended_at: null });
    const sets = await db.driver.select<{ exercise_id: string; n: number; rmin: number; rmax: number; rest: number }>(
      'SELECT exercise_id, COUNT(*) AS n, MIN(target_reps_min) AS rmin, MAX(target_reps_max) AS rmax, MAX(target_rest_sec) AS rest FROM workout_set GROUP BY exercise_id ORDER BY MIN(position)',
      [],
    );
    expect(sets).toEqual([
      { exercise_id: 'bench-press-barbell', n: 3, rmin: 6, rmax: 10, rest: 150 },
      { exercise_id: 'row-barbell', n: 3, rmin: 6, rmax: 10, rest: 150 },
      { exercise_id: 'lateral-raise-dumbbell', n: 3, rmin: 12, rmax: 15, rest: 60 },
      { exercise_id: 'curl-barbell', n: 2, rmin: 8, rmax: 12, rest: 60 },
    ]);
    expect(await count('SELECT COUNT(*) AS n FROM routine_exercise WHERE deleted_at IS NULL')).toBe(5);
  });

  it('revue : le style choisi est dit comme une consigne d’exécution, et l’écran dit qu’il n’est pas enregistré dans la séance', async () => {
    open();
    const region = await proposal();
    const style = within(region).getByRole('radiogroup', { name: 'Style' });
    expect(within(region).getByText('Même charge et mêmes répétitions à chaque série.')).toBeInTheDocument();
    fireEvent.click(within(style).getByRole('radio', { name: 'Pyramide' }));
    expect(within(region).getByText('Fais les séries de la plus légère à la plus lourde ; séries et plages inchangées.')).toBeInTheDocument();
    fireEvent.click(within(style).getByRole('radio', { name: 'Inversée' }));
    expect(within(region).getByText('Commence par la série la plus lourde ; séries et plages inchangées.')).toBeInTheDocument();
    expect(within(region).getByText('Le style n’est pas enregistré dans la séance : c’est une consigne pour toi.')).toBeInTheDocument();
  });

  it('« Fermer » revient aux options de départ sans rien écrire', async () => {
    open();
    const region = await proposal();
    fireEvent.click(within(region).getByRole('button', { name: 'Fermer la proposition' }));
    expect(screen.queryByRole('region', { name: 'Séance proposée' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Proposer une séance' })).toBeInTheDocument();
    expect(await count('SELECT COUNT(*) AS n FROM workout')).toBe(0);
  });
});
