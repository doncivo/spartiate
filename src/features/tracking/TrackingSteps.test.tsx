import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tTracking } from '../../i18n/trackingText';
import { TrackingProgress } from './TrackingProgress';
import { TrackingTodayCard } from './TrackingTodayCard';
import { DEVICE, mountWith, NOW, seedSteps } from './testKit';

/** SUIVIS-029a : objectif de pas sur Aujourd'hui et moyenne hebdomadaire dans Progrès › Suivis. */
let db: TestDb;
const fr = (n: number): string => n.toLocaleString('fr-FR');

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Aujourd’hui : objectif de pas', () => {
  it('iPhone, total du jour : « 6 500 / 8 000 pas (81 %) » et une barre doublée du texte', async () => {
    await seedSteps(db, [['2026-11-20', 9000], ['2026-11-21', 6500]]);
    mountWith(db, <TrackingTodayCard />);
    const card = await screen.findByRole('region', { name: tTracking('todayTitle') });
    expect(await within(card).findByText(tTracking('stepsProgress', { steps: fr(6500), goal: fr(8000), percent: 81 }))).toBeInTheDocument();
    const bar = within(card).getByRole('progressbar', { name: tTracking('stepsGoalTitle') });
    expect(bar).toHaveAttribute('aria-valuenow', '81');
    expect(within(card).queryByText(tTracking('stepsReached'))).toBeNull();
  });

  it('objectif réglé et atteint : le dit', async () => {
    await db.data.repos.settings.set('tracking.goals', { v: 1, stepsDaily: 6000, zone2WeeklyMin: 150, hrMax: null });
    await seedSteps(db, [['2026-11-21', 6500]]);
    mountWith(db, <TrackingTodayCard />);
    expect(await screen.findByText(tTracking('stepsReached'))).toBeInTheDocument();
    expect(screen.getByText(tTracking('stepsProgress', { steps: fr(6500), goal: fr(6000), percent: 108 }))).toBeInTheDocument();
  });

  it('pas.csv jamais lu (absent ou illisible) : « — » et la raison, aucun 0', async () => {
    mountWith(db, <TrackingTodayCard />);
    const reason = await screen.findByText(tTracking('stepsReason_never_read'));
    const block = reason.closest('[data-steps]');
    expect(block).not.toBeNull();
    expect(block?.textContent ?? '').toContain(tTracking('missing'));
    expect(block?.textContent ?? '').not.toMatch(/\b0\b/);
  });

  it('fichier lu sans total aujourd’hui : la raison', async () => {
    await seedSteps(db, [['2026-11-20', 9000]]);
    mountWith(db, <TrackingTodayCard />);
    expect(await screen.findByText(tTracking('stepsReason_no_today'))).toBeInTheDocument();
  });

  it('PC : pas locaux à l’iPhone, la raison, aucune valeur', async () => {
    await seedSteps(db, [['2026-11-21', 6500]]);
    mountWith(db, <TrackingTodayCard />, 'other');
    expect(await screen.findByText(tTracking('stepsReason_on_pc'))).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('Progrès › Suivis : objectif et moyenne hebdomadaire', () => {
  it('moyennes des 4 semaines (jours connus, jours à l’objectif) ; semaine sans pas : « — »', async () => {
    await seedSteps(db, [['2026-11-16', 10000], ['2026-11-17', 6000], ['2026-11-21', 8000]]);
    mountWith(db, <TrackingProgress />);
    const steps = await screen.findByRole('region', { name: tTracking('stepsWeeksTitle') });
    expect(await within(steps).findByText(tTracking('stepsWeekLine', { avg: fr(8000), n: 3, g: 2 }))).toBeInTheDocument();
    expect(within(steps).getAllByText(tTracking('missing')).length).toBe(3);
  });

  it('régler l’objectif : enregistré dans le réglage local ; hors bornes : refusé avec la plage, rien d’écrit', async () => {
    mountWith(db, <TrackingProgress />);
    const input = await screen.findByLabelText(tTracking('goalSteps'));
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: tTracking('goalsSave') }));
    expect(await screen.findByText(tTracking('issue_range', { min: fr(1000), max: fr(50000) }))).toBeInTheDocument();
    expect(await db.data.repos.settings.get('tracking.goals')).toBeNull();
    fireEvent.change(input, { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: tTracking('goalsSave') }));
    expect(await screen.findByText(tTracking('goalsSaved'))).toBeInTheDocument();
    expect(await db.data.repos.settings.get('tracking.goals')).toEqual({ v: 1, stepsDaily: 10000, zone2WeeklyMin: 150, hrMax: null });
  });

  it('PC : la raison, aucune moyenne inventée', async () => {
    await seedSteps(db, [['2026-11-21', 8000]]);
    mountWith(db, <TrackingProgress />, 'other');
    const steps = await screen.findByRole('region', { name: tTracking('stepsWeeksTitle') });
    expect(await within(steps).findByText(tTracking('stepsReason_on_pc'))).toBeInTheDocument();
  });
});
