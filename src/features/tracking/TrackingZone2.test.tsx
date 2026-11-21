import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CardioSessionInput } from '../../domain/cardio';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tTracking } from '../../i18n/trackingText';
import { TrackingProgress } from './TrackingProgress';
import { DEVICE, mountWith, NOW } from './testKit';

/** SUIVIS-029b : Progrès › Suivis, section Zone 2 (FC max et sa source, zone, minutes par semaine face à l'objectif). */
let db: TestDb;
const session = (startedAt: string, minutes: number, avgHr: number | null): CardioSessionInput => ({ kind: 'bike', startedAt, durationSec: minutes * 60, distanceM: null, avgHr, rpe: 5, notes: '', source: 'manual' });

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Progrès › Suivis : zone 2', () => {
  it('FC max par l’âge du profil, zone, minutes de la semaine face à l’objectif, séances sans FC dites', async () => {
    await (await db.data.repos.profile()).save({ birthYear: 1990 }, 2026);
    const cardio = await db.data.repos.cardio();
    await cardio.add(session('2026-11-17T07:00:00.000Z', 45, 120));
    await cardio.add(session('2026-11-18T07:00:00.000Z', 30, 150));
    await cardio.add(session('2026-11-19T07:00:00.000Z', 20, null));
    mountWith(db, <TrackingProgress />);
    const zone = await screen.findByRole('region', { name: tTracking('zone2Title') });
    expect(await within(zone).findByText(tTracking('zone2HrMaxAge', { hr: 184, age: 36 }))).toBeInTheDocument();
    expect(within(zone).getByText(tTracking('zone2Range', { low: 110, high: 129 }))).toBeInTheDocument();
    expect(within(zone).getByText(tTracking('zone2WeekLine', { min: 45, goal: 150 }))).toBeInTheDocument();
    expect(within(zone).getByText(tTracking('zone2WithoutHr', { n: 1 }))).toBeInTheDocument();
  });

  it('FC max saisie : elle prime, la source le dit', async () => {
    await (await db.data.repos.profile()).save({ birthYear: 1990 }, 2026);
    await db.data.repos.settings.set('tracking.goals', { v: 1, stepsDaily: 8000, zone2WeeklyMin: 90, hrMax: 200 });
    await (await db.data.repos.cardio()).add(session('2026-11-17T07:00:00.000Z', 45, 125));
    mountWith(db, <TrackingProgress />);
    const zone = await screen.findByRole('region', { name: tTracking('zone2Title') });
    expect(await within(zone).findByText(tTracking('zone2HrMaxEntered', { hr: 200 }))).toBeInTheDocument();
    expect(within(zone).getByText(tTracking('zone2Range', { low: 120, high: 140 }))).toBeInTheDocument();
    expect(within(zone).getByText(tTracking('zone2WeekLine', { min: 45, goal: 90 }))).toBeInTheDocument();
  });

  it('sans FC max (ni saisie ni année de naissance) : « — » et la raison, aucune minute inventée', async () => {
    await (await db.data.repos.cardio()).add(session('2026-11-17T07:00:00.000Z', 45, 120));
    mountWith(db, <TrackingProgress />);
    const zone = await screen.findByRole('region', { name: tTracking('zone2Title') });
    expect(await within(zone).findByText(tTracking('zone2NoHrMax'))).toBeInTheDocument();
    expect(within(zone).getByText(tTracking('missing'))).toBeInTheDocument();
    expect(zone.textContent ?? '').not.toMatch(/\bmin\b/);
  });
});
