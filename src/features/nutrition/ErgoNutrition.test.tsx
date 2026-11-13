import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate, LocalTime } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { NutritionScreen } from './NutritionScreen';
import { quickAddDraft, saveManualTarget } from './useCases';

/** ERGO-01 (Journal-apres.dc.html, Dashboard-apres.dc.html) : calories restantes en chiffre héros, unité à part, sur le Journal et le Dashboard. */
const DEVICE = '60000000-0000-4000-8000-0000000000eb' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
let db: TestDb;
const fr = (n: number): string => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
const norm = (s: string | null | undefined): string => (s ?? '').replace(/[\u202f\u00a0]/g, ' ');
const open = (screenId: 'journal' | 'dashboard') => {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition', screen: screenId } as Route));
  return render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
};

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
  await saveManualTarget(db.data, { weekStart: '2026-11-08' as LocalDate, target: { kcal: 2000, proteinG: 150, fatG: 60, carbG: 200 }, lowFloorConfirmed: false });
  await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: '08:00' as LocalTime, name: 'Repas', kcal: 600, proteinG: 20, fatG: 10, carbG: 50 }));
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe.each(['journal', 'dashboard'] as const)('ERGO-01 : %s', (screenId) => {
  it('calories restantes : chiffre héros puis unité', async () => {
    open(screenId);
    const r = await screen.findByRole('region', { name: 'Nutrition' });
    const num = await within(r).findByText((_, el) => (el?.classList.contains('ct-hero__num') ?? false) && norm(el?.textContent) === fr(1400));
    expect(num.parentElement).toHaveClass('ct-hero');
    expect(num.nextElementSibling).toHaveClass('ct-hero__unit');
    expect(num.nextElementSibling).toHaveTextContent('kcal restantes');
  });
});
