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
 * I2-01 (PR 2/2, critères 10 à 13 et 15) : prescription affichée dans le bloc de l'exercice de la séance active (charge, répétitions, une
 * phrase, confiance en pourcentage et en mot), « À saisir » sans historique ; rien n'est rempli sans geste d'Ali ; Accepter / Modifier /
 * Refuser tracés dans `recommendation_decision` ; Facile / Juste / Dur enregistré sur les séries. Base SQLite réelle (wasm), contenu embarqué.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e3' as DeviceId;
const u = (n: number): string => `2b4c6d8e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PAST = u(1);
const CURRENT = u(2);
const BENCH = 'Développé couché à la barre';

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
const one = async <T,>(sql: string): Promise<T> => {
  const [row] = await db.driver.select<T & Record<string, string | number | null>>(sql);
  if (!row) throw new Error(`aucune ligne : ${sql}`);
  return row;
};

/** Séance close il y a trois jours : 3 × 10 à 60 kg au développé couché (haut de la plage 8–10). */
async function seedPast(): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: PAST, name: 'Haut A' });
  const w = await r.addExercise(PAST, { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 10, loadKg: 60 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(PAST));
  db.clock.advance(3 * 86_400_000);
}
/** Séance ouverte : 3 séries de développé couché, plage 8–10. */
async function seedCurrent(): Promise<void> {
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: CURRENT, name: 'Haut B' });
  await r.addExercise(CURRENT, { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, targetRepsMin: 8, targetRepsMax: 10 });
}
const block = async () => screen.findByRole('region', { name: BENCH });
const proposal = async () => within(await block()).findByRole('group', { name: 'Proposition' });
const loadInputs = async () => within(await block()).getAllByLabelText('Charge (kg)').map((i) => (i as HTMLInputElement).value);
const decisions = () => db.driver.select<{ accepted: number; chosen_load_kg: number | null; chosen_reps: string; workout_id: string }>('SELECT accepted, chosen_load_kg, chosen_reps, workout_id FROM recommendation_decision ORDER BY decided_at');

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-04T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('prescription affichée (critères 10 et 11)', () => {
  it('sans historique : « À saisir », aucune charge proposée, aucun bouton d’acceptation', async () => {
    await seedCurrent();
    openSession();
    const p = await proposal();
    expect(await within(p).findByText('À saisir')).toBeInTheDocument();
    expect(within(p).getByText('Aucune séance de référence : saisis la charge, la proposition viendra ensuite.')).toBeInTheDocument();
    expect(within(p).queryByText(/kg/)).toBeNull();
    expect(within(p).queryByRole('button', { name: 'Accepter' })).toBeNull();
    expect(await loadInputs()).toEqual(['', '', '']);
  });

  it('avec historique : charge et répétitions, une phrase, confiance en % et en mot ; rien n’est rempli ni écrit sans geste', async () => {
    await seedPast();
    await seedCurrent();
    openSession();
    const p = await proposal();
    expect(await within(p).findByText('62,5 kg × 8 · 8 · 8')).toBeInTheDocument();
    expect(within(p).getByText('+2,5 kg : 3 × 10 atteint la dernière fois.')).toBeInTheDocument();
    expect(within(p).getByText(/^Confiance \d+ % \((faible|moyenne|bonne)\)$/)).toBeInTheDocument();
    expect(await loadInputs()).toEqual(['', '', '']);
    expect(await decisions()).toEqual([]);
  });
});

describe('décision d’Ali (critère 12)', () => {
  it('Accepter : séries à faire remplies (modifiables), décision tracée acceptée ; l’état remplace les boutons', async () => {
    await seedPast();
    await seedCurrent();
    openSession();
    const p = await proposal();
    fireEvent.click(await within(p).findByRole('button', { name: 'Accepter' }));
    expect(await within(await proposal()).findByText('Proposition acceptée.')).toBeInTheDocument();
    expect(await loadInputs()).toEqual(['62,5', '62,5', '62,5']);
    expect(within(await block()).getAllByLabelText('Répétitions').map((i) => (i as HTMLInputElement).value)).toEqual(['8', '8', '8']);
    expect(await decisions()).toEqual([{ accepted: 1, chosen_load_kg: 62.5, chosen_reps: '[8,8,8]', workout_id: CURRENT }]);
    expect(within(await proposal()).queryByRole('button', { name: 'Accepter' })).toBeNull();
  });

  it('Refuser : rien n’est rempli, décision tracée sans valeur', async () => {
    await seedPast();
    await seedCurrent();
    openSession();
    fireEvent.click(await within(await proposal()).findByRole('button', { name: 'Refuser' }));
    expect(await within(await proposal()).findByText('Proposition refusée : tu saisis toi-même.')).toBeInTheDocument();
    expect(await loadInputs()).toEqual(['', '', '']);
    expect(await decisions()).toEqual([{ accepted: 0, chosen_load_kg: null, chosen_reps: '[]', workout_id: CURRENT }]);
  });

  it('Modifier : la valeur d’Ali l’emporte, appliquée et tracée comme modifiée ; Entrée valide au clavier', async () => {
    await seedPast();
    await seedCurrent();
    openSession();
    fireEvent.click(await within(await proposal()).findByRole('button', { name: 'Modifier' }));
    const p = await proposal();
    fireEvent.change(within(p).getByLabelText('Charge proposée (kg)'), { target: { value: '60' } });
    const reps = within(p).getByLabelText('Répétitions proposées');
    fireEvent.change(reps, { target: { value: '9' } });
    fireEvent.keyDown(reps, { key: 'Enter' });
    expect(await within(await proposal()).findByText('Valeurs retenues : 60 kg × 9.')).toBeInTheDocument();
    expect(await loadInputs()).toEqual(['60', '60', '60']);
    expect(await decisions()).toEqual([{ accepted: 0, chosen_load_kg: 60, chosen_reps: '[9,9,9]', workout_id: CURRENT }]);
  });

  it('Modifier avec une valeur illisible : refusé avec un message, rien n’est écrit', async () => {
    await seedPast();
    await seedCurrent();
    openSession();
    fireEvent.click(await within(await proposal()).findByRole('button', { name: 'Modifier' }));
    const p = await proposal();
    fireEvent.change(within(p).getByLabelText('Charge proposée (kg)'), { target: { value: 'abc' } });
    fireEvent.click(within(p).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(p).findByRole('alert')).toHaveTextContent('Charge ou répétitions illisibles.');
    expect(await decisions()).toEqual([]);
  });
});

describe('ressenti de fin d’exercice (critère 13)', () => {
  it('Facile / Juste / Dur : état dit (aria-pressed et texte), écrit sur les séries, effaçable par un second appui', async () => {
    await seedCurrent();
    openSession();
    const group = await within(await block()).findByRole('group', { name: 'Ressenti de l’exercice' });
    const hard = within(group).getByRole('button', { name: 'Dur' });
    expect(hard).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByText('Non renseigné')).toBeInTheDocument();
    fireEvent.click(hard);
    expect(await within(await within(await block()).findByRole('group', { name: 'Ressenti de l’exercice' })).findByText('Choisi : Dur')).toBeInTheDocument();
    expect(await one<{ d: string }>("SELECT group_concat(DISTINCT difficulty) AS d FROM workout_set WHERE workout_id = '" + CURRENT + "'")).toEqual({ d: 'hard' });
    const again = within(await within(await block()).findByRole('group', { name: 'Ressenti de l’exercice' })).getByRole('button', { name: 'Dur' });
    expect(again).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(again);
    expect(await within(await within(await block()).findByRole('group', { name: 'Ressenti de l’exercice' })).findByText('Non renseigné')).toBeInTheDocument();
    expect(await one<{ n: number }>("SELECT COUNT(*) AS n FROM workout_set WHERE difficulty IS NOT NULL")).toEqual({ n: 0 });
  });
});

describe('accessibilité (critère 15)', () => {
  it('clavier : après « Accepter », le focus passe à l’état de la décision ; « Modifier » place le focus sur la charge, Échap annule', async () => {
    await seedPast();
    await seedCurrent();
    openSession();
    fireEvent.click(await within(await proposal()).findByRole('button', { name: 'Modifier' }));
    const field = within(await proposal()).getByLabelText('Charge proposée (kg)');
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(field, { key: 'Escape' });
    fireEvent.click(await within(await proposal()).findByRole('button', { name: 'Accepter' }));
    const state = await within(await proposal()).findByText('Proposition acceptée.');
    await waitFor(() => expect(document.activeElement).toBe(state));
  });

  it('cibles : les trois choix de ressenti et les boutons de décision sont des boutons natifs (clavier, Entrée et Espace)', async () => {
    await seedPast();
    await seedCurrent();
    openSession();
    const p = await proposal();
    for (const name of ['Accepter', 'Modifier', 'Refuser']) expect((await within(p).findByRole('button', { name })).tagName).toBe('BUTTON');
    const group = within(await block()).getByRole('group', { name: 'Ressenti de l’exercice' });
    for (const name of ['Facile', 'Juste', 'Dur']) expect(within(group).getByRole('button', { name })).toHaveAttribute('type', 'button');
  });
});

describe('revue : la saisie d’Ali l’emporte (critère 12)', () => {
  it('une charge tapée mais pas encore validée n’est jamais écrasée par « Accepter »', async () => {
    await seedPast();
    await seedCurrent();
    openSession();
    await proposal();
    const [first] = within(await block()).getAllByLabelText('Charge (kg)');
    if (!first) throw new Error('champ');
    fireEvent.change(first, { target: { value: '55' } });
    fireEvent.click(await within(await proposal()).findByRole('button', { name: 'Accepter' }));
    await within(await proposal()).findByText('Proposition acceptée.');
    expect(await loadInputs()).toEqual(['55', '62,5', '62,5']);
  });
});
