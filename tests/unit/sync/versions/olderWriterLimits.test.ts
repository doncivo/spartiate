import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import type { SyncDeps } from '../../../../src/sync/deps';
import { olderParked } from '../../../../src/sync/olderWriter';
import { SyncPlatformError } from '../../../../src/platform/sync/types';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/**
 * SYNC-0281a (ADR 0018, limites connues M2, M3, M4 ; D-290) : deux appareils simulés, A resté au schéma 18, B à jour. M2 corrigé (écrivain
 * noté à la mise de côté, jamais déduit du hlc) ; M3 et M4 acceptés : ces tests prouvent qu'aucune ligne n'est perdue. Données synthétiques.
 */

const NEW_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OLD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STRANGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const M1 = '5c1d0e2f-0000-4000-8000-000000000201';
const ROUTINE = '5c1d0e2f-0000-4000-8000-000000000203';

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function mixed(): Promise<{ a: SimDevice; b: SimDevice }> {
  const b = await createSimDevice(NEW_ID, { name: 'PC', schema: 'i0' });
  const a = await createSimDevice(OLD_ID, { name: 'iPhone', schema: 'v18', clock: createManualClock(b.clock.nowMs()) });
  devices = [b, a];
  await setupFirst(b);
  await b.cycle();
  await pair(b, a);
  await a.cycle();
  syncFolders(devices);
  await b.cycle();
  return { a, b };
}

async function roundTrip(times = 2): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}

const iso = (d: SimDevice): string => new Date(d.clock.nowMs()).toISOString();

async function createCycleOn18(a: SimDevice): Promise<void> {
  const at = iso(a);
  await a.driver.execute(
    `INSERT INTO mesocycle (id, routine_id, start_date, weeks, unlimited, deload_week, block_origin_week, block_origin_index, rotation_index, pauses, status, outcome, ended_on, created_at, updated_at, device_id, hlc)
     VALUES (?, ?, '2026-11-16', 5, 0, NULL, 1, 0, 0, '[]', 'active', NULL, NULL, ?, ?, ?, ?)`,
    [M1, ROUTINE, at, at, a.id, a.hlc.now()],
  );
}

const cycleRow = (d: SimDevice) => d.driver.select('SELECT id, routine_id, start_date, weeks, unlimited, pauses, status, next_weeks, ramp_up, deleted_at, hlc FROM mesocycle ORDER BY id');
const parkedOps = (d: SimDevice) => d.driver.select<{ op: string; hlc: string }>("SELECT op, hlc FROM sync_parked WHERE reason = 'missing-row' ORDER BY id");
const depsOf = async (d: SimDevice): Promise<SyncDeps> => {
  const sv = (await d.driver.select<{ v: number }>('SELECT MAX(version) AS v FROM schema_migrations'))[0]?.v ?? 0;
  return { data: d.data, sv } as unknown as SyncDeps;
};
const conflicts = async (d: SimDevice) => (await d.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n;
const warnings = (d: SimDevice): readonly string[] => d.service.status().warnings ?? [];

describe('SYNC-0281a M2 (corrigé) : l’écrivain d’une partie gardée est l’appareil lu, jamais déduit du hlc', () => {
  it('la partie gardée note l’appareil qui a publié l’enregistrement (JSON local de sync_parked, jamais publié)', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await roundTrip();
    const ops = await parkedOps(b);
    expect(ops).toHaveLength(1);
    expect(JSON.parse(ops[0]?.op ?? '{}')).toMatchObject({ sv: 18, w: a.id });
  });

  it('plus grand hlc venu d’un autre appareil (report, reprise) : toujours « appareil plus ancien » pour l’écrivain resté en 18', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await roundTrip();
    // Champ le plus récent écrit par un appareil inconnu ici (report d'un appareil oublié) : l'ancienne règle attribuait l'opération à cet
    // appareil, donc « ligne manquante » au lieu de « mets-le à jour ».
    const foreign = b.hlc.now().slice(0, 21) + STRANGER;
    await b.driver.execute("UPDATE sync_parked SET hlc = ?, op = json_set(op, '$.w', ?) WHERE reason = 'missing-row'", [foreign, a.id]);
    expect(await olderParked(await depsOf(b))).toBe(1);
  });

  it('écrivain noté inconnu ici : ligne manquante ordinaire, même si le hlc désigne l’appareil resté en 18', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await roundTrip();
    await b.driver.execute("UPDATE sync_parked SET op = json_set(op, '$.w', ?) WHERE reason = 'missing-row'", [STRANGER]);
    expect(await olderParked(await depsOf(b))).toBe(0);
  });

  it('partie gardée sans écrivain noté (0.25.0 à 0.28.0) : règle d’avant (hlc), toujours « appareil plus ancien »', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await roundTrip();
    await b.driver.execute("UPDATE sync_parked SET op = json_remove(op, '$.w') WHERE reason = 'missing-row'");
    expect(await olderParked(await depsOf(b))).toBe(1);
    await b.cycle();
    expect(warnings(b)).toContain('older-device');
  });
});

describe('SYNC-0281a M3 (limite acceptée) : état à jour lu avant le journal republié, aucune perte', () => {
  it('reprise depuis l’instantané demandée puis consommée sans effet ; la republication applique la ligne une fois, sans conflit', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await roundTrip();
    expect(warnings(b)).toContain('older-device');
    await a.upgradeSchema('i0');
    // Le journal republié de A n'arrive pas à ce cycle (ajout refusé), son état publié au schéma à jour, si.
    const real = a.platform.appendJournal.bind(a.platform);
    let fail = true;
    (a.platform as { appendJournal: typeof real }).appendJournal = (request) => {
      if (fail) {
        fail = false;
        return Promise.reject(new SyncPlatformError('io'));
      }
      return real(request);
    };
    a.clock.advance(1_000);
    await a.cycle();
    syncFolders(devices);
    b.clock.advance(1_000);
    await b.cycle();
    // La fenêtre de M3 : écrivain vu à jour, ligne encore de côté, « reçu non appliqué » et une reprise demandée pour rien.
    expect(await parkedOps(b)).toHaveLength(1);
    expect(warnings(b)).toContain('received-unapplied');
    expect(warnings(b)).not.toContain('older-device');
    expect(b.logger.entries.map((e) => e.event)).toContain('parked-resume-requested');
    await roundTrip(3);
    expect(await cycleRow(b)).toEqual(await cycleRow(a));
    expect(await cycleRow(b)).toHaveLength(1);
    expect(await parkedOps(b)).toEqual([]);
    expect(warnings(b)).not.toContain('received-unapplied');
    expect(await conflicts(a)).toBe(0);
    expect(await conflicts(b)).toBe(0);
  });
});

describe('SYNC-0281a M4 (limite acceptée) : partie gardée par la 0.24.0 (sans sv), aucune perte', () => {
  it('comptée « reçu non appliqué », jamais « appareil plus ancien » ; appliquée après la mise à jour de l’écrivain', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await roundTrip();
    // Partie telle que la 0.24.0 la gardait : ni schéma ni écrivain notés.
    await b.driver.execute("UPDATE sync_parked SET op = json_remove(op, '$.sv', '$.w') WHERE reason = 'missing-row'");
    expect(await olderParked(await depsOf(b))).toBe(0);
    b.clock.advance(1_000);
    await b.cycle();
    expect(warnings(b)).toContain('received-unapplied');
    expect(warnings(b)).not.toContain('older-device');
    expect(await parkedOps(b)).toHaveLength(1);
    await a.upgradeSchema('i0');
    await roundTrip(3);
    expect(await cycleRow(b)).toEqual(await cycleRow(a));
    expect(await cycleRow(b)).toHaveLength(1);
    expect(await parkedOps(b)).toEqual([]);
    expect(warnings(b)).not.toContain('received-unapplied');
    expect(await conflicts(b)).toBe(0);
  });
});
