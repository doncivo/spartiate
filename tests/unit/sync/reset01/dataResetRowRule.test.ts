import { afterEach, describe, expect, it } from 'vitest';
import { openBaseDb, type TestDb } from '../../../../src/db/repositories/sql/testSetup';
import type { SyncField, SyncOp } from '../../../../src/domain/sync/format';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { DeviceId, Hlc, IsoDateTime, LocalDate } from '../../../../src/domain/types';
import { applyOps } from '../../../../src/sync/apply';
import { resetAllData } from '../../../../src/sync/dataReset';
import { guarded } from '../../../../src/sync/guarded';
import { createMemorySyncLogger } from '../../../../src/sync/log';

/**
 * RESET-01 (D-187, ADR 0011 avenant 36, règle de ligne) : une écriture faite APRÈS l'horizon par un appareil hors ligne sur une ligne créée AVANT la
 * remise à zéro ne fait jamais revenir cette ligne, même quand l'opération porte des champs plus récents que l'horizon sans base (ligne republiée
 * entière, « + ») : la ligne appartient à l'avant-remise (création connue avant l'horizon, ou modification fondée sur une valeur d'avant), l'opération
 * entière est écartée. Une ligne créée après l'horizon circule normalement.
 */
const A = '60000000-0000-4000-8000-0000000000a1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000b2';
const AT = '2026-11-20T08:00:00.000Z' as IsoDateTime;
const hb = (ms: number): Hlc => `${String(ms).padStart(15, '0')}-0000-${B}` as Hlc;
const W = 'weight|2026-11-10|manual';
let db: TestDb;
afterEach(async () => db.close());

const weightOp = (fields: Record<string, SyncField>): SyncOp => ({ t: 'body_weight', id: W, at: AT, f: new Map(Object.entries(fields)) });
const apply = (ops: SyncOp[]) =>
  guarded(db.data, (repos) => applyOps(repos, ops, { catalogue: SYNC_CATALOGUE, localSv: 16, remoteSv: 16, now: AT, knows: () => false, logger: createMemorySyncLogger() }));
const kg = async (): Promise<unknown> => (await db.driver.select<{ kg: number }>('SELECT kg FROM body_weight WHERE id = ?', [W]))[0]?.kg ?? null;

async function afterReset(): Promise<number> {
  db = await openBaseDb(A, '2026-11-12T08:00:00.000Z');
  await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-10' as LocalDate, kg: 82.4, timezone: 'Europe/Paris' }, '2026-11-12' as LocalDate);
  db.clock.advance(1_000);
  const outcome = await resetAllData(db.data, SYNC_CATALOGUE, createMemorySyncLogger());
  if (outcome.kind !== 'done') throw new Error('remise à zéro refusée');
  return Number(outcome.horizon.slice(0, 15));
}

describe('règle de ligne : l’avant-remise ne revient jamais', () => {
  it('ligne entière republiée (« + ») : création d’avant, une valeur d’après sans base → écartée, rien n’est créé ni mis de côté', async () => {
    const H = await afterReset();
    const before = hb(H - 5_000);
    const after = hb(H + 60_000);
    await apply([
      weightOp({ date: ['2026-11-10', before, null], kg: [79, after, null], source: ['manual', before, null], timezone: ['Europe/Paris', before, null], health_uuid: [null, before, null], measured_at: [null, before, null], created_at: ['2026-11-12T07:00:00.000Z', before, null], deleted_at: [null, before, null] }),
    ]);
    expect(await kg()).toBeNull();
    expect(await db.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
  });

  it('même identifiant naturel ressaisi ici après la remise à zéro : la modification hors ligne de l’ancienne ligne ne l’écrase pas', async () => {
    const H = await afterReset();
    db.clock.advance(10_000);
    await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-10' as LocalDate, kg: 81, timezone: 'Europe/Paris' }, '2026-11-12' as LocalDate);
    const before = hb(H - 5_000);
    await apply([
      weightOp({ date: ['2026-11-10', before, null], kg: [79, hb(H + 600_000), null], source: ['manual', before, null], timezone: ['Europe/Paris', before, null], health_uuid: [null, before, null], measured_at: [null, before, null], created_at: ['2026-11-12T07:00:00.000Z', before, null], deleted_at: [null, before, null] }),
    ]);
    expect(await kg()).toBe(81);
  });

  it('modification d’après fondée sur une valeur d’avant (base ≤ horizon), sans création : écartée entière', async () => {
    const H = await afterReset();
    await apply([weightOp({ kg: [79, hb(H + 60_000), hb(H - 5_000)], timezone: ['UTC', hb(H + 60_000), null] })]);
    expect(await kg()).toBeNull();
    expect(await db.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
  });

  it('ligne créée après l’horizon : appliquée normalement', async () => {
    const H = await afterReset();
    const after = hb(H + 60_000);
    await apply([
      weightOp({ date: ['2026-11-10', after, null], kg: [77, after, null], source: ['manual', after, null], timezone: ['Europe/Paris', after, null], health_uuid: [null, after, null], measured_at: [null, after, null], created_at: ['2026-11-20T08:01:00.000Z', after, null], deleted_at: [null, after, null] }),
    ]);
    expect(await kg()).toBe(77);
  });
});
