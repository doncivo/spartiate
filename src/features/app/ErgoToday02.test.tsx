import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { RoutineInput } from '../../domain/training';
import type { DeviceId, LocalDate, LocalTime } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { loadNutritionSnapshot, quickAddDraft, saveManualTarget } from '../nutrition/useCases';
import { readTrainingData } from '../training/trainingState';
import { PC_MEDIA_QUERY } from '../../ui';
import { AppContainerProvider } from './AppContainerContext';
import { AppStatusBanner } from './AppStatusBanner';
import { createAppContainer } from './container';
import { INITIAL_NAVIGATION, useNavigationStore } from './navigation';
import { useAppStatusStore } from './appStatus';
import { TodayScreen } from './TodayScreen';

/**
 * ERGO-02 (PC-Aujourdhui-apres.dc.html, Degrades-apres.dc.html) : Aujourd'hui PC réaligné (colonne droite : nutrition et macros, poids et
 * dépense, semaine, derniers records ; carte « État » petite, en dernier), tiret et raison pour une donnée manquante, bandeaux fins teintés.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000f5' as DeviceId;
const u = (n: number): string => `6e4d3c00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Haut',
  mode: 'programme',
  days: [{ id: u(2), name: 'Haut A', dayOrder: 1, exercises: [{ id: u(3), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché barre', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 }] }],
};
let db: TestDb;
const set = useAppStatusStore.getState().setStatus;

function viewport(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === PC_MEDIA_QUERY, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
const open = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TodayScreen />
    </AppContainerProvider>,
  );
async function closeWith(loadKg: number): Promise<void> {
  const repo = await db.data.repos.workouts();
  const w = await repo.start({ source: 'routine', routineId: u(1), dayId: u(2) });
  for (const s of w.sets) await repo.validateSet(s.id, { reps: 8, loadKg });
  await db.data.transaction(async (repos) => (await repos.workouts()).close(w.id));
}

// Premier import des blocs à la demande d'Aujourd'hui PC (colonne droite, séance, récupération, nutrition, compléments, notices) hors de la
// mesure des attentes : à froid, ils se chargent ensemble et dépassent l'attente par défaut. Aucune attente allongée.
beforeAll(async () => {
  await Promise.all([
    import('./TodayPcSide'),
    import('./SectionNotice'),
    import('../training/session/TodaySessionCard'),
    import('../nutrition/NutritionRemainingCard'),
    import('../nutrition/supplements/SupplementsTodayCard'),
    import('../recovery/RecoveryToday'),
  ]);
  // Premières lectures (instantané de Nutrition, données d'entraînement) sur une base jetable : compilation des requêtes à froid.
  const warm = await openBaseDb(DEVICE, '2026-11-10T07:00:00.000Z');
  await loadNutritionSnapshot(warm.data, '2026-11-10' as LocalDate);
  await readTrainingData(warm.data);
  await (await warm.data.repos.workouts()).listClosed(10);
  await warm.close();
}, 30_000);
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  viewport();
  db = await openBaseDb(DEVICE, '2026-11-10T07:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  for (const kind of ['offline', 'syncing', 'waitingIcloud', 'syncTrouble', 'signingExpiry'] as const) set(kind, null);
  await db.close();
});

describe('ERGO-02 : Aujourd’hui sur PC, colonne droite', () => {
  it('données vides : semaine et records sans faux zéro, dépense et records en « — » avec leur raison', async () => {
    open();
    const week = await screen.findByRole('region', { name: 'Cette semaine' });
    expect(within(week).getAllByRole('listitem')).toHaveLength(7);
    const records = screen.getByRole('region', { name: 'Derniers records' });
    expect(within(records).getByText('pas encore de record')).toBeInTheDocument();
    expect(within(records).getByText('—')).toBeInTheDocument();
    const spend = screen.getByRole('region', { name: 'Dépense' });
    expect(within(spend).getByText('—')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/\b0\b/);
  });

  it('macros du jour (protéines, glucides, lipides : pris sur cible), semaine (jour de la séance marqué) et derniers records', async () => {
    await saveManualTarget(db.data, { weekStart: '2026-11-08' as LocalDate, target: { kcal: 2400, proteinG: 170, fatG: 75, carbG: 261 }, lowFloorConfirmed: false });
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: '2026-11-10' as LocalDate, time: '08:00' as LocalTime, name: 'Petit-déjeuner', kcal: 500, proteinG: 96, fatG: 48, carbG: 150 }));
    await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(ROUTINE));
    await closeWith(80);
    db.clock.advance(60_000);
    await closeWith(85);
    open();
    const macros = await screen.findByRole('list', { name: 'Macros du jour' });
    const text = (macros.textContent ?? '').replace(/\s/g, ' ');
    expect(text).toContain('Protéines 96 / 170 g');
    expect(text).toContain('Glucides 150 / 261 g');
    expect(text).toContain('Lipides 48 / 75 g');
    const week = screen.getByRole('region', { name: 'Cette semaine' });
    expect(await within(week).findByLabelText('mardi : séance faite')).toBeInTheDocument();
    expect(within(week).queryByLabelText('lundi : séance faite')).toBeNull();
    const records = screen.getByRole('region', { name: 'Derniers records' });
    expect(await within(records).findByText('Développé couché barre')).toBeInTheDocument();
    expect(within(records).getByText('85 kg')).toBeInTheDocument();
  });

  it('ordre de la colonne droite : nutrition, poids, semaine, records ; carte « État » en dernier et sans titre plus grand que les autres', async () => {
    const { container } = open();
    await screen.findByRole('region', { name: 'Cette semaine' });
    const aside = container.querySelector('aside.ct-today__col');
    const names = [...(aside?.querySelectorAll(':scope > section') ?? [])].map((s) => s.getAttribute('aria-label') ?? s.querySelector('h2')?.textContent);
    expect(names.slice(-3)).toEqual(['Cette semaine', 'Derniers records', 'État']);
    expect(aside?.querySelector('section.ct-today__state')).not.toBeNull();
  });

  it('Récupération en tête de la colonne gauche, puis la séance du jour', async () => {
    const { container } = open();
    await screen.findByRole('region', { name: 'Cette semaine' });
    await screen.findByText('Aucun résumé de récupération reçu de l’iPhone.');
    const left = container.querySelector('.ct-today__col');
    expect(left?.firstElementChild?.querySelector('h2')).toHaveTextContent('Récupération');
    expect(left?.querySelector('aside')).toBeNull();
  });
});

describe('ERGO-02 : bandeaux d’état, présentation seule', () => {
  it('mêmes textes ; teinte d’information (hors ligne, synchro, iCloud) ou d’avertissement (signature, synchro en échec)', () => {
    render(<AppStatusBanner />);
    const cases = [
      ['offline', {}, 'Hors ligne', 'info'],
      ['waitingIcloud', {}, 'En attente d’iCloud', 'info'],
      ['signingExpiry', { detail: 'soon' }, 'Spartiate expire bientôt', 'warn'],
    ] as const;
    for (const [kind, source, text, tone] of cases) {
      for (const other of ['offline', 'waitingIcloud', 'signingExpiry'] as const) set(other, null);
      act(() => set(kind, source));
      const banner = document.querySelector('.ct-status-banner');
      expect(banner).toHaveClass(`ct-status-banner--${tone}`);
      expect(banner?.textContent ?? '').toContain(text.slice(0, 12));
    }
  });
});
