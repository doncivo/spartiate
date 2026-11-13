import { afterEach, describe, expect, it } from 'vitest';
import type { CardioSessionInput } from '../../../../src/domain/cardio';
import { createManualClock } from '../../../../src/domain/clock';
import { parseJournalRecord, journalRecordToText } from '../../../../src/domain/sync/parse';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { IsoDateTime } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import vectors from '../../../fixtures/sync/vectors.json';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * I6-06 (D-26, D-221, D-222) : publication de `cardio_session` (UUID), écrite par les DEUX appareils ; le tracé (`cardio_track`) ne quitte jamais
 * l'appareil. Périmètre de non-régression : (a) séance saisie sur un appareil reçue par l'autre, tracé absent de l'autre ; (b) conflit : la même
 * séance modifiée des deux côtés hors ligne, fusion champ par champ (dernière écriture gagne par champ) ; suppression contre modification ;
 * (c) appareil resté au schéma précédent (ADR 0011 §7.2) : lignes gardées dans `sync_unknown`, réintégrées après la migration 0018 ; (d) vecteur chiffré.
 * Horloges manuelles, aucun délai réel ; positions synthétiques.
 */

const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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
const cardio = async (d: SimDevice) => d.data.repos.cardio();
const startOf = (d: SimDevice): string => new Date(d.clock.nowMs() - 3_600_000).toISOString();
const input = (d: SimDevice, over: Partial<CardioSessionInput> = {}): CardioSessionInput => ({
  kind: 'run', startedAt: startOf(d), durationSec: 2700, distanceM: 7500, avgHr: 150, rpe: 7, notes: '', source: 'manual', ...over,
});
const rows = (d: SimDevice) => d.driver.select('SELECT id, kind, duration_sec, distance_m, rpe, notes, deleted_at IS NOT NULL AS gone FROM cardio_session ORDER BY id');

describe('(a) séances cardio : les deux appareils écrivent ; le tracé reste sur l’iPhone', () => {
  it('séance GPS de l’iPhone reçue par le PC (durée et distance), sans tracé ; séance du PC reçue par l’iPhone', async () => {
    const [pc, iphone] = await pcAndIphone();
    const track = [0, 1, 2].map((i) => ({ lat: i * 0.001, lon: 0, at: iphone.clock.nowMs() - 3_600_000 + i * 30_000, accuracyM: 5 }));
    const fromPhone = await (await cardio(iphone)).add(input(iphone, { source: 'gps', distanceM: 222 }), track);
    pc.clock.advance(2_000);
    const fromPc = await (await cardio(pc)).add(input(pc, { kind: 'bike', distanceM: null }));
    await roundTrip();
    for (const d of [pc, iphone]) {
      expect((await (await cardio(d)).list()).map((s) => s.id).sort()).toEqual([fromPhone, fromPc].sort());
      expect(await d.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
      expect(await d.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    }
    expect((await (await cardio(pc)).get(fromPhone))).toMatchObject({ source: 'gps', distanceM: 222, durationSec: 2700, hasTrack: false });
    expect(await (await cardio(pc)).track(fromPhone)).toBeNull();
    expect(await pc.driver.select('SELECT 1 FROM cardio_track')).toEqual([]);
    expect(await (await cardio(iphone)).track(fromPhone)).toHaveLength(3);
  });
});

describe('(b) conflits : la même séance touchée des deux côtés hors ligne', () => {
  it('ressenti modifié sur le PC, notes sur l’iPhone : les deux champs gardés partout (fusion par champ)', async () => {
    const [pc, iphone] = await pcAndIphone();
    const id = await (await cardio(pc)).add(input(pc));
    await roundTrip();
    pc.clock.advance(1_000);
    await (await cardio(pc)).update(id, input(pc, { startedAt: (await (await cardio(pc)).get(id))?.startedAt ?? '', rpe: 9 }));
    iphone.clock.advance(2_000);
    const base = await (await cardio(iphone)).get(id);
    await (await cardio(iphone)).update(id, input(iphone, { startedAt: base?.startedAt ?? '', notes: 'vent de face' }));
    await roundTrip();
    for (const d of [pc, iphone]) expect((await (await cardio(d)).get(id))).toMatchObject({ rpe: 9, notes: 'vent de face' });
    expect(await rows(pc)).toEqual(await rows(iphone));
  });

  it('même champ modifié des deux côtés : la dernière écriture gagne, convergence ; suppression plus récente qu’une modification : supprimée partout', async () => {
    const [pc, iphone] = await pcAndIphone();
    const id = await (await cardio(pc)).add(input(pc));
    await roundTrip();
    const start = (await (await cardio(pc)).get(id))?.startedAt ?? '';
    await (await cardio(pc)).update(id, input(pc, { startedAt: start, durationSec: 3000 }));
    iphone.clock.advance(5_000);
    await (await cardio(iphone)).update(id, input(iphone, { startedAt: start, durationSec: 3300 }));
    await roundTrip();
    for (const d of [pc, iphone]) expect((await (await cardio(d)).get(id))?.durationSec).toBe(3300);
    await (await cardio(iphone)).update(id, input(iphone, { startedAt: start, durationSec: 3300, rpe: 4 }));
    pc.clock.advance(5_000);
    await (await cardio(pc)).remove(id);
    await roundTrip();
    for (const d of [pc, iphone]) expect(await (await cardio(d)).get(id)).toBeNull();
    expect(await rows(pc)).toEqual(await rows(iphone));
  });
});

describe('(c) appareil resté au schéma précédent (ADR 0011 §7.2)', () => {
  it('lignes reçues : aucune erreur, gardées dans sync_unknown ; réintégrées après la migration 0018', async () => {
    const [pc, iphone] = await pcAndIphone('v17');
    const id = await (await cardio(iphone)).add(input(iphone));
    await roundTrip();
    expect((await pc.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name')).map((r) => r.table_name)).toEqual(['cardio_session']);
    expect(await pc.driver.select("SELECT 1 FROM sqlite_master WHERE name = 'cardio_session'")).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    await migrate(pc.driver, migrations);
    await reintegrateUnknownFields(pc.driver, { catalogue: SYNC_CATALOGUE, now: new Date(pc.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await rows(pc)).toEqual(await rows(iphone));
    expect((await rows(pc)).map((r) => (r as { id: string }).id)).toEqual([id]);
  });
});

describe('(d) vecteur chiffré (tests/fixtures/sync/vectors.json)', () => {
  it('journal-ops-cardio-session : opérations valides pour le catalogue, forme canonique stable, aucune position', () => {
    const record = vectors.records.find((r) => r.name === 'journal-ops-cardio-session');
    if (!record || !('json' in record.plaintext)) throw new Error('vecteur journal-ops-cardio-session absent');
    expect(record.sv).toBe(18);
    const parsed = parseJournalRecord(record.plaintext.json);
    if (!parsed || parsed.k !== 'ops') throw new Error('vecteur illisible');
    expect(parsed.sv).toBe(18);
    expect(parsed.ops.map((op) => op.t)).toEqual(['cardio_session']);
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
    expect(record.plaintext.json).not.toMatch(/lat|lon|track|points/);
    expect(journalRecordToText(parsed)).toBe(record.plaintext.json);
  });
});
