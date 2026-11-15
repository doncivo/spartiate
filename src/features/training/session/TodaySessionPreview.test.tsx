import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { RoutineInput } from '../../../domain/training';
import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import { createMesocycleSpec } from '../../../domain/training/mesocycle';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { applyRemoteChanges } from '../../sync/remoteChanges';
import { TodaySessionCard } from './TodaySessionCard';

/**
 * FIX-0223 (D-260, aperçu validé docs/maquettes/propositions/esthetique-2026-11-12/Aujourdhui-apres.dc.html) : la carte « Séance du jour »
 * annonce la durée estimée et le nombre d'exercices, les trois premiers exercices avec la charge que la séance proposera (bronze),
 * « + n exercices », et « Lancer la séance » en action rouge. Charge inconnue : aucun chiffre. Sans cycle actif : carte inchangée.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f3' as DeviceId;
const u = (n: number): string => `5e4d3c00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (id: number, exerciseId: string, exerciseName: string, position: number) => ({ id: u(id), exerciseId, exerciseName, sets: 3, repMin: 8, repMax: 10, rir: null, restSec: 120, position });
// Positions volontairement dans le désordre de saisie : l'ordre affiché suit `position`.
const PROGRAM: RoutineInput = {
  id: u(20),
  name: 'Haut seul',
  mode: 'programme',
  days: [
    {
      id: u(21),
      name: 'Haut A',
      dayOrder: 1,
      exercises: [
        line(23, 'incline-press-dumbbell', 'Développé incliné haltères', 2),
        line(22, 'row-barbell', 'Rowing barre', 1),
        line(24, 'bench-press-barbell', 'Développé couché barre', 0),
        line(25, 'curl-barbell', 'Curl barre', 3),
        line(26, 'lateral-raise-dumbbell', 'Élévations latérales', 4),
      ],
    },
  ],
};
// Séance close de référence : 3 × 8 à ces charges (bas de la plage 8-10).
const DONE: Readonly<Record<string, number>> = { 'bench-press-barbell': 80, 'row-barbell': 70, 'incline-press-dumbbell': 26, 'curl-barbell': 30, 'lateral-raise-dumbbell': 10 };

let db: TestDb;
const containerOf = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
const mount = (container = containerOf()) => {
  return render(
    <AppContainerProvider container={container}>
      <TodaySessionCard />
    </AppContainerProvider>,
  );
};
async function followProgram(): Promise<void> {
  await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(PROGRAM));
  const spec = createMesocycleSpec({ routineId: PROGRAM.id ?? '', startDate: '2026-11-09' as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
  if (spec === null) throw new Error('spec');
  await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec));
}
async function closeOnce(): Promise<void> {
  const repo = await db.data.repos.workouts();
  const w = await repo.start({ source: 'routine', routineId: u(20), dayId: u(21) });
  for (const s of w.sets) await repo.validateSet(s.id, { reps: 8, loadKg: DONE[s.exerciseId] ?? 0 });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(w.id));
}
const rows = (card: HTMLElement) => within(within(card).getByRole('list', { name: 'Exercices de la séance du jour' })).getAllByRole('listitem');

// Premier import de l'aperçu (moteur, catalogue) hors de la mesure des attentes : la carte ne fait qu'attendre la base ensuite.
beforeAll(async () => {
  await import('./todaySessionPreview');
});
beforeEach(async () => {
  // ERGO-02 : la carte a une disposition PC (tableau) ; ces vérifications portent sur l'iPhone, viewport étroit déclaré (jsdom : 1 024 px = PC).
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-10T07:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('FIX-0223 : carte « Séance du jour » conforme à l’aperçu', () => {
  it('cycle actif : durée et nombre, trois exercices avec leur charge en bronze, « + 2 exercices », « Lancer la séance » en action rouge', async () => {
    await followProgram();
    await closeOnce();
    mount();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    expect(within(card).getByText('Haut A')).toBeInTheDocument();
    // 5 lignes × (3 × 45 s + 2 × 120 s) = 1 875 s → 31 min (estimateSessionSec, DEFAULT_GENERATION_CONFIG).
    expect(within(card).getByText('≈ 31 min · 5 exercices')).toBeInTheDocument();
    const items = rows(card);
    expect(items).toHaveLength(3);
    expect(items.map((li) => li.querySelector('.ct-session-card__exercise')?.textContent)).toEqual(['Développé couché barre', 'Rowing barre', 'Développé incliné haltères']);
    const loads = items.map((li) => li.querySelector('.ct-session-card__load'));
    expect(loads.map((el) => el?.textContent)).toEqual(['80 kg', '70 kg', '2 × 26 kg']);
    expect(within(card).getByText('+ 2 exercices')).toBeInTheDocument();
    expect(within(card).queryByText('Curl barre')).toBeNull();
    const launch = within(card).getByRole('button', { name: 'Lancer la séance' });
    expect(launch).toHaveClass('ct-button--primary');
    expect(card.querySelectorAll('.ct-button--primary')).toHaveLength(1);
    expect(within(card).getByRole('button', { name: 'Autre séance…' })).not.toHaveClass('ct-button--primary');
  });

  it('charge inconnue (aucune séance close) : les exercices sans aucun chiffre de charge', async () => {
    await followProgram();
    mount();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    expect(await within(card).findByText('≈ 31 min · 5 exercices')).toBeInTheDocument();
    const items = rows(card);
    expect(items).toHaveLength(3);
    expect(card.querySelectorAll('.ct-session-card__load')).toHaveLength(0);
    expect(card.textContent).not.toMatch(/\d\s?kg/);
    expect(within(card).getByText('+ 2 exercices')).toBeInTheDocument();
  });

  it('sans cycle actif : la carte « Séance » d’avant, sans durée ni charge', async () => {
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(PROGRAM));
    mount();
    const card = await screen.findByRole('region', { name: 'Séance' });
    expect(within(card).getByRole('button', { name: 'Commencer une séance' })).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/min|kg/);
    expect(screen.queryByRole('button', { name: 'Lancer la séance' })).toBeNull();
  });
});

describe('FIX-0243 (constat 7, D-260) : carte « Séance du jour » relue après une synchro reçue, sans remontage', () => {
  const notify = (tables: readonly string[]) => act(async () => void (await applyRemoteChanges(containerOf(), { tables: new Set(tables), ids: new Map() })));

  it('séance close et séries reçues : la charge de la séance (80 kg) s’affiche, carte montée une seule fois', async () => {
    await followProgram();
    mount();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    expect(await within(card).findByText('≈ 31 min · 5 exercices')).toBeInTheDocument();
    expect(card.querySelectorAll('.ct-session-card__load')).toHaveLength(0);
    // Historique synthétique écrit hors de l'écran (comme une séance reçue d'un autre appareil), puis lot appliqué.
    await closeOnce();
    await notify(['workout', 'workout_set']);
    expect(await within(card).findByText('80 kg')).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Séance du jour' })).toHaveLength(1);
  });

  it('cycle reçu : la carte « Séance » devient « Séance du jour » ; un lot sans rapport ne relit rien', async () => {
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(PROGRAM));
    mount();
    expect(await screen.findByRole('region', { name: 'Séance' })).toBeInTheDocument();
    const spec = createMesocycleSpec({ routineId: PROGRAM.id ?? '', startDate: '2026-11-09' as LocalDate, weeks: 5 }, DEFAULT_GENERATION_CONFIG);
    if (spec === null) throw new Error('spec');
    await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec));
    await notify(['meal_entry']);
    expect(screen.queryByRole('region', { name: 'Séance du jour' })).toBeNull();
    await notify(['mesocycle']);
    expect(await screen.findByRole('region', { name: 'Séance du jour' })).toBeInTheDocument();
  });

  it.each(['recommendation_decision', 'progression_profile', 'routine', 'routine_exercise', 'body_weight'])('lot touchant « %s » : la carte se relit (80 kg)', async (table) => {
    await followProgram();
    mount();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    expect(await within(card).findByText('≈ 31 min · 5 exercices')).toBeInTheDocument();
    await closeOnce();
    await notify([table]);
    expect(await within(card).findByText('80 kg')).toBeInTheDocument();
  });

  it('routine reçue (jour renommé) : relue', async () => {
    await followProgram();
    mount();
    const card = await screen.findByRole('region', { name: 'Séance du jour' });
    expect(within(card).getByText('Haut A')).toBeInTheDocument();
    await db.driver.execute("UPDATE routine_day SET name = 'Haut A bis' WHERE id = ?", [u(21)]);
    await notify(['routine_day']);
    expect(await within(card).findByText('Haut A bis')).toBeInTheDocument();
  });
});
