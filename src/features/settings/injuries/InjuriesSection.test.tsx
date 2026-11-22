import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { tInjuries } from '../../../i18n/injuriesText';
import { tTraining } from '../../../i18n/trainingText';
import { PATTERN_KEY } from '../../training/labels';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { declareInjury } from '../../../domain/training/injuries';
import type { LocalDate } from '../../../domain/types';
import { announceLocalChanges } from '../../sync/remoteChanges';
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
  /** Le catalogue des muscles se charge à la demande : attendre ses options. */
  const muscleSelect = async (): Promise<HTMLElement> => {
    const select = await screen.findByLabelText(tInjuries('muscle'));
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));
    return select;
  };
  // SYNC-0291 (D-447) : gênes dans la table publiée `injury`, plus dans le réglage local.
  const stored = async () => (await db.data.repos.injuries()).read();

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

  it('déclare une gêne (muscle, pattern, note), la liste active et la persiste dans la table publiée', async () => {
    open();
    fireEvent.change(await muscleSelect(), { target: { value: 'chest' } });
    fireEvent.click(screen.getByRole('button', { name: tInjuries('painToggle', { pattern: tTraining(PATTERN_KEY['push-vertical']) }) }));
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
    fireEvent.change(await muscleSelect(), { target: { value: 'chest' } });
    fireEvent.click(screen.getByRole('button', { name: tInjuries('save') }));
    const active = await screen.findByRole('list', { name: tInjuries('activeTitle') });
    fireEvent.click(within(active).getByRole('button', { name: tInjuries('markHealed') }));
    await waitFor(async () => expect((await stored()).items[0]?.status).toBe('healed'));
    expect(await screen.findByRole('list', { name: tInjuries('pastTitle') })).toBeTruthy();
  });

  it('date de début effacée : message « date requise », pas « dans le futur »', async () => {
    open();
    fireEvent.change(await muscleSelect(), { target: { value: 'chest' } });
    fireEvent.change(screen.getByLabelText(tInjuries('startedOn')), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: tInjuries('save') }));
    expect((await screen.findByRole('alert')).textContent).toBe(tInjuries('errorDateRequired'));
    expect((await stored()).items).toEqual([]);
  });

  it('relecture 1, point 1 : la section se relit quand un lot de « injury » est appliqué (gêne déclarée ailleurs : listée)', async () => {
    open();
    expect(await screen.findByText(tInjuries('empty'))).toBeTruthy();
    const r = declareInjury({ v: 1, items: [] }, { id: '20000000-0000-4000-8000-0000000000a1', muscleId: null, patterns: ['squat'], startedOn: '2026-11-19' as LocalDate, note: 'reçue de l’autre appareil' }, '2026-11-20' as LocalDate);
    if (!r.ok) throw new Error(r.issue);
    await (await db.data.repos.injuries()).save(r.value.items[0] as never);
    announceLocalChanges(['injury']);
    expect(await screen.findByText('reçue de l’autre appareil', { exact: false })).toBeTruthy();
  });
});
