import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { logFailure } from '../../../platform/desktop/log';
import { SupplementsTodayCard } from './SupplementsTodayCard';

vi.mock('../../../platform/desktop/log', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), logFailure: vi.fn() }));

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

  describe('prise cochée depuis la notification non enregistrée (FIX-0242)', () => {
    const KEY = 'notifications.actionTrouble' as 'notifications.status';
    const text = 'Une prise cochée depuis la notification n’a pas pu être enregistrée. Coche-la ici.';
    const lostText = 'Une action « Pris » de la notification n’a pas pu être lue. Vérifie tes prises ici.';
    const put = (value: { failed: boolean; days: string[]; lost: boolean }) => db.data.repos.settings.set(KEY, { v: 1, ...value } as never);

    it('état durable présent : message visible (role=alert), toujours là après un redémarrage simulé (nouveau montage, même base)', async () => {
      await create();
      await put({ failed: true, days: [TODAY], lost: false });
      const first = mount();
      expect(await screen.findByRole('alert')).toHaveTextContent(text);
      first.unmount();
      mount();
      expect(await screen.findByRole('alert')).toHaveTextContent(text);
    });

    it('perte : message dédié', async () => {
      await create();
      await put({ failed: false, days: [], lost: true });
      mount();
      expect(await screen.findByRole('alert')).toHaveTextContent(lostText);
    });

    it('prise cochée à la main : message effacé, et il le reste après un nouveau montage', async () => {
      await create();
      await put({ failed: true, days: [TODAY], lost: true });
      const first = mount();
      expect(await screen.findAllByRole('alert')).toHaveLength(2);
      fireEvent.click(screen.getByRole('checkbox'));
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
      first.unmount();
      mount();
      await screen.findByRole('checkbox');
      expect(screen.queryByRole('alert')).toBeNull();
      expect((await db.data.repos.settings.get(KEY)) as unknown).toMatchObject({ failed: false, lost: false });
    });

    it('bouton « Compris » : accusé de réception explicite, efface tout l’état durable (même sans prise à cocher), durablement', async () => {
      await create();
      await put({ failed: true, days: [TODAY], lost: true });
      const first = mount();
      expect(await screen.findAllByRole('alert')).toHaveLength(2);
      fireEvent.click(screen.getByRole('button', { name: 'Compris' }));
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
      expect(screen.queryByRole('button', { name: 'Compris' })).toBeNull();
      first.unmount();
      mount();
      await screen.findByRole('checkbox');
      expect(screen.queryByRole('alert')).toBeNull();
      expect((await db.data.repos.settings.get(KEY)) as unknown).toMatchObject({ failed: false, days: [], lost: false });
    });

    const mountWithSettings = (over: { get?: () => Promise<never>; set?: (key: string, value: unknown) => Promise<void>; transaction?: typeof db.data.transaction }) => {
      const { transaction, ...settingsOver } = over;
      const settings = { ...db.data.repos.settings, ...settingsOver } as typeof db.data.repos.settings;
      const data = { ...db.data, ...(transaction ? { transaction } : {}), repos: { ...db.data.repos, settings } };
      return render(
        <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data })}>
          <SupplementsTodayCard />
        </AppContainerProvider>,
      );
    };

    it('lecture de l’état impossible : journalisée (jamais avalée)', async () => {
      await create();
      vi.mocked(logFailure).mockClear();
      mountWithSettings({ get: () => Promise.reject(new Error('disk')) });
      await screen.findByRole('checkbox');
      await waitFor(() => expect(logFailure).toHaveBeenCalledWith('supplements', expect.any(String)));
    });

    it('« Compris » qui ne peut pas écrire : message visible sur la carte, journal, état toujours affiché', async () => {
      await create();
      await put({ failed: true, days: [TODAY], lost: false });
      vi.mocked(logFailure).mockClear();
      mountWithSettings({ transaction: () => Promise.reject(new Error('disk')) });
      await screen.findByText(text);
      fireEvent.click(screen.getByRole('button', { name: 'Compris' }));
      expect(await screen.findByText('Impossible d’effacer ce message. Réessaie.')).toBeInTheDocument();
      expect(screen.getByText(text)).toBeInTheDocument();
      expect(logFailure).toHaveBeenCalledWith('supplements', expect.any(String));
    });

    it('prise cochée sans état à effacer : aucune écriture de l’état durable', async () => {
      await create();
      const writes: string[] = [];
      let settled = 0;
      mountWithSettings({
        transaction: (work) =>
          db.data
            .transaction((repos) => work({ ...repos, settings: { ...repos.settings, set: (key, value) => (writes.push(key), repos.settings.set(key, value)) } }))
            .finally(() => {
              settled += 1;
            }),
      });
      fireEvent.click(await screen.findByRole('checkbox'));
      // Signal sûr, sans délai : la transaction de levée de l'état (lecture seule ici) est terminée.
      await waitFor(() => expect(settled).toBe(1));
      expect(writes).not.toContain(KEY);
    });

    it('aucun état : aucun message', async () => {
      await create();
      mount();
      await screen.findByRole('checkbox');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
