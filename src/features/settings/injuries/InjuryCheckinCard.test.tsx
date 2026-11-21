import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import { declareInjury, parseInjuries, type InjuriesValue } from '../../../domain/training/injuries';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { tInjuries } from '../../../i18n/injuriesText';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { InjuryCheckinCard } from './InjuryCheckinCard';

const DEVICE = '60000000-0000-4000-8000-0000000000c5' as DeviceId;

describe('Carte « Où en est ta gêne ? » (BLESSURES-b)', () => {
  let db: TestDb;
  const seed = async (startedOn: string): Promise<void> => {
    const r = declareInjury({ v: 1, items: [] }, { id: 'g1', muscleId: 'chest', patterns: [], startedOn: startedOn as LocalDate, note: null }, '2026-11-20' as LocalDate);
    if (!r.ok) throw new Error(r.issue);
    await db.data.repos.settings.set('training.injuries', r.value);
  };
  const stored = async (): Promise<InjuriesValue> => parseInjuries(await db.data.repos.settings.get('training.injuries'));
  const open = () => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    return render(
      <AppContainerProvider container={container}>
        <InjuryCheckinCard />
      </AppContainerProvider>,
    );
  };

  beforeEach(async () => {
    db = await openBaseDb(DEVICE, '2026-11-20T08:00:00.000Z');
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it("rien avant l'échéance (13 jours) ni sans gêne", async () => {
    await seed('2026-11-07');
    const { container } = open();
    await waitFor(() => expect(db.data.repos.settings.get('training.injuries')).resolves.toBeTruthy());
    expect(container.textContent).toBe('');
  });

  it("à 14 jours : quatre réponses ; « Pareil » est tracée et la carte disparaît, la gêne reste active", async () => {
    await seed('2026-11-06');
    open();
    expect(await screen.findByText(tInjuries('checkinTitle'))).toBeTruthy();
    for (const key of ['answerBetter', 'answerSame', 'answerWorse', 'answerHealed'] as const) expect(screen.getByRole('button', { name: tInjuries(key) })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: tInjuries('answerSame') }));
    await waitFor(async () => expect((await stored()).items[0]?.checkins).toEqual([{ on: '2026-11-20', answer: 'same' }]));
    expect((await stored()).items[0]?.status).toBe('active');
    await waitFor(() => expect(screen.queryByText(tInjuries('checkinTitle'))).toBeNull());
  });

  it('« Guérie » clôt la gêne ; « Pire » reste prudent (avis professionnel), sans clore', async () => {
    await seed('2026-11-06');
    open();
    fireEvent.click(await screen.findByRole('button', { name: tInjuries('answerWorse') }));
    expect(await screen.findByText(tInjuries('worseAdvice'))).toBeTruthy();
    expect((await stored()).items[0]?.status).toBe('active');
  });

  it('« Guérie » clôt la gêne', async () => {
    await seed('2026-11-06');
    open();
    fireEvent.click(await screen.findByRole('button', { name: tInjuries('answerHealed') }));
    await waitFor(async () => expect((await stored()).items[0]?.status).toBe('healed'));
  });
});
