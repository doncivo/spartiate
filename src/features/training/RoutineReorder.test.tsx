import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { RoutineInput } from '../../domain/training';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { TrainingScreen } from './TrainingScreen';

/**
 * PROG-03 (§ 18.1, gestes PC : glisser-déposer pour réordonner ; § 18.6, clavier PC et lecteur d'écran) : sur PC, une poignée par exercice d'un jour
 * et par jour de la routine se glisse pour changer l'ordre ; Alt+↑ / Alt+↓ sur la poignée fait de même ; une région polie annonce la nouvelle position.
 * Sur iPhone, pas de poignée : « Monter » / « Descendre » comme avant. L'ordre est écrit par les mêmes repositories (position, day_order).
 * Fixtures synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-0000000003a3' as DeviceId;
const u = (n: number): string => `4d3c2b00-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SQUAT = 'Squat à la barre';
const BENCH = 'Développé couché à la barre';
const ROW = 'Rowing à la barre';
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Essai ordre',
  mode: 'libre',
  days: [
    {
      id: u(2),
      name: 'Jour A',
      dayOrder: 1,
      exercises: [
        { id: u(3), exerciseId: 'squat-barbell', exerciseName: SQUAT, sets: 3, repMin: 5, repMax: 8, rir: 2, restSec: 180, position: 0 },
        { id: u(4), exerciseId: 'bench-press-barbell', exerciseName: BENCH, sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 1 },
        { id: u(5), exerciseId: 'row-barbell', exerciseName: ROW, sets: 3, repMin: 8, repMax: 12, rir: null, restSec: 120, position: 2 },
      ],
    },
    { id: u(6), name: 'Jour B', dayOrder: 2, exercises: [] },
  ],
};

let db: TestDb;
function viewport(width: number): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= 1024 && query.includes('min-width: 1024px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}
const container = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
async function openEditor(): Promise<HTMLElement> {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'routines' } as Route));
  render(
    <AppContainerProvider container={container()}>
      <TrainingScreen session={{ os: 'other' }} />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Essai ordre/ }));
  return screen.findByRole('group', { name: 'Jour A' });
}
const lineNames = (day: HTMLElement): string[] => Array.from(day.querySelectorAll('li.ct-training__line')).map((li) => li.getAttribute('aria-label') ?? '');
const dayNames = (): string[] => Array.from(document.querySelectorAll('fieldset.ct-training__day')).map((f) => f.getAttribute('aria-label') ?? '');
const live = (): HTMLElement => {
  const region = document.querySelector('[aria-live="polite"].ct-training__reorder-live');
  if (!(region instanceof HTMLElement)) throw new Error('région aria-live absente');
  return region;
};
const handle = (name: string): HTMLElement => screen.getByRole('button', { name: `Déplacer « ${name} » (Alt+Flèche haut ou bas)` });
const dayHandle = (name: string): HTMLElement => screen.getByRole('button', { name: `Déplacer le jour « ${name} » (Alt+Flèche haut ou bas)` });
const item = (day: HTMLElement, name: string): HTMLElement => within(day).getByRole('group', { name });
const savedLines = () => db.driver.select<{ exercise_id: string; position: number }>('SELECT exercise_id, position FROM routine_exercise WHERE deleted_at IS NULL ORDER BY position');
const savedDays = () => db.driver.select<{ name: string; day_order: number }>('SELECT name, day_order FROM routine_day WHERE deleted_at IS NULL ORDER BY day_order');
async function save(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la routine' }));
  await screen.findByText('Routine enregistrée');
}

beforeAll(async () => {
  await Promise.all([import('./TrainingScreen'), import('./RoutineCircuitUi')]);
}, 60_000);
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-16T09:00:00.000Z');
  await (await db.data.repos.trainingRoutines()).create(ROUTINE);
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe('PROG-03 : réordonner sur PC (glisser-déposer, Alt+flèches, annonce)', () => {
  it('glisser le troisième exercice sur le premier le place en tête, l’annonce et l’enregistre par les positions', async () => {
    viewport(1440);
    const day = await openEditor();
    const source = handle(ROW);
    expect(source.getAttribute('draggable')).toBe('true');
    fireEvent.dragStart(source);
    const target = item(day, SQUAT);
    const accepted = { dropEffect: 'none' };
    const over = fireEvent.dragOver(target, { dataTransfer: accepted });
    expect(over).toBe(false); // preventDefault : dépôt accepté
    expect(accepted.dropEffect).toBe('move'); // l'absorption de l'éditeur (revue 1) ne l'écrase pas
    fireEvent.drop(target);
    fireEvent.dragEnd(source);
    expect(lineNames(day)).toEqual([ROW, SQUAT, BENCH]);
    expect(live().textContent).toBe(`« ${ROW} » : position 1 sur 3`);
    await save();
    expect(await savedLines()).toEqual([
      { exercise_id: 'row-barbell', position: 0 },
      { exercise_id: 'squat-barbell', position: 1 },
      { exercise_id: 'bench-press-barbell', position: 2 },
    ]);
  });

  it('Alt+↓ puis Alt+↑ sur la poignée déplacent d’une place, annoncent, et le focus reste sur la poignée', async () => {
    viewport(1440);
    const day = await openEditor();
    const squat = handle(SQUAT);
    squat.focus();
    fireEvent.keyDown(squat, { key: 'ArrowDown', altKey: true });
    expect(lineNames(day)).toEqual([BENCH, SQUAT, ROW]);
    expect(live().textContent).toBe(`« ${SQUAT} » : position 2 sur 3`);
    expect(document.activeElement).toBe(handle(SQUAT));
    fireEvent.keyDown(handle(SQUAT), { key: 'ArrowDown', altKey: true });
    expect(lineNames(day)).toEqual([BENCH, ROW, SQUAT]);
    expect(live().textContent).toBe(`« ${SQUAT} » : position 3 sur 3`);
    fireEvent.keyDown(handle(BENCH), { key: 'ArrowUp', altKey: true });
    expect(lineNames(day)).toEqual([BENCH, ROW, SQUAT]); // déjà en tête : rien ne bouge
    fireEvent.keyDown(handle(ROW), { key: 'ArrowUp' }); // sans Alt : rien
    expect(lineNames(day)).toEqual([BENCH, ROW, SQUAT]);
    await save();
    expect((await savedLines()).map((l) => l.exercise_id)).toEqual(['bench-press-barbell', 'row-barbell', 'squat-barbell']);
  });

  it('les jours se réordonnent par glisser-déposer et par Alt+flèches ; day_order est réécrit', async () => {
    viewport(1440);
    await openEditor();
    expect(dayNames()).toEqual(['Jour A', 'Jour B']);
    fireEvent.dragStart(dayHandle('Jour B'));
    const target = screen.getByRole('group', { name: 'Jour A' });
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    expect(dayNames()).toEqual(['Jour B', 'Jour A']);
    expect(live().textContent).toBe('« Jour B » : position 1 sur 2');
    fireEvent.keyDown(dayHandle('Jour B'), { key: 'ArrowDown', altKey: true });
    expect(dayNames()).toEqual(['Jour A', 'Jour B']);
    fireEvent.keyDown(dayHandle('Jour A'), { key: 'ArrowDown', altKey: true });
    expect(dayNames()).toEqual(['Jour B', 'Jour A']);
    await save();
    expect(await savedDays()).toEqual([
      { name: 'Jour B', day_order: 1 },
      { name: 'Jour A', day_order: 2 },
    ]);
  });

  it('un exercice déposé sur un autre jour, ou un jour déposé sur lui-même, ne change rien ; un jour déposé sur un exercice vise son jour', async () => {
    viewport(1440);
    const day = await openEditor();
    fireEvent.dragStart(handle(SQUAT));
    const otherDay = screen.getByRole('group', { name: 'Jour B' });
    const refused = { dropEffect: 'move' };
    expect(fireEvent.dragOver(otherDay, { dataTransfer: refused })).toBe(false); // absorbé par l'éditeur (revue 1)
    expect(refused.dropEffect).toBe('none'); // dépôt refusé
    fireEvent.drop(otherDay);
    fireEvent.dragEnd(handle(SQUAT));
    expect(lineNames(day)).toEqual([SQUAT, BENCH, ROW]);
    expect(dayNames()).toEqual(['Jour A', 'Jour B']);
    fireEvent.dragStart(dayHandle('Jour B'));
    fireEvent.drop(otherDay);
    expect(dayNames()).toEqual(['Jour A', 'Jour B']);
    expect(live().textContent).toBe('');
    fireEvent.dragEnd(dayHandle('Jour B'));
    fireEvent.dragStart(dayHandle('Jour B'));
    fireEvent.drop(item(day, BENCH)); // remonte jusqu'au jour A
    expect(lineNames(day)).toEqual([SQUAT, BENCH, ROW]);
    expect(dayNames()).toEqual(['Jour B', 'Jour A']);
  });

  it('qa : un exercice déposé sur un exercice d’un autre jour ne change aucun des deux jours', async () => {
    viewport(1440);
    await (await db.data.repos.trainingRoutines()).addExercise(u(6), { id: u(7), exerciseId: 'deadlift-barbell', exerciseName: 'Soulevé de terre', sets: 3, repMin: 3, repMax: 5, rir: 2, restSec: 180, position: 0 });
    const day = await openEditor();
    const dayB = screen.getByRole('group', { name: 'Jour B' });
    const before = lineNames(dayB);
    expect(before).toHaveLength(1);
    fireEvent.dragStart(handle(ROW));
    const target = dayB.querySelector('li.ct-training__line');
    if (!(target instanceof HTMLElement)) throw new Error('ligne du jour B absente');
    const refused = { dropEffect: 'move' };
    expect(fireEvent.dragOver(target, { dataTransfer: refused })).toBe(false);
    expect(refused.dropEffect).toBe('none');
    fireEvent.drop(target);
    expect(lineNames(day)).toEqual([SQUAT, BENCH, ROW]);
    expect(lineNames(dayB)).toEqual(before);
    expect(live().textContent).toBe('');
  });

  it('revue 1 : le glisser porte un type propre (jamais text/plain) et un dépôt sur un champ de l’éditeur est absorbé, valeur inchangée', async () => {
    viewport(1440);
    await openEditor();
    const setData = vi.fn();
    const dataTransfer = { setData, getData: vi.fn(() => ''), effectAllowed: 'none', dropEffect: 'none', types: [] as string[] };
    fireEvent.dragStart(handle(ROW), { dataTransfer });
    expect(setData).toHaveBeenCalledWith('application/x-spartiate-reorder', expect.any(String));
    expect(setData.mock.calls.some(([type]) => type === 'text/plain' || type === 'text')).toBe(false);
    const dayName = within(screen.getByRole('group', { name: 'Jour A' })).getByLabelText('Nom du jour');
    expect(fireEvent.dragOver(dayName, { dataTransfer })).toBe(false); // absorbé par l'éditeur : pas d'insertion du navigateur
    expect(fireEvent.drop(dayName, { dataTransfer })).toBe(false);
    expect((dayName as HTMLInputElement).value).toBe('Jour A');
    const routineName = screen.getByLabelText('Nom de la routine');
    fireEvent.dragStart(handle(ROW), { dataTransfer });
    expect(fireEvent.drop(routineName, { dataTransfer })).toBe(false);
    expect((routineName as HTMLInputElement).value).toBe('Essai ordre');
    fireEvent.dragEnd(handle(ROW));
    expect(fireEvent.dragOver(dayName)).toBe(true); // hors glisser interne : comportement natif rendu
  });

  it('revue 1 : un exercice groupé (superset) déplacé par glisser garde son groupe après l’enregistrement', async () => {
    viewport(1440);
    const day = await openEditor();
    fireEvent.click(within(day).getByRole('button', { name: 'Grouper en circuit' }));
    const form = await within(day).findByRole('region', { name: 'Superset, triset ou circuit' });
    fireEvent.click(within(form).getByRole('checkbox', { name: SQUAT }));
    fireEvent.click(within(form).getByRole('checkbox', { name: BENCH }));
    fireEvent.click(within(form).getByRole('button', { name: 'Créer le groupe' }));
    await within(day).findByRole('region', { name: 'Groupe : Superset' });
    fireEvent.dragStart(handle(BENCH));
    fireEvent.dragOver(item(day, SQUAT));
    fireEvent.drop(item(day, SQUAT));
    expect(lineNames(day)).toEqual([BENCH, SQUAT, ROW]);
    fireEvent.keyDown(handle(ROW), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(handle(ROW), { key: 'ArrowDown', altKey: true });
    expect(lineNames(day)).toEqual([BENCH, SQUAT, ROW]);
    await save();
    const rows = await db.driver.select<{ exercise_id: string; position: number; circuit_id: string | null }>('SELECT exercise_id, position, circuit_id FROM routine_exercise WHERE deleted_at IS NULL ORDER BY position');
    expect(rows.map((r) => r.exercise_id)).toEqual(['bench-press-barbell', 'squat-barbell', 'row-barbell']);
    expect(rows[0]?.circuit_id).not.toBeNull();
    expect(rows[1]?.circuit_id).toBe(rows[0]?.circuit_id);
    expect(rows[2]?.circuit_id).toBeNull();
  });

  it('sans glisser en cours, un dépôt (fichier venu d’ailleurs) ne change rien', async () => {
    viewport(1440);
    const day = await openEditor();
    expect(fireEvent.dragOver(item(day, BENCH))).toBe(true);
    fireEvent.drop(item(day, BENCH));
    expect(lineNames(day)).toEqual([SQUAT, BENCH, ROW]);
    expect(dayNames()).toEqual(['Jour A', 'Jour B']);
  });
});

describe('PROG-03 : iPhone inchangé', () => {
  it('à 440 px, aucune poignée : « Monter » / « Descendre » restent', async () => {
    viewport(440);
    const day = await openEditor();
    expect(screen.queryByRole('button', { name: /^Déplacer/ })).toBeNull();
    fireEvent.click(within(item(day, BENCH)).getByRole('button', { name: 'Monter' }));
    expect(lineNames(day)).toEqual([BENCH, SQUAT, ROW]);
    await waitFor(() => expect(live().textContent).toBe(`« ${BENCH} » : position 1 sur 3`));
  });
});

describe('PROG-03 : poignée ≥ 44 px, visible au focus, tokens seulement', () => {
  it('la feuille de styles donne 44 px, un contour au focus par jeton et aucune couleur en dur', () => {
    const css = readFileSync('src/features/training/TrainingScreen.css', 'utf8');
    const block = (selector: string): string => {
      const start = css.indexOf(`${selector} {`);
      expect(start, selector).toBeGreaterThanOrEqual(0);
      return css.slice(start, css.indexOf('}', start));
    };
    const rule = block('.ct-training__drag-handle');
    expect(rule).toMatch(/min-width: 44px/);
    expect(rule).toMatch(/min-height: 44px/);
    expect(rule).toMatch(/cursor: grab/);
    expect(block('.ct-training__drag-handle:focus-visible')).toMatch(/outline: 2px solid var\(--ct-color-focus-ring\)/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
