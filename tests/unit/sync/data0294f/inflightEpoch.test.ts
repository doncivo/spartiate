import { describe, expect, it } from 'vitest';
import type { EpochId } from '../../../../src/domain/sync/format';
import type { Hlc } from '../../../../src/domain/types';
import { createMemorySyncLogger } from '../../../../src/sync/log';
import { resolveInflight } from '../../../../src/sync/orphanEpoch';
import type { Inflight } from '../../../../src/sync/publisher';

/**
 * BL-166 (contre-relecture sync-icloud de DATA-0293 ; SHELL-0294f, D-627) : `resolveInflight` publiait la tête de l'époque de l'intention
 * sans la comparer à l'époque courante. Cas : ajout natif réussi, retrait local en échec (intention gardée, BL-038), puis changement
 * d'époque avant le cycle suivant. La tête d'une autre époque n'est jamais publiée : l'intention est abandonnée, la file est gardée (ses
 * entrées repartent dans l'époque courante ; une même écriture reçue deux fois ne crée pas de conflit). Dépendances simulées, données synthétiques.
 */
const OLD = 'e-0001' as EpochId;
const CURRENT = 'e-0002' as EpochId;
const INFLIGHT: Inflight = { epoch: OLD, segment: 3, expect: 10, count: 2, maxHlc: '0000000000001:0000:aaaa' as Hlc, entries: [] };

function fakeDeps() {
  const meta = new Map<string, string | null>([['inflight', JSON.stringify(INFLIGHT)]]);
  const cleared: unknown[] = [];
  const repos = {
    sync: {
      clearPublished: async (entries: unknown) => void cleared.push(entries),
      getMeta: async (key: string) => meta.get(key) ?? null,
      setMeta: async (key: string, value: string | null) => void meta.set(key, value),
    },
  };
  const logger = createMemorySyncLogger();
  const deps = { data: { transaction: async <T>(work: (r: typeof repos) => Promise<T>) => work(repos) }, logger } as never;
  return { deps, meta, cleared, logger };
}

describe('BL-166 : intention d’ajout d’une époque passée', () => {
  it('époque changée : aucun état écrit, file gardée, intention abandonnée, journal explicite', async () => {
    const f = fakeDeps();
    const heads: unknown[] = [];
    await resolveInflight(f.deps, INFLIGHT, async (h) => (heads.push(h), true), CURRENT);
    expect(heads).toEqual([]);
    expect(f.cleared).toEqual([]);
    expect(f.meta.get('head') ?? null).toBeNull();
    expect(f.meta.get('inflight')).toBeNull();
    expect(f.logger.entries).toEqual([{ event: 'inflight-resolved', detail: { appended: false, staleEpoch: true } }]);
  });

  it('même époque : comportement inchangé (tête de l’intention écrite, file retirée)', async () => {
    const f = fakeDeps();
    const heads: { epoch: EpochId }[] = [];
    await resolveInflight(f.deps, INFLIGHT, async (h) => (heads.push(h), true), OLD);
    expect(heads.map((h) => h.epoch)).toEqual([OLD]);
    expect(f.cleared).toHaveLength(1);
    expect(JSON.parse(f.meta.get('head') ?? 'null')).toMatchObject({ epoch: OLD, segment: 3, record: 12 });
    expect(f.meta.get('inflight')).toBeNull();
    expect(f.logger.entries).toEqual([{ event: 'inflight-resolved', detail: { appended: true } }]);
  });
});
