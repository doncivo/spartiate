import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { declareInjury, injuryAvoidance, markHealed, recordCheckin, type InjuriesValue } from '../../../../src/domain/training/injuries';
import type { IsoDateTime, LocalDate } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import { loadInjuries, saveInjuries } from '../../../../src/features/settings/injuries/injuriesStore';
import { resetAllData } from '../../../../src/sync/dataReset';
import { createMemorySyncLogger } from '../../../../src/sync/log';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * SYNC-0291 (D-26, BL-120, D-447, D-464) : gênes déclarées communes au PC et à l'iPhone, table publiée `injury` (UUID). Périmètre de non-régression :
 * (a) gêne déclarée sur l'un → vue et évitée sur l'autre ; « Guérie » propagée ; (b) conflit hors ligne : réponse au check-in d'un côté, « Guérie » de
 * l'autre (fusion par champ, convergence, rien au journal des conflits) ; (c) reprise des réglages locaux des deux appareils : union, idempotente ;
 * (d) « Repartir de zéro » : gênes effacées partout ; (e) appareil resté en 0.29.0 : lignes gardées dans `sync_unknown`, réintégrées après la 0021.
 * Notes synthétiques ; horloges manuelles.
 */
const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TODAY = '2026-11-22' as LocalDate;
const U = (n: number): string => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BENCH = { id: 'bench-press-barbell', pattern: 'push-horizontal' as const, muscles: [{ id: 'chest', weight: 1 }] };
const ROW = { id: 'row-barbell', pattern: 'pull-horizontal' as const, muscles: [{ id: 'lats', weight: 1 }] };

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
const load = (d: SimDevice) => loadInjuries(d.data.repos);
const declare = async (d: SimDevice, id: string, muscleId: string): Promise<InjuriesValue> => {
  const before = await load(d);
  const r = declareInjury(before, { id, muscleId, patterns: [], startedOn: '2026-11-01' as LocalDate, note: 'note synthétique' }, TODAY);
  if (!r.ok) throw new Error(r.issue);
  await saveInjuries(d.data.repos, before, r.value);
  return r.value;
};
const rows = (d: SimDevice) => d.driver.select('SELECT id, muscle_id, patterns, started_on, note, status, healed_on, checkins, deleted_at IS NOT NULL AS gone FROM injury ORDER BY id');

describe('(a) gêne déclarée sur un appareil, vue et évitée sur l’autre', () => {
  it('déclarée sur l’iPhone → listée sur le PC, le développé couché évité ; guérie sur le PC → plus évitée sur l’iPhone', async () => {
    const [pc, iphone] = await pcAndIphone();
    await declare(iphone, U(1), 'chest');
    await roundTrip();
    const onPc = await load(pc);
    expect(onPc.items.map((i) => [i.id, i.muscleId, i.status, i.note])).toEqual([[U(1), 'chest', 'active', 'note synthétique']]);
    expect(injuryAvoidance(onPc, [BENCH, ROW]).exerciseIds).toEqual(['bench-press-barbell']);
    await saveInjuries(pc.data.repos, onPc, markHealed(onPc, U(1), TODAY));
    await roundTrip();
    const onPhone = await load(iphone);
    expect(onPhone.items[0]).toMatchObject({ status: 'healed', healedOn: TODAY });
    expect(injuryAvoidance(onPhone, [BENCH, ROW]).exerciseIds).toEqual([]);
    expect(await rows(pc)).toEqual(await rows(iphone));
    for (const d of [pc, iphone]) {
      expect(await d.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
      expect(await d.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    }
  });
});

describe('(b) conflit hors ligne', () => {
  it('« Pareil » sur le PC, « Guérie » plus tard sur l’iPhone : convergence sur la plus récente, rien au journal des conflits (donnée de santé)', async () => {
    const [pc, iphone] = await pcAndIphone();
    await declare(pc, U(2), 'quads');
    await roundTrip();
    const a = await load(pc);
    await saveInjuries(pc.data.repos, a, recordCheckin(a, U(2), 'same', TODAY));
    iphone.clock.advance(5_000);
    const b = await load(iphone);
    await saveInjuries(iphone.data.repos, b, recordCheckin(b, U(2), 'healed', TODAY));
    await roundTrip();
    for (const d of [pc, iphone]) expect((await load(d)).items[0]).toMatchObject({ status: 'healed', healedOn: TODAY, checkins: [{ on: TODAY, answer: 'healed' }] });
    expect(await rows(pc)).toEqual(await rows(iphone));
    for (const d of [pc, iphone]) expect(await d.driver.select("SELECT 1 FROM conflict_log WHERE table_name = 'injury'")).toEqual([]);
  });

  it('note modifiée sur le PC, guérie sur l’iPhone : les deux champs gardés partout (fusion par champ)', async () => {
    const [pc, iphone] = await pcAndIphone();
    await declare(pc, U(7), 'chest');
    await roundTrip();
    const a = await load(pc);
    await saveInjuries(pc.data.repos, a, { v: 1, items: a.items.map((i) => ({ ...i, note: 'autre note' })) });
    iphone.clock.advance(2_000);
    const b = await load(iphone);
    await saveInjuries(iphone.data.repos, b, markHealed(b, U(7), TODAY));
    await roundTrip();
    for (const d of [pc, iphone]) expect((await load(d)).items[0]).toMatchObject({ note: 'autre note', status: 'healed' });
  });
});

describe('(c) reprise des réglages locaux des deux appareils (D-465)', () => {
  it('union des gênes des deux appareils, sans doublon ; réglages remis à null', async () => {
    const [pc, iphone] = await pcAndIphone();
    const mk = (id: string, muscleId: string): InjuriesValue => {
      const r = declareInjury({ v: 1, items: [] }, { id, muscleId, patterns: [], startedOn: '2026-11-01' as LocalDate, note: null }, TODAY);
      if (!r.ok) throw new Error(r.issue);
      return r.value;
    };
    await pc.data.repos.settings.set('training.injuries', mk('g1', 'chest'));
    await iphone.data.repos.settings.set('training.injuries', mk(U(5), 'lats'));
    expect((await load(pc)).items).toHaveLength(1);
    expect((await load(iphone)).items).toHaveLength(1);
    await roundTrip();
    for (const d of [pc, iphone]) {
      expect((await load(d)).items.map((i) => i.muscleId).sort()).toEqual(['chest', 'lats']);
      expect(await d.data.repos.settings.get('training.injuries')).toBeNull();
    }
    expect(await rows(pc)).toEqual(await rows(iphone));
  });
});

describe('(d) « Repartir de zéro » (D-466)', () => {
  it('gênes effacées sur les deux appareils', async () => {
    const [pc, iphone] = await pcAndIphone();
    await declare(pc, U(3), 'chest');
    await declare(iphone, U(4), 'lats');
    await roundTrip();
    pc.clock.advance(1_000);
    expect((await resetAllData(pc.data, SYNC_CATALOGUE, createMemorySyncLogger())).kind).toBe('done');
    await roundTrip();
    await roundTrip();
    for (const d of [pc, iphone]) expect(await d.driver.select('SELECT 1 FROM injury')).toEqual([]);
  });
});

describe('(e) appareil resté en 0.29.0 (sv 20, ADR 0011 §7.2)', () => {
  it('lignes reçues : aucune erreur, gardées dans sync_unknown ; réintégrées après la migration 0021', async () => {
    const [pc, iphone] = await pcAndIphone('v20');
    await declare(iphone, U(6), 'chest');
    await roundTrip();
    expect((await pc.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name')).map((r) => r.table_name)).toEqual(['injury']);
    expect(await pc.driver.select("SELECT 1 FROM sqlite_master WHERE name = 'injury'")).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    await migrate(pc.driver, migrations);
    await reintegrateUnknownFields(pc.driver, { catalogue: SYNC_CATALOGUE, now: new Date(pc.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await rows(pc)).toEqual(await rows(iphone));
    expect(await rows(pc)).toHaveLength(1);
  });
});
