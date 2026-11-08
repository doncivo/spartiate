import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { MealEntryDraft } from '../../domain/nutrition';
import { addDays } from '../../domain/localDate';
import type { DeviceId, LocalDate, LocalTime } from '../../domain/types';
import type { DataAccess, Repositories } from '../../db/repositories/dataAccess';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { NutritionScreen } from './NutritionScreen';
import { quickAddDraft, saveManualTarget, saveNutritionPrefs } from './useCases';

/**
 * I4-03 revue de code : états d'erreur (lecture, écriture), fausses valeurs pendant le chargement, dépassement, jour partiel distinct
 * sans l'opacité seule. Les échecs sont injectés en enveloppant un repository (une panne simulée, aucune donnée réelle).
 */
const DEVICE = '60000000-0000-4000-8000-0000000000d5' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const d = (n: number): LocalDate => addDays(TODAY, n);
const t = (s: string): LocalTime => s as LocalTime;
let db: TestDb;

type Name = 'mealEntries' | 'nutritionTargets' | 'bodyWeights';
/** DataAccess dont `method` du repository `name` échoue `times` fois (toujours si omis). */
function failing(name: Name, method: string, times = Number.POSITIVE_INFINITY): DataAccess {
  let left = times;
  const original = db.data.repos[name] as unknown as () => Promise<Record<string, unknown>>;
  const repos = {
    ...db.data.repos,
    [name]: async () => {
      const repo = await original();
      return {
        ...repo,
        [method]: (...args: unknown[]) => {
          if (left > 0) {
            left -= 1;
            return Promise.reject(new Error('panne simulée'));
          }
          return (repo[method] as (...a: unknown[]) => unknown)(...args);
        },
      };
    },
  } as unknown as Repositories;
  return { ...db.data, repos };
}

function open(screenId?: 'journal' | 'dashboard' | 'strategy' | 'checkin', data: DataAccess = db.data) {
  act(() => useNavigationStore.getState().navigate((screenId ? { tab: 'nutrition', screen: screenId } : { tab: 'nutrition' }) as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data })}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
}
const region = () => screen.findByRole('region', { name: 'Nutrition' });
const WRITE_ERROR = 'L’enregistrement a échoué. Rien n’a changé.';

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function seedHistory(): Promise<void> {
  const drafts: MealEntryDraft[] = [];
  for (let i = -28; i <= -1; i += 1) for (const time of ['07:00', '13:00', '19:00']) drafts.push(quickAddDraft({ date: d(i), time: t(time), name: 'Repas', kcal: 800, proteinG: 50, fatG: 25, carbG: 100 }));
  await db.data.transaction(async (repos) => {
    await (await repos.mealEntries()).createMany(drafts);
  });
  const weights = await db.data.repos.bodyWeights();
  for (let i = -28; i <= -1; i += 2) await weights.saveManual({ date: d(i), kg: 80, timezone: 'Europe/Paris' }, TODAY);
  await (await db.data.repos.profile()).save({ sex: 'male', birthYear: 1990, heightCm: 180 }, 2026);
  await saveNutritionPrefs(db.data, { activity: 'moderate', style: 'collaborative', goal: { kind: 'maintain' }, checkInWeekday: 1 });
  await saveManualTarget(db.data, { weekStart: d(-14), target: { kcal: 2400, proteinG: 170, fatG: 75, carbG: 261 }, lowFloorConfirmed: false });
}

describe('I4-03 : lecture en échec ou en cours (aucun faux chiffre)', () => {
  it('I4-03 : instantané illisible : message et Réessayer, qui relit', async () => {
    open(undefined, failing('bodyWeights', 'listRecent', 1));
    expect(await screen.findByText('Nutrition n’a pas pu être lu.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('radiogroup', { name: 'Sections de Nutrition' })).toBeInTheDocument();
    expect(await screen.findByText('Rien de saisi aujourd’hui')).toBeInTheDocument();
  });

  it('I4-03 : journal illisible : la cible ne montre pas « 2 650 kcal restantes » (tiret), l’erreur est dite', async () => {
    await saveManualTarget(db.data, { weekStart: d(-1), target: { kcal: 2650, proteinG: 170, fatG: 75, carbG: 300 }, lowFloorConfirmed: false });
    open(undefined, failing('mealEntries', 'listByDate'));
    const r = await region();
    expect(await within(r).findByText('Nutrition n’a pas pu être lu.')).toBeInTheDocument();
    expect(r.textContent ?? '').not.toMatch(/2.650 kcal restantes/);
    expect(within(r).getByText('— kcal restantes')).toBeInTheDocument();
  });

  it('I4-03 : changer de jour retire aussitôt les actions des entrées de l’autre jour', async () => {
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: t('08:00'), name: 'Porridge', kcal: 400, proteinG: null, fatG: null, carbG: null }));
    open();
    const r = await region();
    await within(r).findByRole('button', { name: 'Corriger Porridge' });
    fireEvent.click(within(r).getByRole('button', { name: 'Jour précédent' }));
    expect(within(r).queryByRole('button', { name: 'Corriger Porridge' })).toBeNull();
    expect(within(r).queryByRole('button', { name: 'Supprimer Porridge' })).toBeNull();
  });

  it('I4-03 : l’erreur de lecture disparaît quand une lecture réussit', async () => {
    open(undefined, failing('mealEntries', 'listByDate', 1));
    const r = await region();
    expect(await within(r).findByText('Nutrition n’a pas pu être lu.')).toBeInTheDocument();
    fireEvent.click(within(r).getByRole('button', { name: 'Jour précédent' }));
    expect(await within(r).findByText('Rien de saisi ce jour-là')).toBeInTheDocument();
    expect(within(r).queryByText('Nutrition n’a pas pu être lu.')).toBeNull();
  });
});

describe('I4-03 : écriture en échec (rien ne change, l’échec est dit)', () => {
  it('I4-03 : Ajout rapide', async () => {
    open(undefined, failing('mealEntries', 'create'));
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Ajout rapide' }));
    fireEvent.change(await screen.findByLabelText('Calories (kcal)'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText(WRITE_ERROR)).toBeInTheDocument();
    expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(0);
  });

  it('I4-03 : correction', async () => {
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: t('08:00'), name: 'Shake', kcal: 300, proteinG: null, fatG: null, carbG: null }));
    open(undefined, failing('mealEntries', 'update'));
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Corriger Shake' }));
    fireEvent.change(await screen.findByLabelText('Calories (kcal)'), { target: { value: '350' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la correction' }));
    expect(await screen.findByText(WRITE_ERROR)).toBeInTheDocument();
    expect((await (await db.data.repos.mealEntries()).listByDate(TODAY))[0]?.kcal).toBe(300);
  });

  it('I4-03 : suppression', async () => {
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: t('08:00'), name: 'Shake', kcal: 300, proteinG: null, fatG: null, carbG: null }));
    open(undefined, failing('mealEntries', 'softDelete'));
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Supprimer Shake' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
    expect(await within(r).findByText(WRITE_ERROR)).toBeInTheDocument();
    expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(1);
  });

  it('I4-03 : Stratégie, cible manuelle', async () => {
    open('strategy', failing('nutritionTargets', 'record'));
    const r = await region();
    const fill = (label: string, value: string) => fireEvent.change(within(r).getByLabelText(label), { target: { value } });
    await within(r).findByLabelText('Calories (kcal)');
    fill('Calories (kcal)', '2500');
    fill('Protéines (g)', '160');
    fill('Lipides (g)', '70');
    fill('Glucides (g)', '300');
    fireEvent.click(within(r).getByRole('button', { name: 'Enregistrer la cible' }));
    expect(await within(r).findByText(WRITE_ERROR)).toBeInTheDocument();
    expect(await (await db.data.repos.nutritionTargets()).list()).toHaveLength(0);
  });

  it('I4-03 : check-in, Accepter', async () => {
    await seedHistory();
    open('checkin', failing('nutritionTargets', 'record'));
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: /^Accepter/ }));
    expect(await within(r).findByText(WRITE_ERROR)).toBeInTheDocument();
    expect(within(r).queryByText('Cible enregistrée.')).toBeNull();
    expect(await (await db.data.repos.nutritionTargets()).list()).toHaveLength(1);
  });
});

describe('I4-03 : dashboard, dépassement et jour partiel', () => {
  it('I4-03 : au-dessus de la cible : formulation de dépassement, jamais un restant négatif', async () => {
    await saveManualTarget(db.data, { weekStart: d(-1), target: { kcal: 2000, proteinG: 150, fatG: 60, carbG: 200 }, lowFloorConfirmed: false });
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: t('08:00'), name: 'Festin', kcal: 3000, proteinG: 10, fatG: 10, carbG: 10 }));
    open('dashboard');
    const r = await region();
    expect(await within(r).findByText(/kcal au-dessus de la cible/)).toBeInTheDocument();
    expect(r.textContent ?? '').not.toMatch(/[-−]d[ds]*kcal restantes/);
  });

  it('I4-03 : un jour partiel se distingue par un motif (trait pointillé), pas par l’opacité seule', async () => {
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: d(-1), time: t('08:00'), name: 'Solo', kcal: 500, proteinG: 10, fatG: 10, carbG: 10 }));
    open('dashboard');
    const r = await region();
    const chart = await within(r).findByRole('img', { name: 'Calories des 7 derniers jours' });
    const partial = chart.querySelector('.ct-nutrition__bar--partial');
    expect(partial).not.toBeNull();
    expect(partial?.getAttribute('stroke-dasharray')).toBeTruthy();
    await waitFor(() => expect(chart.querySelector('.ct-nutrition__bar--complete')).toBeNull());
  });
});
