import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { EpochId } from '../../../../src/domain/sync/format';
import type { Hlc } from '../../../../src/domain/types';
import type { RestoreMarker } from '../../../../src/platform/sync/types';
import { createMemorySyncLogger } from '../../../../src/sync/log';
import { resolveInflight } from '../../../../src/sync/orphanEpoch';
import type { Inflight } from '../../../../src/sync/publisher';
import { createSimDevice, pair, selectSimSchema, setupFirst, syncFolders, warmSimDevices, type SimDevice } from '../../../sim/syncDevice';

// CLEAN-03 (D-201) : banc Spartiate (migration réelle, catalogue de production, entrées simulées sur `meal_entry`).
selectSimSchema('i0');

/**
 * DATA-0295 (reste de BL-166, demandé par la relecture sync-icloud de SHELL-0294f, D-26) : trois tests de non-régression de
 * `resolveInflight` (D-627). (1) Moteur : ajout natif réussi, retrait local en échec (intention gardée, BL-038), changement d'époque ouvert
 * par l'autre appareil, puis cycles suivants : aucune tête de l'ancienne époque, entrée reçue une fois, `conflict_log` vide. (2) Même
 * intention périmée avec une rotation de l'ancienne époque en cours : ni tête, ni rotation touchée. (3) `META.epoch` nulle : ancien
 * comportement (tête de l'intention publiée). Données synthétiques.
 */
const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let devices: SimDevice[] = [];
beforeAll(() => warmSimDevices());
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function meta(device: SimDevice, key: string): Promise<unknown> {
  const rows = await device.driver.select<{ value: string | null }>('SELECT value FROM sync_meta WHERE key = ?', [key]);
  const value = rows[0]?.value ?? null;
  return value === null ? null : JSON.parse(value);
}

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}

describe('BL-166 (1) : moteur, intention gardée puis changement d’époque avant le cycle suivant', () => {
  it('aucune tête de l’ancienne époque, entrée reçue une fois, aucun conflit', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC' });
    const b = await createSimDevice(B_ID, { name: 'iPhone', clock: a.clock });
    devices = [a, b];
    await setupFirst(a);
    await a.cycle();
    await pair(a, b);
    await b.cycle();
    syncFolders(devices);
    await a.cycle();
    const oldEpoch = await meta(a, 'epoch');
    const entry = await a.createTask('Entrée avant le changement');
    const realAppend = a.platform.appendJournal.bind(a.platform);
    const realTransaction = a.data.transaction.bind(a.data);
    let appended = false;
    let failed = false;
    (a.platform as { appendJournal: typeof realAppend }).appendJournal = async (request) => {
      const result = await realAppend(request);
      appended = true;
      return result;
    };
    (a.data as { transaction: typeof realTransaction }).transaction = ((work: never) => {
      if (appended && !failed) {
        failed = true;
        return Promise.reject(new Error('disque plein'));
      }
      return realTransaction(work);
    }) as typeof realTransaction;
    a.clock.advance(1_000);
    await a.cycle();
    (a.data as { transaction: typeof realTransaction }).transaction = realTransaction;
    expect(failed).toBe(true);
    const kept = (await meta(a, 'inflight')) as Inflight | null;
    expect(kept).toMatchObject({ epoch: oldEpoch });
    // Le scénario est bien celui de BL-166 : file encore pleine et intention qui porte ses entrées.
    expect(await a.data.repos.sync.outboxCount()).toBeGreaterThan(0);
    expect(kept?.entries.length ?? 0).toBeGreaterThan(0);
    // Espion : époque de chaque état écrit par A, et si l'écriture suit son changement d'époque (journal `epoch-switched`).
    const realWriteState = a.platform.writeState.bind(a.platform);
    const written: { epoch: unknown; head: unknown; afterSwitch: boolean }[] = [];
    (a.platform as { writeState: typeof realWriteState }).writeState = async (request) => {
      written.push({ epoch: request.state.epoch, head: request.state.head.epoch, afterSwitch: a.logger.entries.some((e) => e.event === 'epoch-switched') });
      return realWriteState(request);
    };
    // Changement d'époque ouvert par B (restauration, « Appliquer partout ») avant le cycle suivant de A.
    syncFolders(devices);
    const marker: RestoreMarker = {
      backup: 'spartiate-daily-20261005.db',
      backupTakenAt: '2026-10-05T07:00:00.000Z' as RestoreMarker['backupTakenAt'],
      restoredAt: new Date(b.clock.nowMs()).toISOString() as RestoreMarker['restoredAt'],
      schemaVersion: 23,
    };
    b.platform.testing.setRestoreMarker(marker);
    await b.restart();
    await b.service.chooseRestoreOption('apply-everywhere');
    syncFolders(devices);
    await settle();
    // Le chemin de D-627 est bien celui pris : époque changée, puis intention abandonnée (jamais publiée comme tête).
    expect(a.logger.entries.filter((e) => e.event === 'inflight-resolved').map((e) => e.detail)).toEqual([{ appended: false, staleEpoch: true }]);
    const newEpoch = await meta(a, 'epoch');
    expect(newEpoch).not.toEqual(oldEpoch);
    expect(await meta(b, 'epoch')).toEqual(newEpoch);
    // Après le changement, aucun état ne part sur l’ancienne époque (ni l’état, ni sa tête).
    const after = written.filter((w) => w.afterSwitch);
    expect(after.length).toBeGreaterThan(0);
    for (const w of after) expect(w).toMatchObject({ epoch: newEpoch, head: newEpoch });
    expect(await meta(a, 'inflight')).toBeNull();
    expect(((await meta(a, 'head')) as { epoch: EpochId } | null)?.epoch).toEqual(newEpoch);
    expect((await b.task(entry.id))?.title).toBe('Entrée avant le changement');
    expect((await b.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM meal_entry WHERE id = ?', [entry.id]))[0]?.n).toBe(1);
    for (const d of devices) {
      expect((await d.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n, d.name).toBe(0);
      expect(await d.data.repos.sync.outboxCount(), d.name).toBe(0);
    }
  });
});

const OLD = 'e-0001' as EpochId;
const CURRENT = 'e-0002' as EpochId;
const INFLIGHT: Inflight = { epoch: OLD, segment: 3, expect: 10, count: 2, maxHlc: '0000000000001:0000:aaaa' as Hlc, entries: [] };
const ROTATION = JSON.stringify({ epoch: OLD, segment: 2, maxHlc: '0000000000001:0000:aaaa' });

function fakeDeps(epoch: EpochId | null, rotation: string | null = null) {
  const store = new Map<string, string | null>([
    ['inflight', JSON.stringify(INFLIGHT)],
    ['epoch', epoch === null ? null : JSON.stringify(epoch)],
    ['publishRotation', rotation],
  ]);
  const cleared: unknown[] = [];
  const repos = {
    sync: {
      clearPublished: async (entries: unknown) => void cleared.push(entries),
      getMeta: async (key: string) => store.get(key) ?? null,
      setMeta: async (key: string, value: string | null) => void store.set(key, value),
    },
  };
  const logger = createMemorySyncLogger();
  const deps = { data: { repos, transaction: async <T>(work: (r: typeof repos) => Promise<T>) => work(repos) }, logger } as never;
  return { deps, store, cleared, logger };
}

describe('BL-166 (2) : intention périmée avec une rotation de l’ancienne époque', () => {
  it('ni tête écrite, ni file retirée, rotation laissée telle quelle, intention abandonnée', async () => {
    const f = fakeDeps(CURRENT, ROTATION);
    const heads: unknown[] = [];
    await resolveInflight(f.deps, INFLIGHT, async (h) => (heads.push(h), true));
    expect(heads).toEqual([]);
    expect(f.cleared).toEqual([]);
    expect(f.store.get('head') ?? null).toBeNull();
    expect(f.store.get('publishRotation')).toBe(ROTATION);
    expect(f.store.get('inflight')).toBeNull();
    expect(f.logger.entries).toEqual([{ event: 'inflight-resolved', detail: { appended: false, staleEpoch: true } }]);
  });
});

describe('BL-166 (3) : META.epoch nulle', () => {
  it('ancien comportement : tête de l’intention publiée, file retirée, intention effacée', async () => {
    const f = fakeDeps(null);
    const heads: { epoch: EpochId }[] = [];
    await resolveInflight(f.deps, INFLIGHT, async (h) => (heads.push(h), true));
    expect(heads.map((h) => h.epoch)).toEqual([OLD]);
    expect(f.cleared).toHaveLength(1);
    expect(JSON.parse(f.store.get('head') ?? 'null')).toMatchObject({ epoch: OLD, segment: 3, record: 12 });
    expect(f.store.get('inflight')).toBeNull();
    expect(f.logger.entries).toEqual([{ event: 'inflight-resolved', detail: { appended: true } }]);
  });
});
