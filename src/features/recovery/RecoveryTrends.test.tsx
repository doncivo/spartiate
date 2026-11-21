import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { addDays } from '../../domain/localDate';
import type { RecoveryDaySummary } from '../../domain/recovery';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tRecoveryFactors } from '../../i18n/recoveryFactorsText';
import { tRecovery } from '../../i18n/recoveryText';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { RecoveryProgress } from './RecoveryProgress';
import { RecoveryToday } from './RecoveryToday';

/** PROGRES-c (§ 17.1 tendances 30 j, § 16.3 zone cible) : Progrès › Récupération et cadran Exertion d'Aujourd'hui. Fixtures synthétiques. */

const DEVICE = '60000000-0000-4000-8000-0000000000e3' as DeviceId;
const NOW = '2026-11-18T09:00:00.000Z';
const TODAY = '2026-11-18' as LocalDate;
let db: TestDb;

const summary = (day: string, patch: Partial<RecoveryDaySummary> = {}): RecoveryDaySummary => ({
  day,
  level: 'C',
  recovery: 70,
  abstainReason: null,
  quality: 'good',
  exertion: 3,
  exertionPrevDay: 0,
  sleepMinutes: 420,
  sleepNeedMinutes: 450,
  sleepScore: 93,
  bedtimeSigmaMinutes: 20,
  targetZone: { from: 6, to: 8 },
  hrvMs: 60,
  restingHr: 50,
  learningNights: 14,
  contributors: [],
  explanationKeys: [],
  computedAt: `${day}T07:00:00.000Z`,
  ...patch,
});
const save = async (s: RecoveryDaySummary) => (await db.data.repos.recovery()).saveDay({ summary: s, muscles: [] });
const mount = (node: ReactNode) =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } })}>
      {node}
    </AppContainerProvider>,
  );

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Progrès › Récupération : tendances sur 30 jours', () => {
  it('aucun résumé : « aucune mesure » dit, aucun graphique', async () => {
    mount(<RecoveryProgress />);
    const card = await screen.findByRole('region', { name: tRecoveryFactors('trendsTitle') });
    expect(within(card).getByText(tRecoveryFactors('trendsEmpty'))).toBeInTheDocument();
    expect(within(card).queryByRole('img')).toBeNull();
  });

  it('3 jours mesurés : une courbe par mesure, étiquette avec moyenne, min et max ; jours mesurés dits', async () => {
    await save(summary(addDays(TODAY, -2), { recovery: 60, hrvMs: 50, restingHr: 52, sleepMinutes: 400 }));
    await save(summary(addDays(TODAY, -1), { recovery: 70, hrvMs: 60, restingHr: 50, sleepMinutes: 420 }));
    await save(summary(TODAY, { recovery: 80, hrvMs: 70, restingHr: 48, sleepMinutes: null }));
    mount(<RecoveryProgress />);
    const card = await screen.findByRole('region', { name: tRecoveryFactors('trendsTitle') });
    const recovery = within(card).getByRole('img', { name: tRecoveryFactors('trendLine', { metric: tRecoveryFactors('trend_recovery'), mean30: '70', mean7: '70', min: '60', max: '80' }) });
    expect(recovery).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: tRecoveryFactors('trendLine', { metric: tRecoveryFactors('trend_hrv'), mean30: tRecoveryFactors('unitMs', { v: 60 }), mean7: tRecoveryFactors('unitMs', { v: 60 }), min: tRecoveryFactors('unitMs', { v: 50 }), max: tRecoveryFactors('unitMs', { v: 70 }) }) })).toBeInTheDocument();
    expect(within(card).getAllByText(tRecoveryFactors('trendMeasured', { n: 3 }))).toHaveLength(3);
    expect(within(card).getByText(tRecoveryFactors('trendMeasured', { n: 2 }))).toBeInTheDocument();
  });
});

describe('Aujourd’hui › Exertion : zone cible (§ 16.3)', () => {
  it('Recovery 70 : zone 6 à 8 et son sens en texte', async () => {
    await save(summary(TODAY));
    mount(<RecoveryToday />);
    expect(await screen.findByText(tRecovery('targetZone', { from: 6, to: 8 }))).toBeInTheDocument();
    expect(screen.getByText(tRecovery('zoneHigh'))).toBeInTheDocument();
  });

  it('Recovery 30 : zone 0 à 3, effort léger ; Recovery absente : aucune zone', async () => {
    await save(summary(TODAY, { recovery: 30, targetZone: { from: 0, to: 3 } }));
    mount(<RecoveryToday />);
    expect(await screen.findByText(tRecovery('targetZone', { from: 0, to: 3 }))).toBeInTheDocument();
    expect(screen.getByText(tRecovery('zoneLow'))).toBeInTheDocument();
    cleanup();
    await save(summary(TODAY, { recovery: null, abstainReason: 'baseline_incomplete', targetZone: null }));
    mount(<RecoveryToday />);
    await screen.findByText(tRecovery('exertionLabel'));
    expect(screen.queryByText(tRecovery('zoneHigh'))).toBeNull();
    expect(screen.queryByText(tRecovery('zoneLow'))).toBeNull();
  });
});
