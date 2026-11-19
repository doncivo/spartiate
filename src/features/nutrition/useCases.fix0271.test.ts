import { afterEach, describe, expect, it } from 'vitest';
import type { DataAccess } from '../../db/repositories/dataAccess';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import type { DeviceId, LocalDate } from '../../domain/types';
import { saveRestPlan } from './useCases';

/** FIX-0271 revue (point 4) : `saveRestPlan` lit les cibles futures et écrit dans la MÊME transaction (critère 6). */
const DEVICE = '60000000-0000-4000-8000-0000000000f1' as DeviceId;
let db: TestDb;
afterEach(async () => db.close());

describe('saveRestPlan', () => {
  it('aucune lecture des cibles hors de la transaction : la décision et la recopie de la cible future sont écrites ensemble', async () => {
    db = await openBaseDb(DEVICE, '2026-11-09T10:00:00.000Z');
    const repo = await db.data.repos.nutritionTargets();
    const current = await repo.record({ weekStart: '2026-11-09' as LocalDate, target: { kcal: 2450, proteinG: 150, fatG: 70, carbG: 250 }, source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: false });
    db.clock.advance(1_000);
    await repo.record({ weekStart: '2026-11-16' as LocalDate, target: { kcal: 2300, proteinG: 150, fatG: 70, carbG: 220 }, source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: false });
    db.clock.advance(1_000);
    const outside = new Proxy(db.data.repos, {
      get: (target, key, receiver) => (key === 'nutritionTargets' ? () => Promise.reject(new Error('lecture hors transaction')) : Reflect.get(target, key, receiver)),
    });
    const access: DataAccess = { repos: outside, transaction: (work) => db.data.transaction(work) };
    const result = await saveRestPlan(access, { today: '2026-11-09' as LocalDate, current, restPlan: { rest: { kcal: 2150, proteinG: 150, fatG: 70, carbG: 175 }, trainingDays: [1, 2, 4, 5, 6] } });
    expect(result).toBe('saved');
    expect(await repo.list()).toHaveLength(4);
  });
});
