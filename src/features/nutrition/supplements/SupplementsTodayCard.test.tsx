import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { SupplementsTodayCard } from './SupplementsTodayCard';

/** I6-05 (critère 2) : carte « Compléments » d'Aujourd'hui, prises du jour cochées en un tap ; aucune prise due : pas de carte. */
const DEVICE = '60000000-0000-4000-8000-0000000000d7' as DeviceId;
const TODAY = '2026-11-13' as LocalDate; // vendredi
let db: TestDb;
const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <SupplementsTodayCard />
    </AppContainerProvider>,
  );
const create = async (over: Partial<{ name: string; dose: number | null; unit: string | null; times: LocalTime[]; days: number; active: boolean }> = {}) =>
  (await db.data.repos.supplements()).create({ name: 'Créatine', dose: 5, unit: 'g', times: ['08:00' as LocalTime], days: 127, active: true, ...over });

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-13T06:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('I6-05 : SupplementsTodayCard', () => {
  it('aucune prise due aujourd’hui (en pause, jour non prévu) : rien n’est affiché', async () => {
    await create({ active: false });
    await create({ name: 'Zinc', days: 1 });
    // Lecture terminée connue sans minuterie : le dépôt est enveloppé et signale la fin de `intakes`.
    let loaded!: () => void;
    const done = new Promise<void>((resolve) => (loaded = resolve));
    const base = db.data.repos.supplements;
    const data = {
      ...db.data,
      repos: {
        ...db.data.repos,
        supplements: async () => {
          const repo = await base();
          return { ...repo, intakes: async (from: LocalDate, to: LocalDate) => repo.intakes(from, to).finally(() => queueMicrotask(loaded)) };
        },
      },
    };
    const { container } = render(
      <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data })}>
        <SupplementsTodayCard />
      </AppContainerProvider>,
    );
    await act(async () => done);
    expect(container.textContent).toBe('');
  });

  it('prises du jour triées par heure, cochées en un tap, état gardé en base ; décocher aussi', async () => {
    const a = await create({ times: ['20:00' as LocalTime, '08:00' as LocalTime] });
    await create({ name: 'Vitamine D', dose: null, unit: null, times: ['08:00' as LocalTime] });
    mount();
    expect(await screen.findByRole('heading', { name: 'Compléments' })).toBeInTheDocument();
    expect(screen.getByText('0 sur 3 prises')).toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['08:00 · Créatine, 5 g', '08:00 · Vitamine D', '20:00 · Créatine, 5 g']);
    fireEvent.click(boxes[0] as HTMLElement);
    await waitFor(() => expect(screen.getByText('1 sur 3 prises')).toBeInTheDocument());
    expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'true');
    expect(await (await db.data.repos.supplements()).intakes(TODAY, TODAY)).toEqual([{ supplementId: a.id, date: TODAY, moment: '08:00' }]);
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    await waitFor(() => expect(screen.getByText('0 sur 3 prises')).toBeInTheDocument());
    expect(await (await db.data.repos.supplements()).intakes(TODAY, TODAY)).toEqual([]);
  });

  it('« Gérer » mène à la section Compléments de Nutrition', async () => {
    await create();
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Gérer les compléments' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'nutrition', screen: 'supplements' });
  });
});
