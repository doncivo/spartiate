import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import { addDays } from '../../../domain/localDate';
import type { MealEntryDraft } from '../../../domain/nutrition';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';
import { quickAddDraft, saveManualTarget, saveNutritionPrefs } from '../useCases';

/**
 * ERGO-02 (C1, C2, C9) : check-in hebdomadaire d'après l'aperçu (CheckIn-apres) : chiffre héros, résumé de la semaine en quatre cases, tableau
 * Actuel / Proposé / écart, note « Pourquoi », une seule action rouge (Accepter) puis Personnaliser et Refuser. Mêmes calculs, même
 * enregistrement qu'I4-03 (couverts par NutritionScreen.test.tsx). Lundi 9 novembre 2026, midi à Paris.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e3' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const d = (offset: number): LocalDate => addDays(TODAY, offset);
const fr = (n: number): string => n.toLocaleString('fr-FR').replace(/[  ]/g, ' ');
let db: TestDb;

beforeAll(async () => {
  await import('../NutritionScreen');
  await import('./CheckInView');
});

const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition', screen: 'checkin' } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
};
const region = () => screen.findByRole('region', { name: 'Nutrition' });

async function seedHistory(withTarget: boolean): Promise<void> {
  const drafts: MealEntryDraft[] = [];
  for (let i = -28; i <= -1; i += 1) {
    for (const time of ['07:00', '13:00', '19:00']) drafts.push(quickAddDraft({ date: d(i), time: time as LocalTime, name: 'Repas', kcal: 800, proteinG: 50, fatG: 25, carbG: 100 }));
  }
  await db.data.transaction(async (repos) => {
    await (await repos.mealEntries()).createMany(drafts);
  });
  const weights = await db.data.repos.bodyWeights();
  for (let i = -28; i <= -1; i += 2) await weights.saveManual({ date: d(i), kg: 80, timezone: 'Europe/Paris' }, TODAY);
  await (await db.data.repos.profile()).save({ sex: 'male', birthYear: 1990, heightCm: 180 }, 2026);
  await saveNutritionPrefs(db.data, { activity: 'moderate', style: 'collaborative', goal: { kind: 'maintain' }, checkInWeekday: 1 });
  if (withTarget) await saveManualTarget(db.data, { weekStart: d(-14), target: { kcal: 2400, proteinG: 170, fatG: 75, carbG: 261 }, lowFloorConfirmed: false });
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Check-in : proposition (CheckIn-apres)', () => {
  it('en-tête : date du check-in et style, puis la semaine analysée', async () => {
    await seedHistory(true);
    open();
    const r = await region();
    expect(await within(r).findByText('Check-in · 9 novembre · style collaboratif')).toBeInTheDocument();
    expect(within(r).getByRole('heading', { name: 'Semaine du 2 novembre' })).toBeInTheDocument();
  });

  it('héros : variation de la tendance par semaine, objectif et couverture dits en texte', async () => {
    await seedHistory(true);
    open();
    const r = await region();
    await within(r).findByRole('button', { name: /^Accepter/ });
    expect(within(r).getByText('kg / sem.')).toBeInTheDocument();
    expect(within(r).getByText('objectif maintien · couverture suffisante')).toBeInTheDocument();
  });

  it('résumé de la semaine en quatre cases : tendance, jours loggés, apports, dépense', async () => {
    await seedHistory(true);
    open();
    const r = await region();
    await within(r).findByRole('button', { name: /^Accepter/ });
    const summary = within(r).getByRole('group', { name: 'Résumé de la semaine' });
    expect(within(summary).getByText('kg tendance')).toBeInTheDocument();
    expect(within(summary).getByText('7/7')).toBeInTheDocument();
    expect(within(summary).getByText('jours loggés')).toBeInTheDocument();
    expect(within(summary).getByText(fr(2400))).toBeInTheDocument();
    expect(within(summary).getByText('kcal apports')).toBeInTheDocument();
    expect(within(summary).getByText('kcal dépense')).toBeInTheDocument();
  });

  it('tableau Actuel / Proposé / écart : cible en vigueur, cible proposée, variation ; borne ± 150 rappelée', async () => {
    await seedHistory(true);
    open();
    const r = await region();
    await within(r).findByRole('button', { name: /^Accepter/ });
    const table = within(r).getByRole('table', { name: 'Proposition' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Actuel', 'Proposé', 'Écart']);
    const kcal = within(table).getByRole('row', { name: /^Calories/ });
    expect(kcal.textContent).toContain(fr(2400));
    for (const label of ['Calories', 'Protéines', 'Glucides', 'Lipides']) expect(within(table).getByRole('row', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    expect(within(r).getByText('borne ± 150 kcal')).toBeInTheDocument();
  });

  it('sans cible en vigueur : « — » et sa raison dans la colonne Actuel, jamais 0', async () => {
    await seedHistory(false);
    open();
    const r = await region();
    await within(r).findByRole('button', { name: /^Accepter/ });
    const table = within(r).getByRole('table', { name: 'Proposition' });
    expect(within(table).getAllByText('aucune cible en vigueur').length).toBeGreaterThan(0);
    expect(table.textContent ?? '').not.toMatch(/(^|\D)0 (kcal|g)/);
  });

  it('une seule action principale : Accepter en premier, Personnaliser et Refuser ensuite ; aucun point d’exclamation', async () => {
    await seedHistory(true);
    open();
    const r = await region();
    await within(r).findByRole('button', { name: /^Accepter/ });
    const names = within(r)
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) => /^(Accepter|Personnaliser|Refuser)/.test(t));
    expect(names[0]).toMatch(/^Accepter/);
    expect(names.slice(1)).toEqual(['Personnaliser', 'Refuser']);
    expect(r.textContent ?? '').not.toContain('!');
    expect(within(r).getByText(/Pourquoi/)).toBeInTheDocument();
  });
});

describe('Check-in : états sans proposition', () => {
  it('suspendu : un bandeau fin, pas une carte pleine ; aucune cible proposée', async () => {
    await (await db.data.repos.bodyWeights()).saveManual({ date: d(-3), kg: 104, timezone: 'Europe/Paris' }, TODAY);
    const view = open();
    const r = await region();
    expect(await within(r).findByText('Check-in suspendu')).toBeInTheDocument();
    expect(view.container.querySelector('.ct-checkin__banner')).not.toBeNull();
    expect(within(r).queryByRole('button', { name: /^Accepter/ })).toBeNull();
  });
});
