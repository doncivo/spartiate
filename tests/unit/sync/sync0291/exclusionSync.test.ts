import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { IsoDateTime } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import { declareInjury } from '../../../../src/domain/training/injuries';
import type { LocalDate } from '../../../../src/domain/types';
import { loadInjuries, saveInjuries } from '../../../../src/features/settings/injuries/injuriesStore';
import { loadExcludedExercises, writeExcluded } from '../../../../src/features/training/exclusionsStore';
import { resetAllData } from '../../../../src/sync/dataReset';
import { createMemorySyncLogger } from '../../../../src/sync/log';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * SYNC-0291 (D-26, BL-109, D-447) : exercices écartés (« ne plus proposer ») communs au PC et à l'iPhone, table publiée `exercise_exclusion`.
 * Périmètre de non-régression : (a) écarté sur l'un → écarté sur l'autre, remis → proposé de nouveau ; (b) conflit : même exercice écarté des deux
 * côtés hors ligne (une ligne), écarté contre remis (dernière écriture) ; (c) reprise des réglages locaux des deux appareils : union, idempotente ;
 * (d) « Repartir de zéro » : les écartés de l'appareil qui efface survivent, republiés après l'horizon ; (e) appareil resté en 0.29.0 (sv 20) :
 * lignes gardées dans `sync_unknown`, réintégrées après la migration 0021. Horloges manuelles, aucun délai réel.
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
const excluded = (d: SimDevice) => loadExcludedExercises(d.data.repos);
const rows = (d: SimDevice) => d.driver.select('SELECT id, exercise_id, deleted_at IS NOT NULL AS gone FROM exercise_exclusion ORDER BY id');

describe('(a) écarté sur un appareil, écarté sur l’autre', () => {
  it('écarté sur l’iPhone → absent des propositions du PC ; remis sur le PC → proposé de nouveau sur l’iPhone', async () => {
    const [pc, iphone] = await pcAndIphone();
    await writeExcluded(iphone.data.repos, 'squat-barbell', true);
    await roundTrip();
    expect(await excluded(pc)).toEqual(['squat-barbell']);
    await writeExcluded(pc.data.repos, 'squat-barbell', false);
    await roundTrip();
    expect(await excluded(iphone)).toEqual([]);
    expect(await rows(pc)).toEqual(await rows(iphone));
    for (const d of [pc, iphone]) {
      expect(await d.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
      expect(await d.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    }
  });
});

describe('(b) conflits hors ligne', () => {
  it('même exercice écarté des deux côtés : une seule ligne ; remis d’un côté, écarté de nouveau plus tard de l’autre : écarté partout ; même conflict_log des deux côtés', async () => {
    const [pc, iphone] = await pcAndIphone();
    await writeExcluded(pc.data.repos, 'row-cable', true);
    iphone.clock.advance(500);
    await writeExcluded(iphone.data.repos, 'row-cable', true);
    await roundTrip();
    for (const d of [pc, iphone]) expect(await rows(d)).toEqual([{ id: 'exclusion|row-cable', exercise_id: 'row-cable', gone: 0 }]);
    await writeExcluded(pc.data.repos, 'row-cable', false);
    await writeExcluded(pc.data.repos, 'lunge-dumbbell', true);
    // L'iPhone (hors ligne) remet puis écarte de nouveau, plus tard que la remise du PC : sa dernière écriture gagne.
    await writeExcluded(iphone.data.repos, 'row-cable', false);
    iphone.clock.advance(5_000);
    await writeExcluded(iphone.data.repos, 'row-cable', true);
    await roundTrip();
    for (const d of [pc, iphone]) expect(await excluded(d)).toEqual(['lunge-dumbbell', 'row-cable']);
    const log = (d: SimDevice) => d.driver.select("SELECT table_name, row_id, field FROM conflict_log WHERE table_name = 'exercise_exclusion' ORDER BY row_id, field");
    expect(await log(pc)).toEqual(await log(iphone));
  });
});

describe('(b2) relecture 1, point 3 : critère 2 de la fiche, cas symétrique', () => {
  it('écarté d’un côté, remis plus tard de l’autre : remis partout', async () => {
    const [pc, iphone] = await pcAndIphone();
    await writeExcluded(pc.data.repos, 'row-cable', true);
    await roundTrip();
    // Hors ligne : le PC écarte de nouveau un autre exercice, l'iPhone remet row-cable plus tard.
    await writeExcluded(pc.data.repos, 'dip-bodyweight', true);
    iphone.clock.advance(5_000);
    await writeExcluded(iphone.data.repos, 'row-cable', false);
    await roundTrip();
    for (const d of [pc, iphone]) expect(await excluded(d)).toEqual(['dip-bodyweight']);
    expect(await rows(pc)).toEqual(await rows(iphone));
  });
});

describe('(c) reprise des réglages locaux des deux appareils (D-465)', () => {
  it('union, sans perte ni doublon ; rejouée sans effet ; réglages remis à null', async () => {
    const [pc, iphone] = await pcAndIphone();
    await pc.data.repos.settings.set('training.excludedExercises', { v: 1, ids: ['squat-barbell', 'row-cable'] });
    await iphone.data.repos.settings.set('training.excludedExercises', { v: 1, ids: ['row-cable', 'dip-bodyweight'] });
    expect(await excluded(pc)).toEqual(['row-cable', 'squat-barbell']);
    expect(await excluded(iphone)).toEqual(['dip-bodyweight', 'row-cable']);
    await roundTrip();
    for (const d of [pc, iphone]) {
      expect(await excluded(d)).toEqual(['dip-bodyweight', 'row-cable', 'squat-barbell']);
      expect(await d.data.repos.settings.get('training.excludedExercises')).toBeNull();
    }
    expect(await rows(pc)).toEqual(await rows(iphone));
    expect(await rows(pc)).toHaveLength(3);
  });
});

describe('(d) « Repartir de zéro » (D-466)', () => {
  it('les écartés de l’appareil qui efface survivent, republiés après l’horizon, vus de l’autre appareil ; les pesées partent', async () => {
    const [pc, iphone] = await pcAndIphone();
    await writeExcluded(pc.data.repos, 'squat-barbell', true);
    await writeExcluded(iphone.data.repos, 'row-cable', true);
    await roundTrip();
    pc.clock.advance(1_000);
    const outcome = await resetAllData(pc.data, SYNC_CATALOGUE, createMemorySyncLogger());
    expect(outcome.kind).toBe('done');
    expect(await excluded(pc)).toEqual(['row-cable', 'squat-barbell']);
    await roundTrip();
    await roundTrip();
    for (const d of [pc, iphone]) expect(await excluded(d), d.id).toEqual(['row-cable', 'squat-barbell']);
    expect(await rows(pc)).toEqual(await rows(iphone));
  });
});

describe('(e) appareil resté en 0.29.0 (sv 20, ADR 0011 §7.2)', () => {
  it('lignes reçues : aucune erreur, gardées dans sync_unknown ; réintégrées après la migration 0021', async () => {
    const [pc, iphone] = await pcAndIphone('v20');
    await writeExcluded(iphone.data.repos, 'squat-barbell', true);
    await roundTrip();
    expect((await pc.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name')).map((r) => r.table_name)).toEqual(['exercise_exclusion']);
    expect(await pc.driver.select("SELECT 1 FROM sqlite_master WHERE name = 'exercise_exclusion'")).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    await migrate(pc.driver, migrations);
    await reintegrateUnknownFields(pc.driver, { catalogue: SYNC_CATALOGUE, now: new Date(pc.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await rows(pc)).toEqual(await rows(iphone));
    expect(await rows(pc)).toEqual([{ id: 'exclusion|squat-barbell', exercise_id: 'squat-barbell', gone: 0 }]);
  });
});

describe('(e2) relecture 1, mineur : appareil en 0.29.0 qui rejoint par l’INSTANTANÉ (route de FIX-A009)', () => {
  it('écartés et gênes reçus par l’instantané : gardés dans sync_unknown, réintégrés après la migration 0021', async () => {
    // L'écrivain à jour est le PC (i0) ; l'iPhone resté en 0.29.0 (v20) rejoint ensuite par l'instantané (comme FIX-A009).
    const writer = await createSimDevice(PC, { name: 'PC', schema: 'i0' });
    const late = await createSimDevice(IPHONE, { name: 'iPhone', schema: 'v20', devicePlatform: 'ios', clock: createManualClock(writer.clock.nowMs()) });
    devices = [writer, late];
    await setupFirst(writer);
    await writer.cycle();
    await writeExcluded(writer.data.repos, 'squat-barbell', true);
    const r = declareInjury({ v: 1, items: [] }, { id: '20000000-0000-4000-8000-0000000000b1', muscleId: 'chest', patterns: [], startedOn: '2026-11-01' as LocalDate, note: null }, '2026-11-22' as LocalDate);
    if (!r.ok) throw new Error(r.issue);
    await saveInjuries(writer.data.repos, await loadInjuries(writer.data.repos), r.value);
    await writer.cycle();
    // Une semaine plus tard : instantané publié ; le PC rejoint ensuite, par cet instantané.
    writer.clock.advance(8 * 86_400_000);
    late.clock.advance(8 * 86_400_000);
    await writer.cycle();
    writer.clock.advance(11 * 60_000);
    late.clock.advance(11 * 60_000);
    await pair(writer, late);
    await late.cycle();
    expect((await late.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name')).map((x) => x.table_name)).toEqual(['exercise_exclusion', 'injury']);
    await migrate(late.driver, migrations);
    await reintegrateUnknownFields(late.driver, { catalogue: SYNC_CATALOGUE, now: new Date(late.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await late.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await rows(late)).toEqual(await rows(writer));
    expect(await late.driver.select('SELECT id FROM injury')).toEqual([{ id: '20000000-0000-4000-8000-0000000000b1' }]);
  });
});
