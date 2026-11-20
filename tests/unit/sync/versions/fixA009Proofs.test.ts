import { describe, expect, it } from 'vitest';
import type { Repositories } from '../../../../src/db/repositories';
import type { EpochId, SyncField, SyncValue } from '../../../../src/domain/sync/format';
import type { SyncCatalogue } from '../../../../src/domain/sync/syncTables';
import type { DeviceId, Hlc, IsoDateTime } from '../../../../src/domain/types';
import { applyOps } from '../../../../src/sync/apply';
import type { SyncDeps } from '../../../../src/sync/deps';
import { finishResumeTx } from '../../../../src/sync/join';
import { mergeSnapshot, type LoadedSnapshot } from '../../../../src/sync/snapshot';
import { V18_CATALOGUE, V19_CATALOGUE } from '../../../sim/syncDevice';

/**
 * FIX-A009 (audit 0.26.0, A-009 et complément PROG-04) : preuves de Codex reprises telles quelles (`docs/audit-0.26.0/preuves/
 * partie3-snapshot-colonnes.test.mjs` et `partie3-weekday-main.test.mjs`, jamais branchées depuis docs/), écrites en Vitest avec les vrais
 * `applyOps`, `mergeSnapshot` et `finishResumeTx` et un dépôt synthétique en mémoire. Lecteur 18 (sans les colonnes de la 0019) et lecteur
 * 19 (sans `routine_day.weekday`) : la colonne nouvelle d'une table CONNUE reçue d'un écrivain plus récent doit rester dans `sync_unknown`,
 * par le journal (témoin) comme par l'instantané, alors que la reprise avance le curseur au dernier enregistrement couvert.
 */

const NOW = '2026-11-19T10:00:00.000Z' as IsoDateTime;
const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as DeviceId;
const ROW = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const HLC = `${String(Date.parse(NOW)).padStart(15, '0')}-0000-${DEVICE}` as Hlc;
const EPOCH = `e0001-${DEVICE}` as EpochId;

interface Kept {
  readonly table: string;
  readonly field: string;
  readonly value: SyncValue;
  readonly sv: number;
}

async function receive(route: 'journal' | 'snapshot', input: { catalogue: SyncCatalogue; table: string; field: string; value: SyncValue; localSv: number; remoteSv: number }): Promise<{ kept: Kept[]; cursor: number }> {
  const kept: Kept[] = [];
  const states = new Map<string, Record<string, unknown>>([[DEVICE, { deviceId: DEVICE, epoch: EPOCH, stateEpoch: EPOCH, cursorSegment: 0, cursorRecord: 0, ackHlc: null, status: 'active' }]]);
  const sync = {
    getMeta: async () => null,
    readRows: async () => new Map([[ROW, { hlc: HLC, values: new Map([['created_at', NOW]]) }]]),
    readClocks: async () => new Map(),
    pendingFields: async () => new Map(),
    tombstones: async () => new Map(),
    setGuard: async () => {},
    clearGuard: async () => {},
    savepoint: async () => {},
    releaseSavepoint: async () => {},
    putUnknown: async (value: Kept) => {
      kept.push(value);
      return true;
    },
    getStates: async () => [...states.values()],
    saveState: async (key: string, value: Record<string, unknown>) => {
      states.set(key, { ...states.get(key), ...value });
    },
    setMeta: async () => {},
  };
  const repos = { sync } as unknown as Repositories;
  const logger = { log: () => {} };
  const ctx = { catalogue: input.catalogue, localSv: input.localSv, remoteSv: input.remoteSv, now: NOW, knows: () => true, logger };
  if (route === 'journal') {
    const fields = new Map<string, SyncField>([
      ['created_at', [NOW, HLC, null]],
      [input.field, [input.value, HLC, null]],
    ]);
    await applyOps(repos, [{ t: input.table, id: ROW, at: NOW, f: fields }], ctx);
  } else {
    const deps = {
      deviceId: ROW,
      catalogue: input.catalogue,
      sv: input.localSv,
      data: { repos, transaction: async <T,>(work: (r: Repositories) => Promise<T>) => work(repos) },
      clock: { nowMs: () => Date.parse(NOW) },
      hlc: { receive: () => {}, now: () => HLC },
      logger,
    } as unknown as SyncDeps;
    const loaded = {
      records: [{ k: 'snap-rows', rows: [[input.table, new Map<string, SyncValue>([['id', ROW], ['created_at', NOW], [input.field, input.value]]), new Map([['*', HLC]])]] }],
      end: { k: 'snap-end', count: 1, covers: new Map([[DEVICE, { epoch: EPOCH, segment: 1, record: 17, hlc: HLC, stateSeq: 1 }]]), epoch: EPOCH, sv: input.remoteSv },
    } as unknown as LoadedSnapshot;
    await mergeSnapshot(deps, loaded, ctx, undefined, (tx) =>
      finishResumeTx(tx, deps, { epoch: EPOCH, from: DEVICE, loaded, accepted: new Map([[DEVICE, {}]]), coverage: { forgotten: new Set() } as never }),
    );
  }
  return { kept, cursor: Number(states.get(DEVICE)?.['cursorRecord']) };
}

describe('A-009 : colonne de la migration 19 reçue par un lecteur 18 (partie3-snapshot-colonnes)', () => {
  const input = { catalogue: V18_CATALOGUE, table: 'nutrition_target', field: 'rest_kcal', value: 2200, localSv: 18, remoteSv: 19 };
  it('témoin journal : rest_kcal gardé dans sync_unknown avec le sv de l’écrivain', async () => {
    const { kept } = await receive('journal', input);
    expect(kept.find((f) => f.field === 'rest_kcal')).toMatchObject({ table: 'nutrition_target', value: 2200, sv: 19 });
  });
  it('instantané : rest_kcal gardé aussi, alors que la reprise avance au curseur couvert (17)', async () => {
    const { kept, cursor } = await receive('snapshot', input);
    expect(cursor).toBe(17);
    expect(kept.find((f) => f.field === 'rest_kcal')).toMatchObject({ table: 'nutrition_target', value: 2200, sv: 19 });
  });
});

describe('A-009, complément PROG-04 : routine_day.weekday (schéma 20) reçu par un lecteur 19 (partie3-weekday-main)', () => {
  const input = { catalogue: V19_CATALOGUE, table: 'routine_day', field: 'weekday', value: 4, localSv: 19, remoteSv: 20 };
  it('témoin journal : jeudi (4) gardé dans sync_unknown', async () => {
    const { kept } = await receive('journal', input);
    expect(kept.find((f) => f.field === 'weekday')).toMatchObject({ table: 'routine_day', value: 4, sv: 20 });
  });
  it('instantané : jeudi (4) gardé aussi, alors que la reprise avance au curseur couvert (17)', async () => {
    const { kept, cursor } = await receive('snapshot', input);
    expect(cursor).toBe(17);
    expect(kept.find((f) => f.field === 'weekday')).toMatchObject({ table: 'routine_day', value: 4, sv: 20 });
  });
});
