import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tImport } from '../../../i18n/programImportText';
import { tTraining } from '../../../i18n/trainingText';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * IMPORT-029a (§ 17.4) : Entraînement › Routines › « Importer un programme ». Texte collé → aperçu complet (séances, exercices rapprochés,
 * séries, plage, RIR, lignes non reconnues) → aucune écriture avant « Créer la routine » → routine Libre par le repository des routines.
 * Programme inventé.
 */
const DEVICE = '60000000-0000-4000-8000-0000000029a1' as DeviceId;
const TEXT = ['Jour A — Haut', 'Curl marteau 3 x 12 RIR 2', 'Développé couché 4x8-10', 'Lancer de pneu 3x5', 'Échauffement libre', '', 'Jour B', 'Squat à la barre 4×6 repos 3 min'].join('\n');

let db: TestDb;
const container = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
const routineCount = async (): Promise<number> => (await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM routine WHERE deleted_at IS NULL'))[0]?.n ?? -1;

async function openImport(): Promise<void> {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'routines' } as Route));
  render(
    <AppContainerProvider container={container()}>
      <TrainingScreen session={{ os: 'other' }} />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: tTraining('importProgram') }));
  await screen.findByRole('heading', { name: tImport('title') });
}
async function analyze(text: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(tImport('textLabel')), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: tImport('analyze') }));
  await screen.findByRole('heading', { name: tImport('previewTitle') });
}
const card = (readName: string): HTMLElement => screen.getByRole('group', { name: tImport('exerciseGroup', { name: readName }) });

beforeAll(async () => {
  await Promise.all([import('../TrainingScreen'), import('./ProgramImportView')]);
}, 60_000);
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-21T09:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('IMPORT-029a : import d’un programme collé', () => {
  it('aperçu complet : séances, exercices rapprochés (proposé, à confirmer, à choisir), séries, plage, RIR, lignes non reconnues', async () => {
    await openImport();
    await analyze(TEXT);
    expect(screen.getByRole('heading', { name: 'Jour A — Haut' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Jour B' })).toBeTruthy();
    const curl = card('Curl marteau');
    expect(within(curl).getByText(tImport('levelSure'))).toBeTruthy();
    expect(within(curl).getByText(tImport('scheme', { sets: 3, reps: '12' }))).toBeTruthy();
    expect(within(curl).getByText(tImport('rir', { rir: 2 }))).toBeTruthy();
    const bench = card('Développé couché');
    expect(within(bench).getByText(tImport('levelDoubt'))).toBeTruthy();
    expect(within(bench).getAllByRole('radio')).toHaveLength(3);
    expect(within(card('Lancer de pneu')).getByText(tImport('levelNone'))).toBeTruthy();
    const rejected = screen.getByRole('region', { name: tImport('rejectedTitle', { n: 1 }) });
    expect(within(rejected).getByText(tImport('rejectedLine', { line: 5, text: 'Échauffement libre' }))).toBeTruthy();
    expect(within(rejected).getByText(tImport('reason_no-scheme'))).toBeTruthy();
    // Deux exercices sans choix : création indisponible, raison dite ; rien n'est écrit.
    const create = screen.getByRole('button', { name: tImport('create') });
    expect((create as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(tImport('blockedMany', { n: 2 }))).toBeTruthy();
    expect(await routineCount()).toBe(0);
  });

  it('choix, retrait, puis « Créer la routine » : une routine Libre écrite en une fois, ouverte dans l’éditeur', async () => {
    await openImport();
    await analyze(TEXT);
    fireEvent.click(within(card('Développé couché')).getByRole('radio', { name: /^Développé couché à la barre/ }));
    fireEvent.click(within(card('Lancer de pneu')).getByRole('button', { name: tImport('remove') }));
    fireEvent.change(screen.getByLabelText(tImport('routineName')), { target: { value: 'Essai importé' } });
    expect(await routineCount()).toBe(0);
    const create = screen.getByRole('button', { name: tImport('create') });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(create);
    await screen.findByText(tImport('created', { name: 'Essai importé' }));
    const routines = await db.driver.select<{ name: string; mode: string }>('SELECT name, mode FROM routine WHERE deleted_at IS NULL');
    expect(routines).toEqual([{ name: 'Essai importé', mode: 'libre' }]);
    const days = await db.driver.select<{ name: string; day_order: number }>('SELECT name, day_order FROM routine_day WHERE deleted_at IS NULL ORDER BY day_order');
    expect(days).toEqual([
      { name: 'Jour A — Haut', day_order: 1 },
      { name: 'Jour B', day_order: 2 },
    ]);
    const lines = await db.driver.select<{ exercise_id: string; exercise_name: string; sets: number; rep_min: number; rep_max: number; rir: number | null; rest_sec: number }>(
      'SELECT e.exercise_id, e.exercise_name, e.sets, e.rep_min, e.rep_max, e.rir, e.rest_sec FROM routine_exercise e JOIN routine_day d ON d.id = e.routine_day_id WHERE e.deleted_at IS NULL ORDER BY d.day_order, e.position',
    );
    expect(lines.map((l) => [l.exercise_id, l.exercise_name, l.sets, l.rep_min, l.rep_max, l.rir])).toEqual([
      ['hammer-curl', 'Curl marteau', 3, 12, 12, 2],
      ['bench-press-barbell', 'Développé couché à la barre', 4, 8, 10, null],
      ['squat-barbell', 'Squat à la barre', 4, 6, 6, null],
    ]);
    expect(lines[2]?.rest_sec).toBe(180);
    // L'éditeur ordinaire est ouvert sur la routine créée.
    expect(await screen.findByRole('group', { name: 'Jour A — Haut' })).toBeTruthy();
  });

  it('« Choisir dans la bibliothèque » : le sélecteur existant fixe l’exercice', async () => {
    await openImport();
    await analyze('Lancer de pneu 3x5');
    fireEvent.click(within(card('Lancer de pneu')).getByRole('button', { name: tImport('pickLibrary') }));
    const picker = await screen.findByRole('region', { name: tImport('pickerTitle', { name: 'Lancer de pneu' }) });
    fireEvent.change(within(picker).getByRole('searchbox'), { target: { value: 'farmer' } });
    fireEvent.click(await within(picker).findByRole('button', { name: /^Marche du fermier$/ }));
    expect(within(card('Lancer de pneu')).getByText(tImport('chosen', { name: 'Marche du fermier' }))).toBeTruthy();
    expect((screen.getByRole('button', { name: tImport('create') }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('texte sans exercice reconnu : rien à créer, les lignes sont montrées', async () => {
    await openImport();
    await analyze('Bonne séance\nÀ jeudi');
    expect(screen.getByText(tImport('nothing'))).toBeTruthy();
    expect(screen.getByRole('region', { name: tImport('rejectedTitle', { n: 2 }) })).toBeTruthy();
    expect(screen.queryByRole('button', { name: tImport('create') })).toBeNull();
  });

  it('« Retour aux routines » sans création : aucune écriture', async () => {
    await openImport();
    await analyze(TEXT);
    fireEvent.click(screen.getByRole('button', { name: tImport('back') }));
    await screen.findByRole('button', { name: tTraining('importProgram') });
    expect(await routineCount()).toBe(0);
  });
});
