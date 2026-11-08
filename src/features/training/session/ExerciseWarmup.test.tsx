import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import type { LiveActivity } from '../../../platform/liveActivity';
import type { TimerNotifier } from '../../../platform/notifications/timerNotification';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I2-03 (§ 13.2, § 13.8, D-72 point 11) : rampe d'échauffement dans la séance active, avec le matériel embarqué Fitness Park Antony (profil
 * actif par défaut, base SQLite réelle). La rampe est annoncée dans la proposition et insérée avant la première série de travail quand Ali
 * retient une charge (Accepter, Modifier ou un choix), pour le premier exercice composé de chaque pattern seulement ; rien sans geste,
 * rien après un refus ; séries `warmup` ignorables, sans repos.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e5' as DeviceId;
const u = (n: number): string => `3c5d7e9f-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PAST = u(1);
const CURRENT = u(2);
const BENCH = { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre' };
const BENCH_DB = { exerciseId: 'bench-press-dumbbell', exerciseName: 'Développé couché aux haltères' };
const LEG_PRESS = { exerciseId: 'leg-press', exerciseName: 'Presse à cuisses' };
const PREVIEW_62_5 = 'Échauffement ajouté en acceptant : 25 kg × 8 · 37,5 kg × 5 · 50 kg × 2.';

const notifier: TimerNotifier = { permission: async () => 'granted', requestPermission: async () => 'granted', isPending: async () => false, schedule: async () => true, cancel: async () => undefined };
const liveActivity: LiveActivity = { isAvailable: async () => ({ available: false }) as never, start: async () => ({ started: false }) as never, end: async () => ({ ended: true, count: 0 }) };

let db: TestDb;
const openSession = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'session' } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TrainingScreen session={{ os: 'other', notifier, liveActivity }} />
    </AppContainerProvider>,
  );
};

type Line = { readonly exerciseId: string; readonly exerciseName: string };
/** Séance close il y a trois jours : 3 × 10 à la charge donnée pour chaque exercice (haut de la plage 8–10 atteint). */
async function seedPast(lines: readonly (readonly [Line, number])[]): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: PAST, name: 'Haut A' });
  for (const [line, loadKg] of lines) {
    const w = await r.addExercise(PAST, { ...line, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
    for (const s of w.sets.filter((x) => x.exerciseId === line.exerciseId)) await r.validateSet(s.id, { reps: 10, loadKg });
  }
  await db.data.transaction(async (repos) => (await repos.workouts()).close(PAST));
  db.clock.advance(3 * 86_400_000);
}
async function seedCurrent(lines: readonly Line[]): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: CURRENT, name: 'Haut B' });
  for (const line of lines) await r.addExercise(CURRENT, { ...line, sets: 3, targetRepsMin: 8, targetRepsMax: 10, targetRestSec: 120 });
}
const block = async (line: Line) => screen.findByRole('region', { name: line.exerciseName });
const proposal = async (line: Line) => within(await block(line)).findByRole('group', { name: 'Proposition' });
const rows = async (line: Line) => within(await block(line)).getAllByRole('group', { name: /^Série / });
const rowValues = async (line: Line) =>
  (await rows(line)).map((g) => [g.getAttribute('aria-label'), (within(g).getByLabelText('Charge (kg)') as HTMLInputElement).value, (within(g).getByLabelText('Répétitions') as HTMLInputElement).value]);
const stored = (exerciseId: string) =>
  db.driver.select<{ set_kind: string; target_load_kg: number | null; target_reps_min: number | null; done: number }>(
    'SELECT set_kind, target_load_kg, target_reps_min, done FROM workout_set WHERE workout_id = ? AND exercise_id = ? AND deleted_at IS NULL ORDER BY position',
    [CURRENT, exerciseId],
  );
const WARMUP = 'Série d’échauffement';

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-04T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('rampe annoncée puis insérée (critères 1 à 3, matériel d’Antony)', () => {
  it('proposition 62,5 kg : rampe annoncée ; rien n’est inséré sans geste', async () => {
    await seedPast([[BENCH, 60]]);
    await seedCurrent([BENCH]);
    openSession();
    const p = await proposal(BENCH);
    expect(await within(p).findByText('62,5 kg × 8 · 8 · 8')).toBeInTheDocument();
    expect(within(p).getByText(PREVIEW_62_5)).toBeInTheDocument();
    expect((await stored(BENCH.exerciseId)).map((s) => s.set_kind)).toEqual(['work', 'work', 'work']);
  });

  it('Accepter : trois séries d’échauffement avant la première série de travail, charges de la barre olympique, pré-remplies', async () => {
    await seedPast([[BENCH, 60]]);
    await seedCurrent([BENCH]);
    openSession();
    fireEvent.click(await within(await proposal(BENCH)).findByRole('button', { name: 'Accepter' }));
    await within(await proposal(BENCH)).findByText('Proposition acceptée.');
    await waitFor(async () =>
      expect(await rowValues(BENCH)).toEqual([
        [WARMUP, '25', '8'],
        [WARMUP, '37,5', '5'],
        [WARMUP, '50', '2'],
        ['Série 1', '62,5', '8'],
        ['Série 2', '62,5', '8'],
        ['Série 3', '62,5', '8'],
      ]),
    );
    expect(await stored(BENCH.exerciseId)).toEqual([
      { set_kind: 'warmup', target_load_kg: 25, target_reps_min: 8, done: 0 },
      { set_kind: 'warmup', target_load_kg: 37.5, target_reps_min: 5, done: 0 },
      { set_kind: 'warmup', target_load_kg: 50, target_reps_min: 2, done: 0 },
      { set_kind: 'work', target_load_kg: null, target_reps_min: 8, done: 0 },
      { set_kind: 'work', target_load_kg: null, target_reps_min: 8, done: 0 },
      { set_kind: 'work', target_load_kg: null, target_reps_min: 8, done: 0 },
    ]);
    // Le nombre de séries annoncé dans l'en-tête reste celui du travail.
    expect(within(await block(BENCH)).getByText(/^3 séries/)).toBeInTheDocument();
  });

  it('Modifier à 70 kg : rampe tirée de la charge retenue, charge disponible juste en dessous (27,5 / 40 / 55)', async () => {
    await seedPast([[BENCH, 60]]);
    await seedCurrent([BENCH]);
    openSession();
    fireEvent.click(await within(await proposal(BENCH)).findByRole('button', { name: 'Modifier' }));
    const p = await proposal(BENCH);
    fireEvent.change(within(p).getByLabelText('Charge proposée (kg)'), { target: { value: '70' } });
    fireEvent.click(within(p).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(async () => expect((await stored(BENCH.exerciseId)).filter((s) => s.set_kind === 'warmup').map((s) => [s.target_load_kg, s.target_reps_min])).toEqual([[27.5, 8], [40, 5], [55, 2]]));
  });

  it('Refuser : aucune rampe', async () => {
    await seedPast([[BENCH, 60]]);
    await seedCurrent([BENCH]);
    openSession();
    fireEvent.click(await within(await proposal(BENCH)).findByRole('button', { name: 'Refuser' }));
    await within(await proposal(BENCH)).findByText(/refusée/i);
    expect((await stored(BENCH.exerciseId)).map((s) => s.set_kind)).toEqual(['work', 'work', 'work']);
  });

  it('machine sans palier connu à Antony (presse) : ni annonce ni rampe, aucune charge inventée', async () => {
    await seedPast([[LEG_PRESS, 100]]);
    await seedCurrent([LEG_PRESS]);
    openSession();
    const p = await proposal(LEG_PRESS);
    await within(p).findByRole('button', { name: 'Accepter' });
    expect(within(p).queryByText(/^Échauffement ajouté/)).toBeNull();
    fireEvent.click(within(p).getByRole('button', { name: 'Accepter' }));
    await within(await proposal(LEG_PRESS)).findByText('Proposition acceptée.');
    expect((await stored(LEG_PRESS.exerciseId)).map((s) => s.set_kind)).toEqual(['work', 'work', 'work']);
  });
});

describe('premier exercice composé du pattern seulement (critères 2 et 5)', () => {
  it('développé barre puis haltères (même pattern) : rampe au premier, aucune au second', async () => {
    await seedPast([
      [BENCH, 60],
      [BENCH_DB, 20],
    ]);
    await seedCurrent([BENCH, BENCH_DB]);
    openSession();
    expect(await within(await proposal(BENCH)).findByText(PREVIEW_62_5)).toBeInTheDocument();
    const second = await proposal(BENCH_DB);
    await within(second).findByRole('button', { name: 'Accepter' });
    expect(within(second).queryByText(/^Échauffement ajouté/)).toBeNull();
    fireEvent.click(within(second).getByRole('button', { name: 'Accepter' }));
    await within(await proposal(BENCH_DB)).findByText('Proposition acceptée.');
    expect((await stored(BENCH_DB.exerciseId)).map((s) => s.set_kind)).toEqual(['work', 'work', 'work']);
    fireEvent.click(within(await proposal(BENCH)).getByRole('button', { name: 'Accepter' }));
    await within(await proposal(BENCH)).findByText('Proposition acceptée.');
    await waitFor(async () => expect((await stored(BENCH.exerciseId)).map((s) => s.set_kind)).toEqual(['warmup', 'warmup', 'warmup', 'work', 'work', 'work']));
  });

  it('haltères en premier du pattern : rampe aux haltères d’Antony, paire de 9 kg comprise (24 kg → 9 / 14 / 18)', async () => {
    await seedPast([[BENCH_DB, 22]]);
    await seedCurrent([BENCH_DB]);
    openSession();
    const p = await proposal(BENCH_DB);
    expect(await within(p).findByText('24 kg × 8 · 8 · 8')).toBeInTheDocument();
    expect(within(p).getByText('Échauffement ajouté en acceptant : 9 kg × 8 · 14 kg × 5 · 18 kg × 2.')).toBeInTheDocument();
  });
});

describe('clavier et ignorable (critère 4)', () => {
  it('Entrée dans une série d’échauffement la valide aux valeurs pré-remplies, sans repos ; elle reste un échauffement', async () => {
    await seedPast([[BENCH, 60]]);
    await seedCurrent([BENCH]);
    openSession();
    fireEvent.click(await within(await proposal(BENCH)).findByRole('button', { name: 'Accepter' }));
    await waitFor(async () => expect((await rows(BENCH)).length).toBe(6));
    const [first] = await rows(BENCH);
    if (!first) throw new Error('rampe');
    fireEvent.keyDown(within(first).getByLabelText('Répétitions'), { key: 'Enter' });
    await waitFor(async () => expect((await stored(BENCH.exerciseId))[0]).toEqual({ set_kind: 'warmup', target_load_kg: 25, target_reps_min: 8, done: 1 }));
    const [done] = await db.driver.select<{ load_kg: number; reps: number }>("SELECT load_kg, reps FROM workout_set WHERE set_kind = 'warmup' AND done = 1");
    expect(done).toEqual({ load_kg: 25, reps: 8 });
    const [workout] = await db.driver.select<{ rest_timer_end_at: string | null }>('SELECT rest_timer_end_at FROM workout WHERE id = ?', [CURRENT]);
    expect(workout?.rest_timer_end_at).toBeNull();
  });
});
