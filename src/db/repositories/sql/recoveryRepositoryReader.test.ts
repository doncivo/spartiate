import { afterEach, describe, expect, it } from 'vitest';
import type { RecoveryDayOutput } from '../../../domain/recovery';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { createStorage } from '../storage';
import { SYNC_CATALOGUE } from '../../../domain/sync/syncTables';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I5-01 (§ 9.1, § 16.4) : « l'iPhone écrit, le PC lit ». Sur un appareil lecteur (PC), `saveDay` et `deleteDay` n'écrivent rien (ni ligne, ni
 * file de synchro) et le signalent par un événement FIXE, sans aucune valeur. Les lignes reçues par la synchro (écrites par le moteur, hors du
 * dépôt) restent lisibles. Par défaut, un stockage est lecteur : seul l'iPhone se déclare écrivain.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000fb' as DeviceId;
const DAY = '2026-11-09' as LocalDate;
const HRV = 61.37;
let db: TestDb;
afterEach(async () => db.close());

const output = (over: Partial<RecoveryDayOutput['summary']> = {}): RecoveryDayOutput => ({
  summary: {
    day: DAY, level: 'C', recovery: 72, abstainReason: null, quality: 'good', exertion: 4.5, exertionPrevDay: 2, sleepMinutes: 450, sleepNeedMinutes: 480, sleepScore: 94,
    bedtimeSigmaMinutes: 22.5, targetZone: { from: 6, to: 8 }, hrvMs: HRV, restingHr: 47.21, learningNights: 14, contributors: [], explanationKeys: [], computedAt: '2026-11-09T07:00:00.000Z', ...over,
  },
  muscles: [{ day: DAY, muscleId: 'quads', group: 'Jambes', percent: 40, hours: 96, lastWorkedAt: '2026-11-08T18:00:00.000Z', readyAt: '2026-11-12T18:00:00.000Z' }],
});

describe('RecoveryRepository sur un appareil lecteur (PC)', () => {
  it('saveDay : rien n’est écrit ni mis en file, rend null, un seul événement fixe sans valeur', async () => {
    const events: string[] = [];
    db = await openBaseDb(DEVICE, undefined, { recoveryWriter: false, onIgnoredWrite: (e) => events.push(e) });
    const repo = await db.data.repos.recovery();
    expect(await repo.saveDay(output())).toBeNull();
    expect(await db.driver.select('SELECT 1 FROM recovery_day')).toEqual([]);
    expect(await db.driver.select('SELECT 1 FROM muscle_recovery')).toEqual([]);
    expect(await db.driver.select("SELECT 1 FROM sync_outbox WHERE table_name IN ('recovery_day', 'muscle_recovery')")).toEqual([]);
    expect(events).toEqual(['recovery-write-ignored']);
  });

  it('deleteDay : une ligne reçue de l’iPhone n’est jamais supprimée par le PC', async () => {
    const events: string[] = [];
    db = await openBaseDb(DEVICE, undefined, { recoveryWriter: false, onIgnoredWrite: (e) => events.push(e) });
    // ligne reçue (écriture gardée de la synchro, jamais par le dépôt)
    await db.driver.execute('INSERT INTO sync_guard (id) VALUES (1)');
    {
      await db.driver.execute(
        `INSERT INTO recovery_day (id, date, level, recovery, abstain_reason, quality, exertion, exertion_prev_day, sleep_minutes, sleep_need_minutes, sleep_score, bedtime_sigma_minutes,
           target_zone_from, target_zone_to, hrv_ms, resting_hr, learning_nights, contributors, explanation_keys, computed_at, engine_version, created_at, updated_at, device_id, hlc)
         VALUES ('recovery|2026-11-09', '2026-11-09', 'C', 72, NULL, 'good', 4.5, 2, 450, 480, 94, 22.5, 6, 8, ${String(HRV)}, 47.21, 14, '[]', '[]', '2026-11-09T07:00:00.000Z', 1,
           '2026-11-09T07:00:00.000Z', '2026-11-09T07:00:00.000Z', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '001794000000000-0000-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')`,
      );
    }
    await db.driver.execute('DELETE FROM sync_guard');
    const repo = await db.data.repos.recovery();
    await repo.deleteDay(DAY);
    expect((await repo.getDay(DAY))?.summary).toMatchObject({ recovery: 72, hrvMs: HRV });
    expect(await repo.listDays(DAY, DAY)).toHaveLength(1);
    expect(await db.driver.select('SELECT 1 FROM sync_outbox')).toEqual([]);
    expect(events).toEqual(['recovery-write-ignored']);
    expect(JSON.stringify(events)).not.toContain(String(HRV));
  });

  it('une entrée invalide reste refusée sur le PC (aucune écriture, jamais masquée par la règle du lecteur)', async () => {
    db = await openBaseDb(DEVICE, undefined, { recoveryWriter: false });
    await expect((await db.data.repos.recovery()).saveDay(output({ level: 'Z' as never }))).rejects.toMatchObject({ code: 'invalid' });
  });

  it('stockage par défaut (createStorage sans option) : lecteur', async () => {
    const storage = createStorage(SYNC_CATALOGUE);
    db = await openBaseDb(DEVICE, undefined, { factory: storage.repositories });
    expect(await (await db.data.repos.recovery()).saveDay(output())).toBeNull();
    expect(await db.driver.select('SELECT 1 FROM recovery_day')).toEqual([]);
  });
});

describe('RecoveryRepository sur l’iPhone (écrivain) : instants publiables', () => {
  it('instant de calcul, dernière séance ou « prêt à » hors ISO 8601 : refusés (le catalogue de synchro les refuserait au PC)', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await db.data.repos.recovery();
    const base = output();
    const first = base.muscles[0];
    if (!first) throw new Error('fixture');
    await expect(repo.saveDay(output({ computedAt: 'hier' }))).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.saveDay({ ...base, muscles: [{ ...first, readyAt: '2026-11-12 18:00' }] })).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.saveDay({ ...base, muscles: [{ ...first, lastWorkedAt: '' }] })).rejects.toMatchObject({ code: 'invalid' });
    await expect(repo.saveDay({ ...base, muscles: [{ ...first, muscleId: 'm'.repeat(65) }] })).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT 1 FROM recovery_day')).toEqual([]);
  });
});
