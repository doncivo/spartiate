import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { BodyGoal } from '../../domain/bodyProfile';
import type { DeviceId, LocalDate } from '../../domain/types';
import type { NutritionPrefs } from '../../domain/nutrition';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { NutritionScreen } from './NutritionScreen';
import { loadNutritionSnapshot, saveNutritionPrefs } from './useCases';

/** NUTRI-0299 (BL-173, D-669, C-106) : Stratégie lit l'objectif du profil (Réglages › Corps), en lecture seule ; le rythme reste en Stratégie. */
const DEVICE = '60000000-0000-4000-8000-0000000000e9' as DeviceId;
const PREFS: NutritionPrefs = { activity: null, style: 'collaborative', goal: { kind: 'maintain' }, checkInWeekday: 1 };
let db: TestDb;
const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition', screen: 'strategy' }));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
};
const region = () => screen.findByRole('region', { name: 'Nutrition' });
const setProfileGoal = async (goal: BodyGoal) => (await db.data.repos.profile()).save({ goal }, 2026);
const storedPrefs = async () => db.data.repos.settings.get('nutrition.prefs');

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.close();
});

describe('BL-173 : objectif lu du profil', () => {
  it('profil « perte » : Stratégie affiche « Perte » sans le proposer comme réglage, et un seul réglage « Rythme »', async () => {
    await setProfileGoal('loss');
    open();
    const r = await region();
    const goal = await within(r).findByText('Objectif du profil : Perte');
    expect(goal).toBeInTheDocument();
    expect(within(r).queryByRole('button', { name: /^Objectif :/ })).toBeNull();
    expect(within(r).queryByRole('radio', { name: 'Perte' })).toBeNull();
    expect(within(r).queryByRole('radio', { name: 'Prise' })).toBeNull();
    expect(within(r).getByRole('button', { name: 'Rythme : 0,25 kg / semaine' })).toBeInTheDocument();
  });

  it('le rythme se règle en Stratégie et s’enregistre avec la sorte du profil, sans autre champ', async () => {
    await setProfileGoal('loss');
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Rythme : 0,25 kg / semaine' }));
    fireEvent.change(within(r).getByLabelText('Vitesse visée (kg / semaine)'), { target: { value: '0,5' } });
    await waitFor(async () => expect(await storedPrefs()).toEqual({ ...PREFS, goal: { kind: 'loss', weeklyRateKg: 0.5 } }));
    expect(await within(r).findByRole('button', { name: 'Rythme : 0,5 kg / semaine' })).toBeInTheDocument();
  });

  it('profil « maintien » : pas de rythme, même si un rythme de perte reste dans les préférences', async () => {
    await setProfileGoal('maintain');
    await saveNutritionPrefs(db.data, { ...PREFS, goal: { kind: 'loss', weeklyRateKg: 0.4 } });
    open();
    const r = await region();
    expect(await within(r).findByText('Objectif du profil : Maintien')).toBeInTheDocument();
    expect(within(r).queryByRole('button', { name: /^Rythme/ })).toBeNull();
  });

  it('profil sans objectif : l’ancien choix est gardé et dit, avec le renvoi vers Réglages › Corps', async () => {
    await saveNutritionPrefs(db.data, { ...PREFS, goal: { kind: 'gain', weeklyRateKg: 0.3 } });
    open();
    const r = await region();
    expect(await within(r).findByText('Objectif du profil : non renseigné, « Prise » gardé')).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: 'Rythme : 0,3 kg / semaine' })).toBeInTheDocument();
    fireEvent.click(within(r).getByRole('button', { name: 'Modifier dans Réglages › Corps' }));
    expect(useNavigationStore.getState().route).toMatchObject({ tab: 'more', screen: 'body' });
  });

  it('le check-in reçoit le même objectif que Stratégie (snapshot) : profil « prise », préférences au maintien', async () => {
    await setProfileGoal('gain');
    const snapshot = await loadNutritionSnapshot(db.data, '2026-11-09' as LocalDate);
    expect(snapshot.goal).toEqual({ kind: 'gain', weeklyRateKg: 0.25 });
    expect(snapshot.prefs.goal).toEqual({ kind: 'maintain' });
  });
});
