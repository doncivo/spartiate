import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { parseJournalRecord, journalRecordToText } from '../../../../src/domain/sync/parse';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { IsoDateTime } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import { loadFavorites } from '../../../../src/features/nutrition/search/favoritesStore';
import vectors from '../../../fixtures/sync/vectors.json';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * FIX-0181 (D-26 ; D-171 : D-79 révisée par Ali le 12/11, favoris synchronisés) : publication de `food_favorite` (`favorite|<ref>`), écrite par les
 * DEUX appareils. Périmètre de non-régression : (a) favori posé sur un appareil reçu par l'autre ; (b) même favori posé des deux côtés hors ligne :
 * une seule ligne ; (c) conflits : suppression d'un favori sur un appareil et ajout sur l'autre (autre favori, ou le même rétabli plus tard), dernière
 * écriture gagne, convergence ; (d) reprise des favoris locaux des deux appareils : union, sans perte ni doublon ; (e) appareil resté en schéma 14
 * (ADR 0011 §7.2) : lignes gardées dans `sync_unknown`, réintégrées après la migration 0015 ; (f) vecteur chiffré.
 */

const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const U = (n: number): string => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function pcAndIphone(schemaPc: SimSchema = 'i0'): Promise<[SimDevice, SimDevice]> {
  const pc = await createSimDevice(PC, { name: 'PC', schema: schemaPc });
  const iphone = await createSimDevice(IPHONE, { name: 'iPhone', schema: 'i0', devicePlatform: 'ios', clock: createManualClock(pc.clock.nowMs()) });
  devices = [pc, iphone];
  await setupFirst(pc);
  await pc.cycle();
  await pair(pc, iphone);
  await iphone.cycle();
  syncFolders(devices);
  await pc.cycle();
  return [pc, iphone];
}
async function roundTrip(list: readonly SimDevice[] = devices): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    for (const d of list) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(list);
  }
}
const favorites = async (d: SimDevice) => d.data.repos.foodFavorites();
const refs = async (d: SimDevice) => (await (await favorites(d)).list()).map((f) => f.ref);
const rows = (d: SimDevice) => d.driver.select('SELECT id, source, ref, deleted_at IS NOT NULL AS gone FROM food_favorite ORDER BY id');

describe('(a) favoris : les deux appareils écrivent', () => {
  it('favori du PC reçu par l’iPhone et inversement, rien d’inconnu ni de parqué', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await favorites(pc)).add({ source: 'ciqual', ref: 'ciqual:20' });
    iphone.clock.advance(2_000);
    await (await favorites(iphone)).add({ source: 'custom', ref: U(1) });
    await roundTrip();
    for (const d of [pc, iphone]) {
      expect(await refs(d)).toEqual([U(1), 'ciqual:20']);
      expect(await d.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
      expect(await d.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    }
  });
});

describe('(b) même favori posé sur les deux appareils hors ligne', () => {
  it('une seule ligne, vivante, sur les deux', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await favorites(pc)).add({ source: 'ciqual', ref: 'ciqual:20' });
    iphone.clock.advance(5_000);
    await (await favorites(iphone)).add({ source: 'ciqual', ref: 'ciqual:20' });
    await roundTrip();
    const a = await rows(pc);
    expect(a).toEqual(await rows(iphone));
    expect(a).toEqual([{ id: 'favorite|ciqual:20', source: 'ciqual', ref: 'ciqual:20', gone: 0 }]);
  });
});

describe('(c) conflits : suppression sur un appareil, ajout sur l’autre', () => {
  it('suppression d’un favori sur le PC, ajout d’un autre sur l’iPhone, hors ligne : les deux gestes sont gardés partout', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await favorites(pc)).add({ source: 'ciqual', ref: 'ciqual:20' });
    await roundTrip();
    pc.clock.advance(1_000);
    await (await favorites(pc)).remove('ciqual:20');
    iphone.clock.advance(2_000);
    await (await favorites(iphone)).add({ source: 'custom', ref: U(2) });
    await roundTrip();
    for (const d of [pc, iphone]) expect(await refs(d)).toEqual([U(2)]);
    expect(await rows(pc)).toEqual(await rows(iphone));
  });

  it('même favori : supprimé sur le PC, puis rétabli PLUS TARD sur l’iPhone hors ligne : rétabli partout (dernière écriture gagne)', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await favorites(pc)).add({ source: 'ciqual', ref: 'ciqual:20' });
    await roundTrip();
    await (await favorites(iphone)).remove('ciqual:20');
    pc.clock.advance(1_000);
    await (await favorites(pc)).remove('ciqual:20');
    iphone.clock.advance(5_000);
    await (await favorites(iphone)).add({ source: 'ciqual', ref: 'ciqual:20' });
    await roundTrip();
    for (const d of [pc, iphone]) expect(await refs(d)).toEqual(['ciqual:20']);
    expect(await rows(pc)).toEqual(await rows(iphone));
  });

  it('même favori : rétabli sur l’iPhone, puis supprimé PLUS TARD sur le PC hors ligne : supprimé partout', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await favorites(pc)).add({ source: 'ciqual', ref: 'ciqual:20' });
    await roundTrip();
    await (await favorites(iphone)).remove('ciqual:20');
    await roundTrip();
    await (await favorites(iphone)).add({ source: 'ciqual', ref: 'ciqual:20' });
    // Le PC, hors ligne, rétablit puis retire le même favori après le geste de l'iPhone : son retrait est la dernière écriture.
    pc.clock.advance(5_000);
    await (await favorites(pc)).add({ source: 'ciqual', ref: 'ciqual:20' });
    pc.clock.advance(1_000);
    await (await favorites(pc)).remove('ciqual:20');
    await roundTrip();
    for (const d of [pc, iphone]) expect(await refs(d)).toEqual([]);
    expect(await rows(pc)).toEqual(await rows(iphone));
  });
});

describe('(d) reprise des favoris locaux des deux appareils (D-79 → D-171)', () => {
  it('chaque appareil reprend une fois ses favoris locaux ; après synchro : l’union, sans doublon ; le réglage local est vidé', async () => {
    const [pc, iphone] = await pcAndIphone();
    await pc.data.repos.settings.set('nutrition.favorites', { v: 1, items: [{ source: 'ciqual', ref: 'ciqual:20' }, { source: 'custom', ref: U(1) }] });
    await iphone.data.repos.settings.set('nutrition.favorites', { v: 1, items: [{ source: 'ciqual', ref: 'ciqual:20' }, { source: 'ciqual', ref: 'ciqual:30' }] });
    for (const d of [pc, iphone]) {
      const read = await loadFavorites(d.data.repos);
      expect(read.ok).toBe(true);
      expect(await d.data.repos.settings.get('nutrition.favorites')).toBeNull();
    }
    await roundTrip();
    for (const d of [pc, iphone]) {
      expect([...(await refs(d))].sort()).toEqual([U(1), 'ciqual:20', 'ciqual:30'].sort());
      expect(await d.driver.select('SELECT COUNT(*) AS n FROM food_favorite')).toEqual([{ n: 3 }]);
    }
  });
});

describe('(e) appareil resté en schéma 14 (ADR 0011 §7.2)', () => {
  it('lignes reçues : aucune erreur, gardées dans sync_unknown ; réintégrées après la migration 0015', async () => {
    const [pc, iphone] = await pcAndIphone('v14');
    await (await favorites(iphone)).add({ source: 'ciqual', ref: 'ciqual:20' });
    await roundTrip();
    expect((await pc.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name')).map((r) => r.table_name)).toEqual(['food_favorite']);
    expect(await pc.driver.select("SELECT 1 FROM sqlite_master WHERE name = 'food_favorite'")).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    await migrate(pc.driver, migrations);
    await reintegrateUnknownFields(pc.driver, { catalogue: SYNC_CATALOGUE, now: new Date(pc.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await rows(pc)).toEqual([{ id: 'favorite|ciqual:20', source: 'ciqual', ref: 'ciqual:20', gone: 0 }]);
  });
});

describe('(f) vecteur chiffré (tests/fixtures/sync/vectors.json)', () => {
  it('journal-ops-food-favorite : opérations valides pour le catalogue, forme canonique stable', () => {
    const record = vectors.records.find((r) => r.name === 'journal-ops-food-favorite');
    if (!record || !('json' in record.plaintext)) throw new Error('vecteur journal-ops-food-favorite absent');
    expect(record.sv).toBe(15);
    const parsed = parseJournalRecord(record.plaintext.json);
    if (!parsed || parsed.k !== 'ops') throw new Error('vecteur illisible');
    expect(parsed.sv).toBe(15);
    expect(parsed.ops.map((op) => [op.t, op.id])).toEqual([['food_favorite', 'favorite|ciqual:20']]);
    for (const op of parsed.ops) {
      const t = SYNC_CATALOGUE.table(op.t);
      if (!t) throw new Error(op.t);
      expect(SYNC_CATALOGUE.isValidRowId(t, op.id)).toBe(true);
      expect([...op.f.keys()].sort()).toEqual([...publishedColumns(t)].sort());
      for (const [col, [value]] of op.f) {
        const c = SYNC_CATALOGUE.column(op.t, col);
        expect(c && SYNC_CATALOGUE.isValidValue(c, value), `${op.t}.${col}`).toBe(true);
      }
    }
    expect(journalRecordToText(parsed)).toBe(record.plaintext.json);
  });
});
