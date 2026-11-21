import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tTracking } from '../../i18n/trackingText';
import { TrackingProgress } from './TrackingProgress';
import { TrackingTodayCard } from './TrackingTodayCard';
import { DEVICE, mountWith, NOW } from './testKit';

/** SUIVIS-029 (relecture à froid) : une lecture qui échoue est dite (« Lecture impossible des suivis. », Réessayer), jamais un chargement sans fin. */
let db: TestDb;

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.close();
});

describe('échec de lecture des suivis', () => {
  it.each([
    ['Aujourd’hui', () => <TrackingTodayCard />, 'todayTitle', 'stepsGoalTitle'],
    ['Progrès', () => <TrackingProgress />, 'progressTitle', 'goalsTitle'],
  ] as const)('%s : objectifs illisibles → alerte et Réessayer, puis le contenu', async (_name, ui, title, content) => {
    const spy = vi.spyOn(db.data.repos.settings, 'get').mockRejectedValueOnce(new Error('boom'));
    mountWith(db, ui());
    const card = await screen.findByRole('region', { name: tTracking(title) });
    expect(await within(card).findByRole('alert')).toHaveTextContent(tTracking('loadFailed'));
    expect(within(card).queryByRole('status')).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: tTracking('retry') }));
    expect(await within(card).findByText(tTracking(content))).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });
});
