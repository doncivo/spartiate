import { afterEach, describe, expect, it } from 'vitest';
import type { Proposal } from '../../domain/nutrition';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { loadDayTarget } from './dayType';
import { recordCheckInDecision, saveManualTarget } from './useCases';

/** PROG-01 (D-270 à D-272) : cible du jour selon son type, conservation de la cible de repos à chaque décision. Valeurs synthétiques. */
const DEVICE = '60000000-0000-4000-8000-0000000000d4' as DeviceId;
const TRAINING = { kcal: 2600, proteinG: 150, fatG: 80, carbG: 320 };
const REST = { kcal: 2400, proteinG: 150, fatG: 80, carbG: 270 };
const PLAN = { rest: REST, trainingDays: [1, 2, 4, 5, 6] as const };
let db: TestDb;
afterEach(async () => db.close());

// Mercredi 18 novembre 2026, 10:00 à Paris (jour de repos prévu).
const open = async () => (db = await openBaseDb(DEVICE, '2026-11-18T09:00:00.000Z'));
const withPlan = () => saveManualTarget(db.data, { weekStart: '2026-11-16' as LocalDate, target: TRAINING, lowFloorConfirmed: false, restPlan: { rest: REST, trainingDays: [...PLAN.trainingDays] } });

describe('PROG-01 : cible du jour (D-270)', () => {
  it('sans cible de repos : cible unique, aucun type de jour', async () => {
    await open();
    await saveManualTarget(db.data, { weekStart: '2026-11-16' as LocalDate, target: TRAINING, lowFloorConfirmed: false });
    expect(await loadDayTarget(db.data, '2026-11-18' as LocalDate)).toEqual({ type: null, target: TRAINING });
  });
  it('jour de repos prévu (mercredi) : cible de repos ; jour d’entraînement prévu (jeudi) : cible d’entraînement', async () => {
    await open();
    await withPlan();
    expect(await loadDayTarget(db.data, '2026-11-18' as LocalDate)).toEqual({ type: 'rest', target: REST });
    expect(await loadDayTarget(db.data, '2026-11-19' as LocalDate)).toEqual({ type: 'training', target: TRAINING });
  });
  it('séance de musculation close un jour de repos : jour d’entraînement', async () => {
    await open();
    await withPlan();
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: '7e2d1c3a-0000-4000-8000-0000000000d1', name: 'Séance' });
    await db.data.transaction(async (repos) => (await repos.workouts()).close('7e2d1c3a-0000-4000-8000-0000000000d1'));
    expect(await loadDayTarget(db.data, '2026-11-18' as LocalDate)).toEqual({ type: 'training', target: TRAINING });
  });
  it('aucune cible : null', async () => {
    await open();
    expect(await loadDayTarget(db.data, '2026-11-18' as LocalDate)).toBeNull();
  });
});

describe('PROG-01 : la cible de repos suit chaque décision (D-271, D-272)', () => {
  it('cible manuelle sans cible de repos : rien de stocké', async () => {
    await open();
    const saved = await saveManualTarget(db.data, { weekStart: '2026-11-16' as LocalDate, target: TRAINING, lowFloorConfirmed: false });
    expect(typeof saved !== 'string' && saved.restPlan).toBeNull();
  });
  it('check-in accepté : les deux nouvelles cibles enregistrées, jours d’entraînement gardés', async () => {
    await open();
    await withPlan();
    const proposal = {
      target: { kcal: 2700, proteinG: 150, fatG: 80, carbG: 345 },
      restTarget: { kcal: 2500, proteinG: 150, fatG: 80, carbG: 295 },
      previousTarget: TRAINING,
      deltaKcal: 100,
      initial: false,
      clampedBy: [],
      belowStandardFloor: false,
      options: ['accept', 'customize', 'refuse'],
      alternatives: [],
      applied: false,
      trace: { engineVersion: 1, tdee: 2643, desiredKcal: 2643, weeklyRateKg: 0, weightKg: 80 },
    } as Proposal;
    const restPlan = { rest: REST, trainingDays: [...PLAN.trainingDays] };
    const { record } = await recordCheckInDecision(db.data, { proposal, weekStart: '2026-11-23' as LocalDate, weightKg: 80, currentTarget: TRAINING, decision: { action: 'accept' }, lowFloorConfirmed: false, restPlan });
    expect(record?.restPlan).toEqual({ rest: { kcal: 2500, proteinG: 150, fatG: 80, carbG: 295 }, trainingDays: [1, 2, 4, 5, 6] });
  });
});
