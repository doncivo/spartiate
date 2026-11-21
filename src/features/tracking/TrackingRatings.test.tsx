import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tTracking } from '../../i18n/trackingText';
import { TrackingProgress } from './TrackingProgress';
import { TrackingTodayCard } from './TrackingTodayCard';
import { DEVICE, mountWith, NOW, TODAY } from './testKit';

/** SUIVIS-029c : notes du matin sur Aujourd'hui (un geste, facultatif, modifiable le jour même) et courbes dans Progrès › Suivis. */
let db: TestDb;
const fatigue = tTracking('rating_note_fatigue');
const sleep = tTracking('rating_note_sleep');
const stored = async (kind: 'note_fatigue' | 'note_sleep') => (await db.data.repos.measurements()).find(TODAY as LocalDate, kind);

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Aujourd’hui : notes du matin', () => {
  it('dix boutons nommés par note ; un geste enregistre la note du jour ; un autre la remplace ; Effacer la retire', async () => {
    mountWith(db, <TrackingTodayCard />);
    const group = await screen.findByRole('group', { name: fatigue });
    expect(within(group).getAllByRole('button', { pressed: false })).toHaveLength(10);
    fireEvent.click(within(group).getByRole('button', { name: tTracking('ratingButton', { label: fatigue, n: 7 }) }));
    await waitFor(async () => expect((await stored('note_fatigue'))?.value).toBe(7));
    expect(await within(group).findByRole('button', { name: tTracking('ratingButton', { label: fatigue, n: 7 }), pressed: true })).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('button', { name: tTracking('ratingButton', { label: fatigue, n: 3 }) }));
    await waitFor(async () => expect((await stored('note_fatigue'))?.value).toBe(3));
    expect(await stored('note_sleep')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: tTracking('ratingClearLabel', { label: fatigue }) }));
    await waitFor(async () => expect((await stored('note_fatigue'))?.deletedAt).not.toBeNull());
  });

  it('note déjà saisie aujourd’hui : montrée pressée ; jamais bloquant (le reste de la carte est là sans note)', async () => {
    await (await db.data.repos.measurements()).save(TODAY as LocalDate, 'note_sleep', 8);
    mountWith(db, <TrackingTodayCard />);
    const group = await screen.findByRole('group', { name: sleep });
    expect(await within(group).findByRole('button', { name: tTracking('ratingButton', { label: sleep, n: 8 }), pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: fatigue })).toBeInTheDocument();
    expect(screen.getByText(tTracking('stepsGoalTitle'))).toBeInTheDocument();
  });

  it('une note d’hier n’est pas montrée comme celle d’aujourd’hui', async () => {
    await (await db.data.repos.measurements()).save('2026-11-20' as LocalDate, 'note_fatigue', 9);
    mountWith(db, <TrackingTodayCard />);
    const group = await screen.findByRole('group', { name: fatigue });
    await waitFor(() => expect(within(group).getAllByRole('button', { pressed: false })).toHaveLength(10));
  });
});

describe('Progrès › Suivis : courbes des notes', () => {
  it('deux courbes sur 30 jours avec moyenne et jours notés ; note absente : le dit', async () => {
    const m = await db.data.repos.measurements();
    await m.save('2026-11-19' as LocalDate, 'note_fatigue', 4);
    await m.save('2026-11-20' as LocalDate, 'note_fatigue', 6);
    await m.save('2026-11-21' as LocalDate, 'note_fatigue', 7);
    mountWith(db, <TrackingProgress />);
    const region = await screen.findByRole('region', { name: tTracking('ratingsProgressTitle') });
    const summary = tTracking('ratingsSummary', { label: fatigue, avg: '5,7', n: 3 });
    expect(await within(region).findByRole('img', { name: summary })).toBeInTheDocument();
    expect(within(region).getByText(summary)).toBeInTheDocument();
    expect(within(region).getByText(tTracking('ratingsNone', { label: sleep }))).toBeInTheDocument();
  });
});
