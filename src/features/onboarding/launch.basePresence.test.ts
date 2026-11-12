import { afterEach, describe, expect, it, vi } from 'vitest';
import { isEmptyBase, USER_DATA_DOMAINS, type UserDataDomain } from '../../domain/onboarding/draft';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { readBaseCounts } from './launch';

/**
 * FIX-0173 (constat 10 de la relecture du 12/11) : la « base vide » qui ouvre l'assistant tout seul se teste sur TOUTES les données de l'utilisateur, par
 * des requêtes d'existence bornées (`SELECT 1 … LIMIT 1`), jamais par un comptage ni une lecture complète. Une fixture synthétique par domaine, sans les
 * cinq domaines d'avant (profil, routines, pesées, séances, repas).
 */
const DEVICE = '60000000-0000-4000-8000-0000000000c8' as DeviceId;
const DAY = '2026-11-10' as LocalDate;
const AT = '2026-11-10T08:00:00.000Z';
const HLC = '0000000000001-0000-60000000-0000-4000-8000-0000000000c8';
let db: TestDb;
afterEach(async () => db.close());

const SEEDS: Readonly<Partial<Record<UserDataDomain, (db: TestDb) => Promise<void>>>> = {
  recoveryDays: async (t) => {
    await t.driver.execute(
      `INSERT INTO recovery_day (id, date, level, recovery, abstain_reason, quality, exertion, exertion_prev_day, sleep_minutes, sleep_need_minutes, sleep_score, bedtime_sigma_minutes,
         target_zone_from, target_zone_to, hrv_ms, resting_hr, learning_nights, contributors, explanation_keys, computed_at, engine_version, created_at, updated_at, device_id, hlc)
       VALUES ('recovery|${DAY}', '${DAY}', 'C', NULL, 'baseline_incomplete', 'partial', 0, 0, 420, 480, NULL, NULL, NULL, NULL, NULL, NULL, 3, '[]', '[]', '${AT}', 1, '${AT}', '${AT}', '${DEVICE}', '${HLC}')`,
    );
  },
  recoverySamples: async (t) => {
    await (await t.data.repos.recoverySamples()).insertMany([{ type: 'hrv', startAt: AT, endAt: AT, value: 52, stage: null, source: 'hrv.csv' }], AT);
  },
  recoveryFactors: async (t) => {
    await (await t.data.repos.recoveryFactors()).save(DAY, { factors: ['stress'], none: false });
  },
  measurements: async (t) => {
    await (await t.data.repos.measurements()).save(DAY, 'waist', 82);
  },
  photos: async (t) => {
    await (await t.data.repos.progressPhotos()).add(DAY, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]));
  },
};

describe('base vide : toutes les données utilisateur (FIX-0173, constat 10)', () => {
  it('base neuve : vide, aucun domaine présent', async () => {
    db = await openBaseDb(DEVICE, '2026-11-12T09:00:00.000Z');
    const presence = await readBaseCounts(db.data);
    expect(Object.keys(presence).sort()).toEqual([...USER_DATA_DOMAINS].sort());
    expect(isEmptyBase(presence)).toBe(true);
  });

  for (const [domain, seed] of Object.entries(SEEDS)) {
    it(`une base qui ne contient que ${domain} n’est pas vide`, async () => {
      db = await openBaseDb(DEVICE, '2026-11-12T09:00:00.000Z');
      await seed(db);
      const presence = await readBaseCounts(db.data);
      expect(isEmptyBase(presence), `${domain} : l’assistant ne doit pas s’ouvrir tout seul`).toBe(false);
      expect(presence[domain as UserDataDomain], domain).toBe(true);
    });
  }

  it('une mesure supprimée ne compte pas : la base redevient vide', async () => {
    db = await openBaseDb(DEVICE, '2026-11-12T09:00:00.000Z');
    const m = await db.data.repos.measurements();
    await m.save(DAY, 'waist', 82);
    await m.remove(DAY, 'waist');
    expect(isEmptyBase(await readBaseCounts(db.data))).toBe(true);
  });

  it('requêtes d’existence bornées : LIMIT 1, jamais de COUNT ni de lecture complète d’une table', async () => {
    db = await openBaseDb(DEVICE, '2026-11-12T09:00:00.000Z');
    const select = vi.spyOn(db.driver, 'select');
    await readBaseCounts(db.data);
    const queries = select.mock.calls.map((c) => String(c[0]));
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.length).toBeLessThanOrEqual(2);
    for (const q of queries) {
      expect(q).not.toMatch(/count\s*\(/i);
      expect(q).toMatch(/LIMIT 1/);
    }
    const all = queries.join('\n');
    for (const table of ['profile', 'routine', 'body_weight', 'workout', 'meal_entry', 'recovery_day', 'muscle_recovery', 'recovery_sample', 'recovery_factor', 'measurement', 'progress_photo']) {
      expect(all, table).toMatch(new RegExp(`FROM ${table}\\b`));
    }
  });
});
