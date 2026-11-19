import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';

/**
 * FIX-0272 (SupplementsView.tsx:127) : l'effet des rappels ne se poursuit jamais après le démontage — ni replanification sur une base
 * fermée, ni rejet non intercepté. Module des notifications simulé : la lecture des préférences se résout APRÈS le démontage.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e7' as DeviceId;
const replan = vi.fn(() => Promise.resolve({ status: 'scheduled' }));
let release: () => void = () => undefined;
vi.mock('../../notifications', () => ({
  supplementNotificationsFor: () => ({
    readPrefs: () =>
      new Promise((resolve) => {
        release = () => resolve({ enabled: true });
      }),
    replan,
  }),
}));

let db: TestDb;
beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-13T06:00:00.000Z');
  replan.mockClear();
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('SupplementsView : démontage', () => {
  it('démontée avant la fin de la lecture des préférences : aucune replanification', async () => {
    const { SupplementsView } = await import('./SupplementsView');
    const view = render(
      <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
        <SupplementsView today={'2026-11-13' as LocalDate} />
      </AppContainerProvider>,
    );
    await vi.waitFor(() => expect(release).not.toBe(undefined));
    await new Promise((r) => setTimeout(r, 0));
    view.unmount();
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(replan).not.toHaveBeenCalled();
  });
});
