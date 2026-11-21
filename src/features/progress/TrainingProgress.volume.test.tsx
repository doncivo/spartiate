import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tTrainingProgress } from '../../i18n/trainingProgressText';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { TrainingProgress } from './TrainingProgress';

/** PROGRES-a (§ 17.1) : Progrès › Volume par muscle, valeur écrite et étiquette des barres. Valeurs synthétiques. */

const DEVICE = '60000000-0000-4000-8000-0000000000e1' as DeviceId;
const NOW = '2026-11-18T18:00:00.000Z';
const W = '5e5a0501-0000-4000-8000-000000000001';
let db: TestDb;

const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } })}>
      <TrainingProgress />
    </AppContainerProvider>,
  );

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-17T08:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Progrès › Volume par muscle', () => {
  it('aucune séance : le vide est dit, aucune ligne', async () => {
    db.clock.set(NOW);
    mount();
    expect(await screen.findByText(tTrainingProgress('volumeEmpty'))).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Pectoraux' })).toBeNull();
  });

  it('développé couché 3 séries validées cette semaine (+1 non validée) : Pectoraux 3, Triceps 1,5, Deltoïdes antérieurs 0,9, en texte', async () => {
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: W, name: 'Haut' });
    const w = await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 4 });
    for (const s of w.sets.slice(0, 3)) await r.validateSet(s.id, { loadKg: 60, reps: 8 });
    await db.data.transaction(async (repos) => (await repos.workouts()).close(W));
    db.clock.set(NOW);
    mount();
    const chest = await screen.findByRole('listitem', { name: 'Pectoraux' });
    expect(within(chest).getByText(tTrainingProgress('volumeLine', { n: '3', mean: '0,4', weeks: 8 }))).toBeInTheDocument();
    // Revue à froid : la moyenne porte sur les 8 semaines de la fenêtre, et le texte le dit (pas « par semaine » d'entraînement).
    expect(within(chest).getByText('Cette semaine : 3 · moyenne des 8 dernières semaines : 0,4')).toBeInTheDocument();
    expect(within(screen.getByRole('listitem', { name: 'Triceps' })).getByText(tTrainingProgress('volumeLine', { n: '1,5', mean: '0,2', weeks: 8 }))).toBeInTheDocument();
    expect(within(screen.getByRole('listitem', { name: 'Deltoïdes antérieurs' })).getByText(tTrainingProgress('volumeLine', { n: '0,9', mean: '0,1', weeks: 8 }))).toBeInTheDocument();
    // Les barres disent leurs valeurs semaine par semaine (jamais la couleur seule).
    const chart = within(chest).getByRole('img');
    expect(chart.getAttribute('aria-label')).toContain(tTrainingProgress('volumeWeek', { date: '16/11', n: '3' }));
    expect(chart.getAttribute('aria-label')).toContain(tTrainingProgress('volumeWeek', { date: '28/09', n: '0' }));
  });
});
