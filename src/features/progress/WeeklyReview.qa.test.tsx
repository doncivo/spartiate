import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { reviewWeekLabel, tWeeklyReview } from '../../i18n/weeklyReviewText';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { WeeklyReview, type WeeklyReviewProps } from './WeeklyReview';

/** BILAN-029, passe qa-test : export en échec dit, retour à la semaine passée, aucune écriture en base. Valeurs synthétiques. */

const DEVICE = '60000000-0000-4000-8000-0000000000ba' as DeviceId;
let db: TestDb;

const mount = (props: WeeklyReviewProps = {}) =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } })}>
      <WeeklyReview {...props} />
    </AppContainerProvider>,
  );

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-10-01T08:00:00.000Z');
  db.clock.set('2026-11-18T18:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('BILAN-029 qa : Progrès › Bilan de la semaine', () => {
  it('export en échec : le message le dit (jamais silencieux)', async () => {
    mount({ share: vi.fn(async () => Promise.reject(new Error('disque'))) });
    const card = await screen.findByRole('region', { name: tWeeklyReview('title') });
    fireEvent.click(await within(card).findByRole('button', { name: tWeeklyReview('export') }));
    expect(await within(card).findByText(tWeeklyReview('exportFailed'))).toBeInTheDocument();
  });

  it('semaine précédente choisie puis « Revenir à la semaine passée »', async () => {
    mount();
    const card = await screen.findByRole('region', { name: tWeeklyReview('title') });
    const older = reviewWeekLabel('2026-10-12' as LocalDate, '2026-10-18' as LocalDate);
    fireEvent.click(await within(card).findByRole('button', { name: older }));
    expect(within(card).getByRole('button', { name: older })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(card).getByRole('button', { name: tWeeklyReview('backToLatest') }));
    expect(within(card).getByText(reviewWeekLabel('2026-11-09' as LocalDate, '2026-11-15' as LocalDate), { selector: 'h3' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: tWeeklyReview('backToLatest') })).toBeNull();
  });

  it('lecture seule : aucune ligne écrite en file de synchro par l’affichage', async () => {
    const before = await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox');
    mount();
    await screen.findByRole('button', { name: tWeeklyReview('export') });
    const after = await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox');
    expect(after).toEqual(before);
  });
});
