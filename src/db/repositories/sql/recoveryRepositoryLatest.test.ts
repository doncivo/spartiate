import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RecoveryDaySummary } from '../../../domain/recovery';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** Revue I5-02 : dernier résumé vivant, sans borne basse. */
const DEVICE = '60000000-0000-4000-8000-0000000000e3' as DeviceId;
let db: TestDb;
const summary = (day: string): RecoveryDaySummary => ({
  day, level: 'A', recovery: 60, abstainReason: null, quality: 'good', exertion: 1, exertionPrevDay: 0, sleepMinutes: 420, sleepNeedMinutes: 450, sleepScore: 93,
  bedtimeSigmaMinutes: null, targetZone: { from: 4, to: 6 }, hrvMs: 55, restingHr: 52, learningNights: 14, contributors: [], explanationKeys: [], computedAt: `${day}T07:00:00.000Z`,
});

beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-11-10T09:00:00.000Z');
});
afterEach(async () => {
  await db.close();
});

describe('recoveryRepository.latestDay', () => {
  it('rien : null', async () => {
    expect(await (await db.data.repos.recovery()).latestDay()).toBeNull();
  });
  it('rend le jour vivant le plus récent, même très ancien, et ignore un jour supprimé', async () => {
    const repo = await db.data.repos.recovery();
    await repo.saveDay({ summary: summary('2026-10-01'), muscles: [] });
    await repo.saveDay({ summary: summary('2026-10-20'), muscles: [] });
    expect((await repo.latestDay())?.summary.day).toBe('2026-10-20');
    await repo.deleteDay('2026-10-20' as never);
    expect((await repo.latestDay())?.summary.day).toBe('2026-10-01');
  });
});
