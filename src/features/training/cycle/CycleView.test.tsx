import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * I3-02 : section « Cycle » de l'onglet Entraînement (bloc à la demande, catalogue à part). Base SQLite réelle (wasm). Création 4–7 semaines
 * ou illimité, semaine courante (séries, RIR, deload), deload anticipé confirmé, pause et reprise (semaine allégée au-delà de 21 jours),
 * bilan de fin de bloc (répéter, régénérer, changer, terminer). Aucune notification programmée.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000ca' as DeviceId;
const u = (n: number): string => `5e7f9a0b-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DAY_MS = 86_400_000;
const routine = (n: number, name: string): RoutineInput => ({
  id: u(n),
  name,
  mode: 'programme',
  days: [{ id: u(n + 1), name: 'Haut A', dayOrder: 1, exercises: [{ id: u(n + 2), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché à la barre', sets: 3, repMin: 6, repMax: 10, rir: null, restSec: 150, position: 0 }] }],
});

let db: TestDb;
const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'cycle' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <TrainingScreen session={{ os: 'other' }} />
    </AppContainerProvider>,
  );
};
const region = () => screen.findByRole('region', { name: 'Cycle d’entraînement' });
const cycles = () => db.driver.select<{ routine_id: string; weeks: number; unlimited: number; status: string; outcome: string | null; deload_week: number | null; pauses: string; rotation_index: number }>(
  'SELECT routine_id, weeks, unlimited, status, outcome, deload_week, pauses, rotation_index FROM mesocycle ORDER BY created_at, id',
);
async function startCycle(weeks = '5 semaines'): Promise<HTMLElement> {
  open();
  const r = await region();
  // Routines triées par nom (Full Body, puis Haut / Bas) : le programme suivi est choisi explicitement.
  fireEvent.click(within(r).getByRole('radio', { name: 'Haut / Bas' }));
  fireEvent.click(within(r).getByRole('radio', { name: weeks }));
  fireEvent.click(within(r).getByRole('button', { name: 'Commencer le cycle' }));
  await within(r).findByText(/^Semaine 1/);
  return r;
}
/** Le temps passe : l'écran est rouvert à la nouvelle date. */
async function later(days: number): Promise<HTMLElement> {
  cleanup();
  db.clock.advance(days * DAY_MS);
  open();
  return region();
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  // Lundi 9 novembre 2026, 18:00 à Paris.
  db = await openBaseDb(DEVICE, '2026-11-09T17:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(routine(1, 'Haut / Bas'));
  await (await db.data.repos.trainingRoutines()).create(routine(10, 'Full Body'));
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('section Cycle (I3-02)', () => {
  it('à la demande : TrainingScreen la charge par import(), ses textes dans un catalogue à part, aucune notification', () => {
    const screenSource = readFileSync('src/features/training/TrainingScreen.tsx', 'utf8');
    expect(screenSource).toContain("import('./cycle/CycleView')");
    expect(screenSource).not.toMatch(/from '\.\/cycle\/CycleView'/);
    expect(readFileSync('src/i18n/fr.training.ts', 'utf8')).not.toContain('fr.trainingCycle');
    const view = readFileSync('src/features/training/cycle/CycleView.tsx', 'utf8');
    expect(view).toContain('trainingCycleText');
    expect(view).not.toMatch(/platform\/notifications|liveActivity/);
  });

  it('sans cycle : choix de la routine et de la durée (5 semaines par défaut, 4 à 7 ou illimité) ; rien n’est écrit avant « Commencer »', async () => {
    open();
    const r = await region();
    expect(within(r).getByText('Aucun cycle en cours.')).toBeInTheDocument();
    const weeks = within(r).getByRole('radiogroup', { name: 'Durée' });
    expect(within(weeks).getAllByRole('radio').map((b) => b.textContent)).toEqual(['4 semaines', '5 semaines', '6 semaines', '7 semaines', 'Illimité']);
    expect(within(weeks).getByRole('radio', { name: '5 semaines' })).toHaveAttribute('aria-checked', 'true');
    expect(within(r).getByRole('radiogroup', { name: 'Programme suivi' })).toBeInTheDocument();
    expect(await cycles()).toEqual([]);
  });

  it('commencer : semaine 1 sur 5, séries de la routine −1, RIR 3 ; ligne publiée', async () => {
    const r = await startCycle();
    expect(within(r).getByText('Semaine 1 sur 5 · Haut / Bas')).toBeInTheDocument();
    expect(within(r).getByText('Semaine de travail : une série de moins que la routine par exercice, 3 répétitions en réserve.')).toBeInTheDocument();
    expect(await cycles()).toEqual([{ routine_id: u(1), weeks: 5, unlimited: 0, status: 'active', outcome: null, deload_week: null, pauses: '[]', rotation_index: 0 }]);
    expect(await db.driver.select("SELECT field FROM sync_outbox WHERE table_name = 'mesocycle'")).toEqual([{ field: '*' }]);
  });

  it('semaine 5 : deload planifié dit en texte ; illimité : semaine dans le bloc', async () => {
    await startCycle();
    const r = await later(28);
    expect(within(r).getByText('Semaine 5 sur 5 · Haut / Bas')).toBeInTheDocument();
    expect(within(r).getByText('Semaine de deload : chaque proposition divise les séries par deux (au moins une), allège la charge (× 0,8) et vise au moins 4 répétitions en réserve ; hors statistiques.')).toBeInTheDocument();
    expect(within(r).queryByRole('button', { name: 'Anticiper le deload' })).toBeNull();
  });

  it('deload anticipé : proposé, confirmé par Ali, jamais déclenché seul ; annuler n’écrit rien', async () => {
    const r = await startCycle();
    fireEvent.click(within(r).getByRole('button', { name: 'Anticiper le deload' }));
    expect(within(r).getByText('Cette semaine devient le deload ; le cycle se termine après elle. L’historique est gardé.')).toBeInTheDocument();
    fireEvent.click(within(r).getByRole('button', { name: 'Annuler' }));
    expect((await cycles())[0]?.deload_week).toBeNull();
    fireEvent.click(within(r).getByRole('button', { name: 'Anticiper le deload' }));
    fireEvent.click(within(r).getByRole('button', { name: 'Confirmer le deload' }));
    expect(await within(r).findByText('Semaine 1 sur 5 · deload anticipé · Haut / Bas')).toBeInTheDocument();
    expect((await cycles())[0]?.deload_week).toBe(1);
  });

  it('pause puis reprise après 30 jours : semaine allégée proposée, acceptée ; le cycle reprend à la même semaine', async () => {
    let r = await startCycle();
    fireEvent.click(within(r).getByRole('button', { name: 'Mettre le programme en pause' }));
    expect(await within(r).findByText('Programme en pause depuis le 9 novembre : jours non comptés, aucune séance manquée, aucune notification.')).toBeInTheDocument();
    r = await later(30);
    expect(within(r).getByText('Programme en pause depuis le 9 novembre : jours non comptés, aucune séance manquée, aucune notification.')).toBeInTheDocument();
    fireEvent.click(within(r).getByRole('button', { name: 'Reprendre le programme' }));
    expect(within(r).getByText('Pause de 30 jours : une semaine allégée est proposée (séries et répétitions en réserve de la semaine 1), les charges tiennent compte de l’arrêt.')).toBeInTheDocument();
    fireEvent.click(within(r).getByRole('button', { name: 'Reprendre avec une semaine allégée' }));
    expect(await within(r).findByText('Semaine 1 sur 5 · semaine allégée · Haut / Bas')).toBeInTheDocument();
    expect(JSON.parse((await cycles())[0]?.pauses ?? '[]')).toEqual([{ from: '2026-11-09', to: '2026-12-09', lightWeek: true }]);
  });

  it('reprise après 14 jours : décalage seul, sans proposition', async () => {
    let r = await startCycle();
    fireEvent.click(within(r).getByRole('button', { name: 'Mettre le programme en pause' }));
    await within(r).findByRole('button', { name: 'Reprendre le programme' });
    r = await later(14);
    fireEvent.click(within(r).getByRole('button', { name: 'Reprendre le programme' }));
    expect(await within(r).findByText('Semaine 1 sur 5 · Haut / Bas')).toBeInTheDocument();
    expect(within(r).queryByText(/semaine allégée est proposée/)).toBeNull();
  });

  it('fin de bloc : bilan ; « Répéter » relance en semaine 1, l’ancien cycle est gardé, clos', async () => {
    await startCycle();
    const r = await later(35);
    expect(within(r).getByRole('heading', { name: 'Bilan du cycle' })).toBeInTheDocument();
    fireEvent.click(within(r).getByRole('button', { name: 'Répéter le cycle' }));
    expect(await within(r).findByText('Semaine 1 sur 5 · Haut / Bas')).toBeInTheDocument();
    expect((await cycles()).map((c) => [c.status, c.outcome, c.rotation_index])).toEqual([
      ['completed', 'repeat', 0],
      ['active', null, 0],
    ]);
  });

  it('bilan : « Régénérer » change la rotation, « Changer de programme » suit une autre routine et une autre durée', async () => {
    await startCycle('4 semaines');
    let r = await later(28);
    fireEvent.click(within(r).getByRole('button', { name: 'Régénérer le bloc' }));
    await within(r).findByText('Semaine 1 sur 4 · Haut / Bas');
    r = await later(28);
    fireEvent.click(within(r).getByRole('button', { name: 'Changer de programme' }));
    fireEvent.click(within(r).getByRole('radio', { name: 'Full Body' }));
    fireEvent.click(within(r).getByRole('radio', { name: 'Illimité' }));
    fireEvent.click(within(r).getByRole('button', { name: 'Commencer le cycle' }));
    expect(await within(r).findByText('Semaine 1 du bloc 1 · Full Body')).toBeInTheDocument();
    expect((await cycles()).map((c) => [c.routine_id, c.status, c.outcome, c.rotation_index, c.unlimited])).toEqual([
      [u(1), 'completed', 'regenerate', 0, 0],
      [u(1), 'completed', 'change', 1, 0],
      [u(10), 'active', null, 0, 1],
    ]);
  });

  it('revue : un geste refusé par le domaine (horloge revenue avant la pause) est dit, jamais un bouton sans effet', async () => {
    await startCycle();
    let r = await later(5);
    fireEvent.click(within(r).getByRole('button', { name: 'Mettre le programme en pause' }));
    await within(r).findByRole('button', { name: 'Reprendre le programme' });
    r = await later(-3);
    fireEvent.click(within(r).getByRole('button', { name: 'Mettre le programme en pause' }));
    expect(await within(r).findByRole('alert')).toHaveTextContent('Le cycle n’a pas pu être enregistré. Rien n’a changé.');
    expect(JSON.parse((await cycles())[0]?.pauses ?? '[]')).toEqual([{ from: '2026-11-14', to: null, lightWeek: false }]);
  });

  it('terminer le cycle en cours : bilan, puis « Terminer sans suite » : plus de cycle, rien d’effacé', async () => {
    const r = await startCycle();
    fireEvent.click(within(r).getByRole('button', { name: 'Terminer le cycle' }));
    fireEvent.click(await within(r).findByRole('button', { name: 'Terminer sans suite' }));
    expect(await within(r).findByText('Aucun cycle en cours.')).toBeInTheDocument();
    expect((await cycles()).map((c) => [c.status, c.outcome])).toEqual([['completed', 'stopped']]);
  });
});

describe('section Cycle : 4 / 6 semaines, semaine de reprise, durée du prochain cycle (PROG-01, D-267)', () => {
  const rampUp = () => db.driver.select<{ weeks: number; ramp_up: number | null; next_weeks: number | null }>('SELECT weeks, ramp_up, next_weeks FROM mesocycle');

  it('4 semaines, semaine de reprise désactivée par défaut : semaine 1 avec toutes les séries, RIR 3 ; semaine 2 : 2 à 3 en réserve', async () => {
    open();
    const r = await region();
    expect(within(r).getByRole('switch', { name: 'Semaine de reprise' })).not.toBeChecked();
    fireEvent.click(within(r).getByRole('radio', { name: 'Haut / Bas' }));
    fireEvent.click(within(r).getByRole('radio', { name: '4 semaines' }));
    fireEvent.click(within(r).getByRole('button', { name: 'Commencer le cycle' }));
    expect(await within(r).findByText('Semaine 1 sur 4 · Haut / Bas')).toBeInTheDocument();
    expect(within(r).getByText('Semaine de travail : les séries de la routine, 3 répétitions en réserve.')).toBeInTheDocument();
    expect(await rampUp()).toEqual([{ weeks: 4, ramp_up: 0, next_weeks: null }]);
    const w2 = await later(7);
    expect(await within(w2).findByText('Semaine de travail : les séries de la routine, 2 à 3 répétitions en réserve.')).toBeInTheDocument();
  });

  it('semaine de reprise activée à la main : enregistrée et dite en semaine 1', async () => {
    open();
    const r = await region();
    fireEvent.click(within(r).getByRole('radio', { name: 'Haut / Bas' }));
    fireEvent.click(within(r).getByRole('radio', { name: '4 semaines' }));
    fireEvent.click(within(r).getByRole('switch', { name: 'Semaine de reprise' }));
    fireEvent.click(within(r).getByRole('button', { name: 'Commencer le cycle' }));
    expect(await within(r).findByText('Semaine de reprise : une série de moins sur les exercices à 4 séries ou plus.')).toBeInTheDocument();
    expect(await rampUp()).toEqual([{ weeks: 4, ramp_up: 1, next_weeks: null }]);
  });

  it('durée changée en cours de cycle : appliquée au prochain cycle, celui-ci garde sa durée', async () => {
    const r = await startCycle('5 semaines');
    const next = within(r).getByRole('radiogroup', { name: 'Durée du prochain cycle' });
    expect(within(next).getAllByRole('radio').map((b) => b.textContent)).toEqual(['4 semaines', '5 semaines', '6 semaines']);
    fireEvent.click(within(next).getByRole('radio', { name: '4 semaines' }));
    expect(await within(r).findByText('Appliquée au prochain cycle ; celui-ci garde 5 semaines.')).toBeInTheDocument();
    expect(within(r).getByText('Semaine 1 sur 5 · Haut / Bas')).toBeInTheDocument();
    expect(await rampUp()).toEqual([{ weeks: 5, ramp_up: 0, next_weeks: 4 }]);
  });
});
