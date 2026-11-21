import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tNutrition } from '../../../i18n/nutritionText';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { NutritionScreen } from '../NutritionScreen';
import { quickAddDraft } from '../useCases';

/** COQUILLE-PC-a (§ 18.1, C-192) : clic droit et double-clic sur une entrée du journal (jsdom : mise en page PC, 1 024 px). */
const DEVICE = '60000000-0000-4000-8000-0000000000f1' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
let db: TestDb;

const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition' } as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
};

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
  await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: '08:00' as LocalTime, name: 'Petit-déjeuner', kcal: 400, proteinG: 20, fatG: 10, carbG: 50 }));
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('journal : menu contextuel d’une entrée', () => {
  it('clic droit : Corriger et Supprimer, les mêmes actions que les boutons de la ligne', async () => {
    open();
    const entry = (await screen.findByText('Petit-déjeuner')).closest('li');
    if (!entry) throw new Error('ligne introuvable');
    fireEvent.contextMenu(entry);
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([tNutrition('edit'), tNutrition('delete')]);
    fireEvent.click(within(menu).getByRole('menuitem', { name: tNutrition('delete') }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('double-clic : ouvre la correction de l’entrée', async () => {
    open();
    const entry = (await screen.findByText('Petit-déjeuner')).closest('li');
    if (!entry) throw new Error('ligne introuvable');
    fireEvent.doubleClick(entry);
    await waitFor(() => expect(screen.getByLabelText(tNutrition('kcalLabel'))).toHaveValue('400'));
  });
});
