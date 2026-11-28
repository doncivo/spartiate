import { afterEach, describe, expect, it } from 'vitest';
import type { SyncField, SyncOp } from '../../../../src/domain/sync/format';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { DeviceId, Hlc, IsoDateTime } from '../../../../src/domain/types';
import { openBaseDb, type TestDb } from '../../../../src/db/repositories/sql/testSetup';
import { applyOps } from '../../../../src/sync/apply';
import { guarded } from '../../../../src/sync/guarded';
import { createMemorySyncLogger } from '../../../../src/sync';

/**
 * SYNC-0304 (BL-187, D-805, ADR 0011 avenant 40) : à l'application, une écriture de `equipment_profile.inventory` venue d'un écrivain au schéma
 * < 25 (ou inconnu) qui remplacerait un inventaire local dont une liste d'identifiants dépasse 64 n'est pas appliquée : valeur locale gardée,
 * écriture écartée inscrite dans `conflict_log` (réversible), journal `apply-older-kept` sans donnée, valeur locale republiée à un hlc plus récent
 * (entrée de file du champ) pour que l'appareil ancien converge. Données synthétiques.
 */
const SELF = '60000000-0000-4000-8000-000000000304' as DeviceId;
const REMOTE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0304';
const AT = '2026-10-05T08:00:00.000Z' as IsoDateTime;
const P = '5c1d0e2f-0000-4000-8000-000000000304';
const h = (n: number): Hlc => `${String(Date.parse(AT) + n).padStart(15, '0')}-0000-${REMOTE}` as Hlc;
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `item-${i}`);
const inv = (available: string[]): string =>
  JSON.stringify({ available, forced: [], forbidden: [], bodyweight: false, barbells: [], platesPerSideKg: [], dumbbells: null, kettlebellsKg: [], machines: [], cables: [] });
const LONG = inv(ids(70));
const EMPTY = inv([]);

let db: TestDb | null = null;
afterEach(async () => {
  await db?.close();
  db = null;
});
const open = (): TestDb => {
  if (!db) throw new Error('base absente');
  return db;
};

const field = (value: SyncField[0], n = 1, base: Hlc | null = null): SyncField => [value, h(n), base];
const op = (fields: Record<string, SyncField>): SyncOp => ({ t: 'equipment_profile', id: P, at: AT, f: new Map(Object.entries(fields)) });
const created = (inventory: string): SyncOp =>
  op({ name: field('Salle'), kind: field('salle'), inventory: field(inventory), increments: field('{}'), created_at: field(AT), deleted_at: field(null), vest_kg: field(null) });

async function apply(ops: SyncOp[], remoteSv: number, fromSnapshot = false) {
  const logger = createMemorySyncLogger();
  const result = await guarded(open().data, (repos) => applyOps(repos, ops, { catalogue: SYNC_CATALOGUE, localSv: 25, remoteSv, now: AT, knows: () => false, logger, ...(fromSnapshot ? { fromSnapshot } : {}) }));
  return { result, logger };
}
const stored = async () => (await open().driver.select<{ inventory: string; name: string }>('SELECT inventory, name FROM equipment_profile WHERE id = ?', [P]))[0];
const conflicts = () =>
  open().driver.select<{ field: string; kept_value: string; discarded_value: string; discarded_hlc: string; kept_device: string }>(
    'SELECT field, kept_value, discarded_value, discarded_hlc, kept_device FROM conflict_log',
  );
const outbox = () => open().driver.select<{ field: string }>("SELECT field FROM sync_outbox WHERE table_name = 'equipment_profile' ORDER BY field");
const clock = async () => (await open().driver.select<{ hlc: string; base_hlc: string | null }>("SELECT hlc, base_hlc FROM sync_field_clock WHERE table_name = 'equipment_profile' AND field = 'inventory'"))[0];

async function seed(inventory: string): Promise<void> {
  // Horloge locale après les hlc reçus (en production, `HlcClock.receive()` précède toujours l'application).
  db = await openBaseDb(SELF, '2026-10-06T08:00:00.000Z');
  expect((await apply([created(inventory)], 25)).result.outcomes).toEqual(['applied']);
}

describe('SYNC-0304 : inventaire long gardé contre un écrivain plus ancien (application)', () => {
  it('(a) sv 24, inventaire vide sur une liste locale de 70 : refusé, liste intacte, écart inscrit et journalisé sans donnée, valeur republiée', async () => {
    await seed(LONG);
    const { result, logger } = await apply([op({ inventory: field(EMPTY, 5, h(1)) })], 24);
    expect(result.outcomes).toEqual(['unchanged']);
    expect((await stored())?.inventory).toBe(LONG);
    const logged = await conflicts();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ field: 'inventory', kept_value: JSON.stringify(LONG), discarded_value: JSON.stringify(EMPTY), discarded_hlc: h(5), kept_device: SELF });
    expect(logger.entries.filter((e) => e.event === 'apply-older-kept')).toEqual([{ event: 'apply-older-kept', detail: { table: 'equipment_profile', field: 'inventory' } }]);
    expect(JSON.stringify(logger.entries)).not.toContain('item-');
    expect(await outbox()).toEqual([{ field: 'inventory' }]);
    const c = await clock();
    expect(c !== undefined && c.hlc > h(5)).toBe(true);
    expect(c?.base_hlc).toBe(h(5));
  });

  it('(a) autres champs de la même opération appliqués ; rejeu de la même écriture : sans effet de plus', async () => {
    await seed(LONG);
    const write = op({ name: field('Salle B', 5, h(1)), inventory: field(EMPTY, 5, h(1)) });
    expect((await apply([write], 24)).result.outcomes).toEqual(['applied']);
    expect(await stored()).toEqual({ inventory: LONG, name: 'Salle B' });
    expect((await apply([write], 24)).result.outcomes).toEqual(['unchanged']);
    expect(await conflicts()).toHaveLength(1);
  });

  it('(a) instantané au sv 24 : même règle', async () => {
    await seed(LONG);
    await apply([op({ inventory: field(EMPTY, 5, null) })], 24, true);
    expect((await stored())?.inventory).toBe(LONG);
    expect(await conflicts()).toHaveLength(1);
  });

  it('(b) sv 24 sur une liste locale de 64 : appliqué comme avant, sans écart inscrit', async () => {
    await seed(inv(ids(64)));
    const { result, logger } = await apply([op({ inventory: field(EMPTY, 5, h(1)) })], 24);
    expect(result.outcomes).toEqual(['applied']);
    expect((await stored())?.inventory).toBe(EMPTY);
    expect(await conflicts()).toEqual([]);
    expect(logger.entries.some((e) => e.event === 'apply-older-kept')).toBe(false);
    expect(await outbox()).toEqual([]);
  });

  it('(c) sv 25 sur une liste de 70 : appliqué (hlc habituel), rien inscrit, rien republié', async () => {
    await seed(LONG);
    const { result } = await apply([op({ inventory: field(EMPTY, 5, h(1)) })], 25);
    expect(result.outcomes).toEqual(['applied']);
    expect((await stored())?.inventory).toBe(EMPTY);
    expect(await conflicts()).toEqual([]);
    expect(await outbox()).toEqual([]);
  });

  it('(c) sv 24 mais écriture plus ancienne que la valeur locale : règle ordinaire (rien appliqué, rien inscrit, rien republié)', async () => {
    await seed(LONG);
    const { result } = await apply([op({ inventory: field(EMPTY, 0, null) })], 24);
    expect(result.outcomes).toEqual(['unchanged']);
    expect((await stored())?.inventory).toBe(LONG);
    expect(await outbox()).toEqual([]);
  });

  it('(d) sv inconnu (NaN, non entier) : traité comme plus ancien, liste gardée', async () => {
    for (const sv of [Number.NaN, 24.5]) {
      await seed(LONG);
      await apply([op({ inventory: field(EMPTY, 5, h(1)) })], sv);
      expect((await stored())?.inventory).toBe(LONG);
      expect(await conflicts()).toHaveLength(1);
      await open().close();
      db = null;
    }
  });
});
