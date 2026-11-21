import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';

/**
 * FIX-0272 (SupplementsView.tsx:127) : l'effet des rappels ne se poursuit jamais après le démontage — ni replanification sur une base
 * fermée, ni rejet non intercepté, ni échec journalisé pour une vue qui n'existe plus. Module des notifications simulé : la lecture des
 * préférences se résout (ou échoue) APRÈS le démontage.
 * TESTS-FIGES (C-171) : `release` et `fail` valent `null` tant que la lecture n'a pas démarré ; chaque test attend leur affectation
 * (avant, le test passait même sans la garde) ; cas du rejet après démontage ajouté.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e7' as DeviceId;
const replan = vi.fn(() => Promise.resolve({ status: 'scheduled' }));
const logFailure = vi.fn();
let release: (() => void) | null = null;
let fail: (() => void) | null = null;
vi.mock('../../../platform/desktop/log', async (importOriginal) => ({ ...(await importOriginal<object>()), logFailure: (...args: unknown[]) => logFailure(...args) }));
vi.mock('../../notifications', () => ({
  supplementNotificationsFor: () => ({
    readPrefs: () =>
      new Promise((resolve, reject) => {
        release = () => resolve({ enabled: true });
        fail = () => reject(new Error('lecture impossible'));
      }),
    replan,
  }),
}));

let db: TestDb;
beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-13T06:00:00.000Z');
  replan.mockClear();
  logFailure.mockClear();
  release = null;
  fail = null;
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function mountAndWaitForRead(): Promise<{ unmount: () => void }> {
  const { SupplementsView } = await import('./SupplementsView');
  const view = render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <SupplementsView today={'2026-11-13' as LocalDate} />
    </AppContainerProvider>,
  );
  await vi.waitFor(() => {
    expect(release).not.toBeNull();
    expect(fail).not.toBeNull();
  });
  return view;
}

describe('SupplementsView : démontage', () => {
  it('démontée avant la fin de la lecture des préférences : aucune replanification', async () => {
    const view = await mountAndWaitForRead();
    view.unmount();
    release?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(replan).not.toHaveBeenCalled();
  });

  it('lecture des préférences rejetée après le démontage : aucun rejet perdu, aucun échec journalisé', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const view = await mountAndWaitForRead();
      view.unmount();
      fail?.();
      await new Promise((r) => setTimeout(r, 10));
      expect(unhandled).not.toHaveBeenCalled();
      expect(logFailure).not.toHaveBeenCalled();
      expect(replan).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('lecture rejetée vue montée : l’échec est journalisé une fois, sans replanification', async () => {
    await mountAndWaitForRead();
    fail?.();
    await vi.waitFor(() => expect(logFailure).toHaveBeenCalledWith('supplements', 'reminders-replan-failed'));
    expect(logFailure).toHaveBeenCalledTimes(1);
    expect(replan).not.toHaveBeenCalled();
  });
});
