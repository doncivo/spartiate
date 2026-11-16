import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { addDays } from '../../domain/localDate';
import type { MealEntryDraft } from '../../domain/nutrition';
import type { DeviceId, LocalDate, LocalTime } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { NutritionScreen } from './NutritionScreen';
import { quickAddDraft, saveManualTarget, saveNutritionPrefs } from './useCases';

/**
 * ERGO-03 revue 1 (point 1, D-296) : une décision acceptée du check-in, datée du jour du check-in (aujourd'hui ou avant), passerait devant
 * une cible future : même confirmation que Stratégie. Lundi 9 novembre 2026, midi à Paris ; cible future du lundi 16/11 ; valeurs synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e5' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const d = (offset: number): LocalDate => addDays(TODAY, offset);
let db: TestDb;

const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition', screen: 'checkin' }));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
};
const region = () => screen.findByRole('region', { name: 'Nutrition' });
const norm = (s: string | null | undefined): string => (s ?? '').replace(/[  ]/g, ' ');
const decisions = async () => (await db.data.repos.nutritionTargets()).list();

/** Quatre semaines complètes (repas et pesées), profil, préférences, cible d'il y a deux semaines ; puis la cible future, écrite en dernier (HLC le plus récent). */
async function seed(): Promise<void> {
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
  await saveManualTarget(db.data, { weekStart: d(-14), target: { kcal: 2400, proteinG: 170, fatG: 75, carbG: 261 }, lowFloorConfirmed: false });
  await saveManualTarget(db.data, { weekStart: d(7), target: { kcal: 2450, proteinG: 190, fatG: 75, carbG: 250 }, lowFloorConfirmed: false });
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('ERGO-03 revue 1 : check-in devant une cible future', () => {
  it('Accepter : confirmation D-296 ; Annuler n’écrit rien ; Enregistrer quand même écrit la décision', async () => {
    await seed();
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: /^Accepter/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(norm(dialog.textContent)).toContain('Elle passera devant la cible prévue à partir du lundi 16/11 (2 450 kcal)');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(await decisions()).toHaveLength(2);
    expect(within(r).getByRole('button', { name: /^Accepter/ })).toBeEnabled();
    fireEvent.click(within(r).getByRole('button', { name: /^Accepter/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Enregistrer quand même' }));
    expect(await within(r).findByText('Cible enregistrée.')).toBeInTheDocument();
    expect((await decisions())[0]).toMatchObject({ source: 'auto', accepted: true, weekStart: TODAY });
  });

  it('Refuser : pas de confirmation (une proposition refusée ne masque rien)', async () => {
    await seed();
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Refuser' }));
    expect(await within(r).findByText('Proposition refusée : ta cible actuelle est conservée.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('Personnaliser sous 1 200 kcal : la confirmation D-296 est demandée une seule fois pour la même saisie (revue 1, point 2)', async () => {
    await seed();
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Personnaliser' }));
    const fill = (label: string, value: string) => fireEvent.change(within(r).getByLabelText(label), { target: { value } });
    fill('Calories (kcal)', '1100');
    fill('Protéines (g)', '150');
    fill('Lipides (g)', '40');
    fill('Glucides (g)', '80');
    const save = within(r).getAllByRole('button').find((b) => b.getAttribute('type') === 'submit');
    if (save === undefined) throw new Error('submit');
    fireEvent.click(save);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Enregistrer quand même' }));
    fireEvent.click(await within(r).findByRole('checkbox', { name: 'Je confirme une cible sous 1 200 kcal' }));
    fireEvent.click(save);
    await waitFor(async () => expect(await decisions()).toHaveLength(3));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
