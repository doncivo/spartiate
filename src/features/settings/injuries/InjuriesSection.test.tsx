import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import { parseInjuries } from '../../../domain/training/injuries';
import type { DeviceId } from '../../../domain/types';
import { tInjuries } from '../../../i18n/injuriesText';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { InjuriesSection } from './InjuriesSection';

const DEVICE = '60000000-0000-4000-8000-0000000000c4' as DeviceId;

describe('Profil › Blessures (BLESSURES-a)', () => {
  let db: TestDb;
  const open = () => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    return render(
      <AppContainerProvider container={container}>
        <InjuriesSection />
      </AppContainerProvider>,
    );
  };
  const stored = async () => parseInjuries(await db.data.repos.settings.get('training.injuries'));

  beforeEach(async () => {
    db = await openBaseDb(DEVICE, '2026-11-20T08:00:00.000Z');
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it('dit sans promesse ce que fait la déclaration, et rien à lister au départ', async () => {
    open();
    expect(await screen.findByText(tInjuries('notice'))).toBeTruthy();
    expect(screen.getByText(tInjuries('empty'))).toBeTruthy();
  });

  it('déclare une gêne (muscle, pattern, note), la liste active et la persiste en réglage local', async () => {
    open();
    fireEvent.change(await screen.findByLabelText(tInjuries('muscle')), { target: { value: 'chest' } });
    fireEvent.click(screen.getByRole('button', { name: tInjuries('painToggle', { pattern: 'Poussée verticale' }) }));
    fireEvent.change(screen.getByLabelText(tInjuries('note')), { target: { value: 'pectoral gauche' } });
    fireEvent.click(screen.getByRole('button', { name: tInjuries('save') }));
    await waitFor(async () => expect((await stored()).items).toHaveLength(1));
    const item = (await stored()).items[0];
    expect(item).toMatchObject({ muscleId: 'chest', patterns: ['push-vertical'], note: 'pectoral gauche', status: 'active', startedOn: '2026-11-20' });
    expect(await screen.findByText('pectoral gauche', { exact: false })).toBeTruthy();
  });

  it('refuse une déclaration sans muscle ni pattern, avec un message', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: tInjuries('save') }));
    expect((await screen.findByRole('alert')).textContent).toBe(tInjuries('errorTarget'));
    expect((await stored()).items).toEqual([]);
  });

  it('marque une gêne guérie : elle passe dans les gênes passées', async () => {
    open();
    fireEvent.change(await screen.findByLabelText(tInjuries('muscle')), { target: { value: 'chest' } });
    fireEvent.click(screen.getByRole('button', { name: tInjuries('save') }));
    const active = await screen.findByRole('list', { name: tInjuries('activeTitle') });
    fireEvent.click(within(active).getByRole('button', { name: tInjuries('markHealed') }));
    await waitFor(async () => expect((await stored()).items[0]?.status).toBe('healed'));
    expect(await screen.findByRole('list', { name: tInjuries('pastTitle') })).toBeTruthy();
  });
});
