import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { tInjuries } from '../../../i18n/injuriesText';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { InjuriesSection } from './InjuriesSection';

vi.mock('../../../../content/exercises/muscles.json', () => {
  throw new Error('chargement impossible');
});

/** BLESSURES-a : le catalogue des muscles ne se charge pas : message dit, aucun rejet non géré. */
describe('Profil › Blessures : catalogue des muscles indisponible', () => {
  let db: TestDb;
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown): void => void unhandled.push(reason);
  beforeEach(async () => {
    process.on('unhandledRejection', onUnhandled);
    db = await openBaseDb('60000000-0000-4000-8000-0000000000c7' as DeviceId, '2026-11-20T08:00:00.000Z');
  });
  afterEach(async () => {
    process.off('unhandledRejection', onUnhandled);
    cleanup();
    await db.close();
  });
  it('dit que la liste des muscles est indisponible, les mouvements restent utilisables', async () => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: '60000000-0000-4000-8000-0000000000c7' as DeviceId }), data: db.data });
    render(
      <AppContainerProvider container={container}>
        <InjuriesSection />
      </AppContainerProvider>,
    );
    expect((await screen.findByText(tInjuries('errorMuscles'))).getAttribute('role')).toBe('alert');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(unhandled).toEqual([]);
  });
});
