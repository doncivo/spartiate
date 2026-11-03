import { afterEach, describe, expect, it } from 'vitest';
import type { SyncField, SyncOp } from '../../../../src/domain/sync/format';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { DeviceId, Hlc, IsoDateTime } from '../../../../src/domain/types';
import { openBaseDb, type TestDb } from '../../../../src/db/repositories/sql/testSetup';
import { applyOps } from '../../../../src/sync/apply';
import { guarded } from '../../../../src/sync/guarded';
import { createMemorySyncLogger } from '../../../../src/sync';

/** Point de relecture (c) : une pesée reçue dont l'identité ne correspond pas à weight|date|source est refusée comme une identité naturelle invalide. */

const SELF = '60000000-0000-4000-8000-0000000000b2' as DeviceId;
const AT = '2026-10-05T08:00:00.000Z' as IsoDateTime;
const h = (n: number): Hlc => `${String(Date.parse(AT) + n).padStart(15, '0')}-0000-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb` as Hlc;

let db: TestDb;
afterEach(async () => db.close());

const field = (value: SyncField[0], n = 1): SyncField => [value, h(n), null];
const op = (id: string, fields: Record<string, SyncField>): SyncOp => ({ t: 'body_weight', id, at: AT, f: new Map(Object.entries(fields)) });
const weightFields = (date: string, source: string): Record<string, SyncField> => ({
  date: field(date),
  kg: field(80),
  source: field(source),
  timezone: field('Europe/Paris'),
  health_uuid: field(null),
  measured_at: field(null),
  created_at: field(AT),
  deleted_at: field(null),
});

async function apply(ops: SyncOp[]) {
  const logger = createMemorySyncLogger();
  const result = await guarded(db.data, (repos) => applyOps(repos, ops, { catalogue: SYNC_CATALOGUE, localSv: 1, remoteSv: 1, now: AT, knows: () => false, logger }));
  return { result, logger };
}

describe('identité d’une pesée reçue', () => {
  it('weight|date|source cohérent : appliquée', async () => {
    db = await openBaseDb(SELF);
    const { result } = await apply([op('weight|2026-10-05|manual', weightFields('2026-10-05', 'manual'))]);
    expect(result.outcomes).toEqual(['applied']);
  });

  it('date différente de celle de l’identité : refusée « invalid-id », aucune ligne', async () => {
    db = await openBaseDb(SELF);
    const { result, logger } = await apply([op('weight|2026-10-06|manual', weightFields('2026-10-05', 'manual'))]);
    expect(result.outcomes).toEqual(['rejected']);
    expect(logger.entries.some((e) => e.event === 'apply-rejected' && e.detail['reason'] === 'invalid-id')).toBe(true);
    expect(await db.driver.select('SELECT 1 FROM body_weight')).toEqual([]);
  });

  it('source différente de celle de l’identité : refusée', async () => {
    db = await openBaseDb(SELF);
    const { result } = await apply([op('weight|2026-10-05|health', weightFields('2026-10-05', 'manual'))]);
    expect(result.outcomes).toEqual(['rejected']);
    expect(await db.driver.select('SELECT 1 FROM body_weight')).toEqual([]);
  });

  it('opération partielle qui change la date d’une ligne existante : refusée, la ligne est inchangée', async () => {
    db = await openBaseDb(SELF);
    await apply([op('weight|2026-10-05|manual', weightFields('2026-10-05', 'manual'))]);
    const { result } = await apply([op('weight|2026-10-05|manual', { date: field('2026-10-09', 5) })]);
    expect(result.outcomes).toEqual(['rejected']);
    expect(await db.driver.select('SELECT date FROM body_weight')).toEqual([{ date: '2026-10-05' }]);
  });
});
