import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { PAST, PAST_WORKOUT_ID, seedPastWorkout } from '../../../../tests/fixtures/training/workout';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TodaySessionCard } from '../session/TodaySessionCard';
import { applyRemoteChanges } from '../../sync/remoteChanges';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I1-03 (interface, critères 5 et 8) sur base SQLite réelle : journal des séances closes (récentes d'abord, état vide expliqué), détail
 * (exercices, séries, type ; exercice absent du catalogue : nom figé, P-09), correction d'une série close (persistée, en file de synchro,
 * repérée par un texte « corrigée »), suppression avec confirmation.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000e4' as DeviceId;
const BENCH = 'Développé couché à la barre';

let db: TestDb;
const container = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
const openJournal = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'history' } as Route));
  return render(
    <AppContainerProvider container={container()}>
      <TrainingScreen />
    </AppContainerProvider>,
  );
};
const one = async <T,>(sql: string, params: unknown[] = []): Promise<T> => {
  const [row] = await db.driver.select<T & Record<string, string | number | null>>(sql, params as (string | number | null)[]);
  if (!row) throw new Error(`aucune ligne : ${sql}`);
  return row;
};

/** Séance close par le repository (même chemin que l'interface) : « Jambes », une série de squat. */
async function closeLegs(): Promise<string> {
  return db.data.transaction(async (r) => {
    const repo = await r.workouts();
    const w = await repo.start({ source: 'empty', name: 'Jambes' });
    const next = await repo.addExercise(w.id, { exerciseId: 'back-squat-barbell', exerciseName: 'Squat à la barre', sets: 1, targetRepsMin: 5, targetRepsMax: 8 });
    const set = next.sets[0];
    if (!set) throw new Error('aucune série');
    await repo.validateSet(set.id, { loadKg: 100, reps: 5 });
    await repo.close(w.id);
    return w.id;
  });
}
const openDetail = async (name: RegExp) => {
  fireEvent.click(await screen.findByRole('button', { name }));
  return screen.findByRole('region', { name: 'Détail de la séance' });
};

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('journal des séances', () => {
  it('section « Journal » de l’onglet ; sans séance close, l’état vide est expliqué', async () => {
    openJournal();
    expect(await screen.findByRole('radio', { name: 'Journal' })).toBeChecked();
    expect(await screen.findByText(/Aucune séance terminée pour l’instant/)).toBeInTheDocument();
  });

  it('liste des séances closes, récentes d’abord : date, nom, durée, séries, volume ; la séance ouverte n’y est pas', async () => {
    await seedPastWorkout(db.driver);
    await closeLegs();
    await db.data.transaction(async (r) => (await r.workouts()).start({ source: 'empty', name: 'Ouverte' }));
    openJournal();
    const list = await screen.findByRole('list', { name: 'Séances terminées' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Jambes');
    expect(items[0]).toHaveTextContent('9 novembre');
    expect(items[1]).toHaveTextContent('Haut A');
    expect(items[1]).toHaveTextContent('26 octobre');
    expect(items[1]).toHaveTextContent('1:10:00');
    expect(items[1]).toHaveTextContent('3 séries');
    expect(items[1]).toHaveTextContent('917,5 kg');
    expect(list).not.toHaveTextContent('Ouverte');
  });

  it('Aujourd’hui mène au journal', async () => {
    render(
      <AppContainerProvider container={container()}>
        <TodaySessionCard />
      </AppContainerProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Journal des séances' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training', screen: 'history' });
  });
});

describe('détail d’une séance close', () => {
  it('exercices, séries, charges, répétitions et type ; volume hors échauffement et chrono ; exercice absent du catalogue : nom figé', async () => {
    await seedPastWorkout(db.driver, { ...PAST, sets: PAST.sets.map((s) => (s.exerciseId === 'plank' ? { ...s, exerciseId: 'retired-exercise', exerciseName: 'Gainage ancien' } : s)) });
    openJournal();
    const detail = await openDetail(/^Haut A/);
    const bench = within(detail).getByRole('region', { name: BENCH });
    const sets = within(bench).getAllByRole('group', { name: /^Série/ });
    expect(sets).toHaveLength(3);
    expect(sets[0]).toHaveTextContent('Échauffement');
    expect(sets[0]).toHaveTextContent('40 kg × 8');
    expect(sets[2]).toHaveTextContent('62,5 kg × 7');
    const old = within(detail).getByRole('region', { name: 'Gainage ancien' });
    expect(old).toHaveTextContent('Exercice introuvable dans la bibliothèque');
    expect(old).toHaveTextContent('Chronométrée');
    expect(old).toHaveTextContent('45 s');
    expect(old).toHaveTextContent('Non validée');
    expect(within(detail).getByText('Volume (kg)').nextElementSibling).toHaveTextContent('917,5');
  });

  it('corriger une série : persistée, en file de synchro, repérée « corrigée » par un texte ; le volume suit', async () => {
    await seedPastWorkout(db.driver);
    openJournal();
    const detail = await openDetail(/^Haut A/);
    const set = within(within(detail).getByRole('region', { name: BENCH })).getAllByRole('group', { name: /^Série/ })[1] as HTMLElement;
    fireEvent.click(within(set).getByRole('button', { name: 'Corriger' }));
    fireEvent.change(within(set).getByLabelText('Charge (kg)'), { target: { value: '62,5' } });
    fireEvent.change(within(set).getByLabelText('Répétitions'), { target: { value: '9' } });
    fireEvent.click(within(set).getByRole('button', { name: 'Enregistrer la correction' }));
    expect(await within(detail).findByText(/Correction enregistrée/)).toHaveTextContent('synchronisée avec ton autre appareil');
    const fresh = within(within(detail).getByRole('region', { name: BENCH })).getAllByRole('group', { name: /^Série/ })[1] as HTMLElement;
    expect(fresh).toHaveTextContent('62,5 kg × 9');
    expect(within(fresh).getByText('corrigée')).toBeInTheDocument();
    const row = await one<{ load_kg: number; reps: number; corrected_at: string | null }>('SELECT load_kg, reps, corrected_at FROM workout_set WHERE id = ?', [PAST.sets[1]?.id]);
    expect(row).toMatchObject({ load_kg: 62.5, reps: 9 });
    expect(row.corrected_at).not.toBeNull();
    const queued = await db.driver.select<{ field: string }>("SELECT field FROM sync_outbox WHERE table_name = 'workout_set' AND row_id = ?", [PAST.sets[1]?.id ?? '']);
    expect(queued.map((q) => q.field)).toEqual(expect.arrayContaining(['load_kg', 'reps']));
    // 62,5 × 9 + 62,5 × 7 = 1 000 kg (échauffement et planche exclus).
    expect(within(detail).getByText('Volume (kg)').nextElementSibling).toHaveTextContent(/^1\s000$/);
  });

  it('correction hors règles : refusée sans rien écrire', async () => {
    await seedPastWorkout(db.driver);
    openJournal();
    const detail = await openDetail(/^Haut A/);
    const set = within(within(detail).getByRole('region', { name: BENCH })).getAllByRole('group', { name: /^Série/ })[1] as HTMLElement;
    fireEvent.click(within(set).getByRole('button', { name: 'Corriger' }));
    fireEvent.change(within(set).getByLabelText('Répétitions'), { target: { value: '' } });
    fireEvent.click(within(set).getByRole('button', { name: 'Enregistrer la correction' }));
    expect(await within(set).findByRole('alert')).toHaveTextContent('Indique les répétitions');
    expect(await one('SELECT reps, corrected_at FROM workout_set WHERE id = ?', [PAST.sets[1]?.id])).toEqual({ reps: 8, corrected_at: null });
  });

  it('changer le type d’une série : « Dégressive » sort la série du volume', async () => {
    await seedPastWorkout(db.driver);
    openJournal();
    const detail = await openDetail(/^Haut A/);
    const set = within(within(detail).getByRole('region', { name: BENCH })).getAllByRole('group', { name: /^Série/ })[2] as HTMLElement;
    fireEvent.click(within(set).getByRole('button', { name: 'Corriger' }));
    fireEvent.change(within(set).getByLabelText('Type de série'), { target: { value: 'drop' } });
    fireEvent.click(within(set).getByRole('button', { name: 'Enregistrer la correction' }));
    await within(detail).findByText(/Correction enregistrée/);
    expect(await one('SELECT set_kind FROM workout_set WHERE id = ?', [PAST.sets[2]?.id])).toEqual({ set_kind: 'drop' });
    expect(within(detail).getByText('Volume (kg)').nextElementSibling).toHaveTextContent(/^480$/);
  });

  it('supprimer une séance close : confirmation, suppression logique, retour au journal', async () => {
    await seedPastWorkout(db.driver);
    openJournal();
    const detail = await openDetail(/^Haut A/);
    fireEvent.click(within(detail).getByRole('button', { name: 'Supprimer la séance' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Supprimer la séance « Haut A » ?' });
    expect(dialog).toHaveTextContent('ton autre appareil');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(await one('SELECT deleted_at FROM workout WHERE id = ?', [PAST_WORKOUT_ID])).toEqual({ deleted_at: null });
    fireEvent.click(within(detail).getByRole('button', { name: 'Supprimer la séance' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText(/Séance supprimée/)).toBeInTheDocument();
    expect(await screen.findByText(/Aucune séance terminée pour l’instant/)).toBeInTheDocument();
    expect(await one('SELECT deleted_at IS NOT NULL AS gone FROM workout WHERE id = ?', [PAST_WORKOUT_ID])).toEqual({ gone: 1 });
    expect(await one('SELECT COUNT(*) AS n FROM workout_set WHERE workout_id = ? AND deleted_at IS NULL', [PAST_WORKOUT_ID])).toEqual({ n: 0 });
  });
});

describe('0.2.4 point 5 : le Journal se relit dès qu’un lot touche workout ou workout_set, même déjà affiché', () => {
  const batch = (...tables: string[]) => ({ tables: new Set(tables), ids: new Map<string, ReadonlySet<string>>() });

  it('séance close arrivée par la synchro (workout) : elle apparaît sans quitter l’écran', async () => {
    openJournal();
    expect(await screen.findByText(/Aucune séance terminée pour l’instant/)).toBeInTheDocument();
    await closeLegs();
    await act(async () => void (await applyRemoteChanges(container(), batch('workout'))));
    expect(await screen.findByRole('list', { name: 'Séances terminées' })).toBeInTheDocument();
    expect(screen.getByText('Jambes')).toBeInTheDocument();
  });

  it('lot qui ne touche que workout_set : la liste se relit aussi ; un lot sans rapport ne relit rien', async () => {
    await seedPastWorkout(db.driver);
    openJournal();
    await screen.findByRole('list', { name: 'Séances terminées' });
    await closeLegs();
    await act(async () => void (await applyRemoteChanges(container(), batch('body_weight'))));
    expect(within(screen.getByRole('list', { name: 'Séances terminées' })).getAllByRole('listitem')).toHaveLength(1);
    await act(async () => void (await applyRemoteChanges(container(), batch('workout_set'))));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Séances terminées' })).getAllByRole('listitem')).toHaveLength(2));
  });
});
