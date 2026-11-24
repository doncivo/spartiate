import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { NutritionScreen } from './NutritionScreen';

/** C-104 : Stratégie : historique daté de la décision, préférences rendues si l'écriture échoue. */
const DEVICE = '60000000-0000-4000-8000-0000000000e4' as DeviceId;
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

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.close();
});

describe('C-104', () => {
  it('l’historique dit quand chaque décision a été prise', async () => {
    await (await db.data.repos.nutritionTargets()).record({ weekStart: '2026-11-16' as LocalDate, target: { kcal: 2350, proteinG: 180, fatG: 72, carbG: 240 }, source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: false });
    open();
    const r = await region();
    const history = await within(r).findByRole('heading', { name: 'Historique' });
    expect(history.parentElement?.textContent).toMatch(/décidée le 9 novembre/);
  });

  it('préférence dont l’écriture échoue : l’écran revient à la valeur enregistrée et le dit', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: /^Objectif/ }));
    const loss = await within(r).findByRole('radio', { name: 'Perte' });
    vi.spyOn(db.data.repos.settings, 'set').mockRejectedValue(new Error('boom'));
    fireEvent.click(loss);
    await waitFor(() => expect(within(r).getByRole('alert')).toBeInTheDocument());
    expect(within(r).getByRole('radio', { name: 'Maintien' })).toHaveAttribute('aria-checked', 'true');
    expect(within(r).getByRole('radio', { name: 'Perte' })).toHaveAttribute('aria-checked', 'false');
  });
});
