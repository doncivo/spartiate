import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { setGeolocation, type GeoEvent, type Geolocation } from '../../platform/geolocation';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { CardioView } from '../cardio/CardioView';
import { TrainingScreen } from './TrainingScreen';

/**
 * ERGO-02 (critère C1, aperçu docs/maquettes/propositions/esthetique-2026-11-13/) : structure des écrans de la zone Entraînement selon l'aperçu
 * validé par Ali, avec les vraies données. Fiche exercice (iPhone : onglets Info / Instructions / Historique ; PC : bibliothèque à gauche, fiche à
 * droite), Matériel PC (profils à gauche, profil ouvert en colonnes, disques par côté), Cardio GPS en cours (distance en chiffre héros, durée,
 * allure, une seule action rouge). Une donnée absente s'écrit « — » avec sa raison.
 */

const DEVICE = '60000000-0000-4000-8000-0000000002e2' as DeviceId;
const BENCH = 'Développé couché à la barre';
let db: TestDb;

function viewport(width: number): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= 1024 && query.includes('min-width: 1024px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}
const container = (os: 'ios' | 'other' = 'other') => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os } });
const mount = (screenId: 'library' | 'equipment') => {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: screenId } as Route));
  return render(
    <AppContainerProvider container={container()}>
      <TrainingScreen />
    </AppContainerProvider>,
  );
};
/** Rouge : bouton principal (accent) ou destructif. */
const redActions = (root: HTMLElement): number => root.querySelectorAll('.ct-button--primary, .ct-button--danger, .ct-session__validate').length;

async function closeBench(sets: readonly (readonly [number, number])[]): Promise<void> {
  await db.data.transaction(async (r) => {
    const repo = await r.workouts();
    const w = await repo.start({ source: 'empty', name: 'Haut' });
    const next = await repo.addExercise(w.id, { exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: sets.length, targetRepsMin: 6, targetRepsMax: 10 });
    for (const [i, [loadKg, reps]] of sets.entries()) {
      const set = next.sets[i];
      if (!set) throw new Error('série absente');
      await repo.validateSet(set.id, { loadKg, reps, durationSec: null, rir: null });
    }
    await repo.close(w.id);
  });
  db.clock.advance(3 * 24 * 3600 * 1000);
}
async function openBench(): Promise<HTMLElement> {
  fireEvent.change(await screen.findByLabelText('Rechercher un exercice'), { target: { value: BENCH } });
  fireEvent.click(screen.getAllByRole('button', { name: BENCH })[0] as HTMLElement);
  return screen.findByRole('article', { name: BENCH });
}

beforeAll(async () => {
  await import('./media/ExerciseMedia');
});
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-10-20T17:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  setGeolocation(null);
  vi.unstubAllGlobals();
  await db.close();
});

describe('ERGO-02 : fiche exercice (Fiche-apres, PC-Fiche-apres)', () => {
  it('iPhone : en-tête (mouvement, muscles), onglets Info / Instructions / Historique ; Info : 1RM estimé en chiffre héros, record, 8 semaines, dernières séances, muscles', async () => {
    viewport(440);
    await closeBench([
      [60, 8],
      [60, 8],
    ]);
    await closeBench([
      [62.5, 8],
      [62.5, 7],
    ]);
    mount('library');
    const sheet = await openBench();
    expect(within(sheet).getByText(/Poussée horizontale/)).toBeInTheDocument();
    const tabs = within(sheet).getByRole('radiogroup', { name: 'Sections de la fiche' });
    expect(within(tabs).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Info', 'Instructions', 'Historique']);
    expect(within(tabs).getByRole('radio', { name: 'Info' })).toBeChecked();
    const hero = await within(sheet).findByText((_, el) => el?.classList.contains('ct-hero') === true);
    expect(hero).toHaveTextContent(/^\d+ kg$/);
    expect(within(sheet).getByText(/^confiance \d+ % · 2 séances$/)).toBeInTheDocument();
    expect(within(sheet).getByText('62,5 kg × 8', { selector: '.ct-sheet__record' })).toBeInTheDocument();
    const titles = [...sheet.querySelectorAll('.ct-section-title')].map((t) => t.textContent);
    expect(titles).toEqual(['1RM estimé', 'Record', '8 semaines', 'Dernières séances', 'Muscles sollicités']);
    expect(within(within(sheet).getByRole('list', { name: 'Dernières séances' })).getAllByRole('listitem')).toHaveLength(2);
    expect(sheet.querySelectorAll('.ct-sheet__bar')).toHaveLength(3);
    expect(within(sheet).queryByRole('heading', { name: 'Erreurs fréquentes' })).toBeNull();
    fireEvent.click(within(tabs).getByRole('radio', { name: 'Instructions' }));
    expect(within(sheet).getByRole('heading', { name: 'Erreurs fréquentes' })).toBeInTheDocument();
    expect(within(sheet).queryByText('1RM estimé')).toBeNull();
    fireEvent.click(within(tabs).getByRole('radio', { name: 'Historique' }));
    expect(await within(sheet).findByRole('list', { name: 'Historique' })).toBeInTheDocument();
    expect(redActions(sheet)).toBeLessThanOrEqual(1);
  });

  it('sans séance terminée : 1RM et record en « — » avec leur raison, jamais un chiffre inventé', async () => {
    viewport(440);
    mount('library');
    const sheet = await openBench();
    expect(await within(sheet).findByText('Pas encore de séance terminée avec cet exercice.')).toBeInTheDocument();
    expect(within(sheet).getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(sheet.querySelector('.ct-sheet__chart')).toBeNull();
  });

  it('PC : bibliothèque à gauche (recherche et liste restent), fiche à droite ; 1RM, record, 8 semaines puis consignes ; historique et muscles à côté', async () => {
    viewport(1440);
    await closeBench([
      [60, 8],
      [60, 8],
    ]);
    const { container: root } = mount('library');
    const sheet = await openBench();
    const split = root.querySelector('.ct-training__library--split');
    expect(split).not.toBeNull();
    expect(within(split as HTMLElement).getByLabelText('Rechercher un exercice')).toBeInTheDocument();
    expect(within(split as HTMLElement).getAllByRole('button', { name: BENCH }).length).toBeGreaterThan(0);
    expect(within(sheet).queryByRole('radiogroup', { name: 'Sections de la fiche' })).toBeNull();
    await within(sheet).findByText('60 kg × 8', { selector: '.ct-sheet__record' });
    const titles = [...sheet.querySelectorAll('.ct-section-title')].map((t) => t.textContent);
    expect(titles.slice(0, 5)).toEqual(['1RM estimé', 'Record', '8 semaines', 'Consignes', 'Historique']);
    expect(titles).toContain('Muscles');
    expect(redActions(sheet)).toBeLessThanOrEqual(1);
  });
});

describe('ERGO-02 : Matériel PC (PC-Materiel-apres)', () => {
  it('profils à gauche, profil ouvert : barres, haltères et kettlebells, crans en colonnes, disques par côté, machines à stack', async () => {
    viewport(1440);
    mount('equipment');
    const main = (await screen.findByRole('heading', { level: 2, name: 'Salle complète' })).closest('section') as HTMLElement;
    const titles = [...main.querySelectorAll('.ct-section-title')].map((t) => t.textContent);
    expect(titles).toEqual(['Barres', 'Haltères et kettlebells', 'Crans', 'Disques · par côté de barre', 'Machines à stack', 'Matériel disponible']);
    expect(main.querySelector('.ct-equipment__columns')).not.toBeNull();
    const plates = within(main).getByRole('list', { name: 'Disques · par côté de barre' });
    expect(within(plates).getAllByRole('listitem')).toHaveLength(8);
    expect(within(plates).getAllByRole('listitem')[0]).toHaveTextContent('1,25 kg');
    expect(main.querySelectorAll('.ct-equipment__plate-bar')).toHaveLength(8);
    expect(within(main).getByText('Barre olympique')).toBeInTheDocument();
    expect(within(main).getByText('2 à 58 kg')).toBeInTheDocument();
    expect(redActions(main)).toBeLessThanOrEqual(1);
  });
});

describe('ERGO-02 : cardio GPS en cours (Cardio-apres)', () => {
  it('distance en chiffre héros, durée, allure / km, dernier km absent dit avec sa raison, signal ; « Arrêter et reporter » seule action rouge', async () => {
    const NOW = Date.parse('2026-10-20T17:00:00.000Z');
    let listener: ((e: GeoEvent) => void) | null = null;
    const geo: Geolocation = {
      available: true,
      permission: async () => 'granted',
      request: async () => 'granted',
      watch: async (cb) => {
        listener = cb;
        return async () => {
          listener = null;
        };
      },
    };
    setGeolocation(geo);
    const fix = (i: number): GeoEvent => ({ kind: 'fix', fix: { lat: i * 0.001, lon: 0, accuracyM: 5, at: NOW + i * 30_000 } });
    render(
      <AppContainerProvider container={container('ios')}>
        <CardioView timeZone="Europe/Paris" />
      </AppContainerProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer le suivi GPS' }));
    await screen.findByText('En attente du signal GPS…');
    act(() => listener?.(fix(0)));
    db.clock.advance(30_000);
    act(() => listener?.(fix(1)));
    db.clock.advance(30_000);
    act(() => listener?.(fix(2)));
    const region = screen.getByRole('region', { name: 'Suivi GPS' });
    const hero = await within(region).findByText((_, el) => el?.classList.contains('ct-hero') === true);
    expect(hero).toHaveTextContent('0,22 km');
    const stats = within(region).getByRole('list', { name: 'Suivi en cours' });
    expect(within(stats).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['1:00durée', '4:30allure / km', '—dernier km : pas encore 1 km']);
    expect(within(region).getByText('Signal bon')).toBeInTheDocument();
    expect(redActions(region)).toBe(1);
    expect(region.querySelector('.ct-button--primary')).toHaveTextContent('Arrêter et reporter');
  });
});
