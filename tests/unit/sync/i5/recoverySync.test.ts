import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { epochId, SYNC_TABLE_ORDER, type DeviceAck, type SyncField, type SyncOp } from '../../../../src/domain/sync/format';
import { parseJournalRecord, journalRecordToText } from '../../../../src/domain/sync/parse';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { RecoveryDayOutput } from '../../../../src/domain/recovery';
import type { DeviceId, Hlc, IsoDateTime, LocalDate } from '../../../../src/domain/types';
import { applyOps, type ApplyContext } from '../../../../src/sync/apply';
import { guarded } from '../../../../src/sync/guarded';
import { createMemorySyncLogger } from '../../../../src/sync/log';
import { snapshotPages } from '../../../../src/sync/snapshot';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { CAPTURE_TABLES_V10 } from '../../../../src/db/migrations/0010_recovery';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import { carryKindText } from '../../../../src/features/sync/carryReportText';
import vectors from '../../../fixtures/sync/vectors.json';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * I5-01 (D-26 ; § 9.1, § 16.4, § 16.6, § 20.2) : publication de `recovery_day` (`recovery|AAAA-MM-JJ`) et `muscle_recovery`
 * (`muscle|AAAA-MM-JJ|<muscle>`), écrites par l'iPhone SEUL ; le PC les reçoit et les affiche, sans recalcul ni écriture locale. Les
 * échantillons (`recovery_sample`, `recovery_import_state`) restent locaux. Périmètre de non-régression : (a) catalogue exact = copie figée de
 * la 0010 ; (b) iPhone → PC, suppression, restauration ; (c) écriture locale du PC ignorée, lignes reçues écrites ; (d) vecteurs d'application :
 * ordre indifférent, idempotence, dernière écriture HLC gagne, suppression logique respectée ; (e) instantané ; (f) appareil resté en schéma 9 ;
 * (g) aucune valeur corporelle dans un journal (journal technique, journal des conflits) ; (h) vecteur chiffré `recovery_day`.
 */

const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DAY = '2026-11-09' as LocalDate;
const DAY2 = '2026-11-10' as LocalDate;
/** Valeurs synthétiques reconnaissables (jamais une donnée réelle, D-38) : cherchées dans les journaux. */
const HRV = 61.37;
const RHR = 47.21;

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

/** Le PC (lecteur) crée le dossier et montre la clé (fenêtre `pairing`, PC seulement) ; l'iPhone (écrivain) s'y associe. Rend [iPhone, PC]. */
async function iphoneAndPc(schemaPc: SimSchema = 'i0', beforePair: (iphone: SimDevice) => Promise<void> = async () => undefined): Promise<[SimDevice, SimDevice]> {
  const pc = await createSimDevice(PC, { name: 'PC', schema: schemaPc });
  const iphone = await createSimDevice(IPHONE, { name: 'iPhone', schema: 'i0', devicePlatform: 'ios', clock: createManualClock(pc.clock.nowMs()) });
  devices = [iphone, pc];
  await setupFirst(pc);
  await pc.cycle();
  await beforePair(iphone);
  await pair(pc, iphone);
  await iphone.cycle();
  syncFolders(devices);
  await pc.cycle();
  return [iphone, pc];
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

const output = (day: LocalDate = DAY, over: Partial<RecoveryDayOutput['summary']> = {}): RecoveryDayOutput => ({
  summary: {
    day, level: 'C', recovery: 72, abstainReason: null, quality: 'good', exertion: 4.5, exertionPrevDay: 2, sleepMinutes: 450, sleepNeedMinutes: 480, sleepScore: 94,
    bedtimeSigmaMinutes: 22.5, targetZone: { from: 6, to: 8 }, hrvMs: HRV, restingHr: RHR, learningNights: 14,
    contributors: [{ key: 'hrv', value: 0.4, weight: 0.7 }], explanationKeys: ['exertion_cardio_not_counted'], computedAt: '2026-11-09T07:00:00.000Z', ...over,
  },
  muscles: [
    { day, muscleId: 'lats', group: 'Dos', percent: 30, hours: 72, lastWorkedAt: '2026-11-08T18:00:00.000Z', readyAt: '2026-11-11T18:00:00.000Z' },
    { day, muscleId: 'quads', group: 'Jambes', percent: 40, hours: 96, lastWorkedAt: '2026-11-08T18:00:00.000Z', readyAt: '2026-11-12T18:00:00.000Z' },
  ],
});
const count = async (d: SimDevice, table: string): Promise<number> => Number((await d.driver.select<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))[0]?.n);
const recoveryOutbox = (d: SimDevice) => d.driver.select("SELECT table_name, row_id, field FROM sync_outbox WHERE table_name IN ('recovery_day', 'muscle_recovery') ORDER BY seq");
const dayRow = (d: SimDevice, id = `recovery|${DAY}`) => d.driver.select('SELECT id, date, level, recovery, abstain_reason, hrv_ms, resting_hr, deleted_at IS NOT NULL AS gone FROM recovery_day WHERE id = ?', [id]);

describe('(a) catalogue de production : recovery_day et muscle_recovery (I5-01)', () => {
  it('deux tables à la fin de l’ordre, identifiant naturel, aucun parent ni colonne locale', () => {
    expect(SYNC_TABLE_ORDER.slice(-3, -1)).toEqual(['recovery_day', 'muscle_recovery']); // recovery_factor (I6-01) vient après
    expect(SYNC_TABLE_ORDER).toHaveLength(22);
    for (const name of ['recovery_day', 'muscle_recovery']) {
      const t = SYNC_CATALOGUE.table(name);
      if (!t) throw new Error(name);
      expect(t.idKind, name).toBe('natural');
      expect(t.parents, name).toEqual([]);
      expect(t.local, name).toEqual([]);
      expect(t.publishWhen, name).toBeUndefined();
    }
  });

  it('copie figée de la migration 0010 = catalogue vivant (colonnes et ordre)', () => {
    expect(CAPTURE_TABLES_V10.map(([name]) => name)).toEqual(['recovery_day', 'muscle_recovery']);
    for (const [name, columns] of CAPTURE_TABLES_V10) {
      const t = SYNC_CATALOGUE.table(name);
      if (!t) throw new Error(`${name} absent du catalogue`);
      expect([...publishedColumns(t)], name).toEqual([...columns]);
    }
  });

  it('les échantillons et l’état d’import restent locaux : hors du catalogue', () => {
    for (const name of ['recovery_sample', 'recovery_import_state']) expect(SYNC_CATALOGUE.table(name), name).toBeUndefined();
  });

  it('identifiants : forme naturelle seulement, aucun repli UUID ; identifiant attendu des valeurs', () => {
    const day = SYNC_CATALOGUE.table('recovery_day');
    const muscle = SYNC_CATALOGUE.table('muscle_recovery');
    if (!day || !muscle) throw new Error('catalogue');
    expect(SYNC_CATALOGUE.isValidRowId(day, 'recovery|2026-11-09')).toBe(true);
    expect(SYNC_CATALOGUE.isValidRowId(muscle, 'muscle|2026-11-09|quads')).toBe(true);
    for (const bad of ['recovery|2026-13-09', 'day|2026-11-09', IPHONE, 'muscle|2026-11-09|quads']) expect(SYNC_CATALOGUE.isValidRowId(day, bad), bad).toBe(false);
    for (const bad of ['muscle|2026-11-09|', 'muscle|2026-11-09|a|b', IPHONE, 'recovery|2026-11-09']) expect(SYNC_CATALOGUE.isValidRowId(muscle, bad), bad).toBe(false);
    expect(day.natural?.expected(new Map([['date', DAY]]))).toBe('recovery|2026-11-09');
    expect(muscle.natural?.expected(new Map([['date', DAY], ['muscle_id', 'quads']]))).toBe('muscle|2026-11-09|quads');
  });

  it('estimations recalculées : seuls les champs de suppression sont visibles au journal des conflits (aucune valeur corporelle n’y entre)', () => {
    for (const name of ['recovery_day', 'muscle_recovery']) {
      const t = SYNC_CATALOGUE.table(name);
      if (!t) throw new Error(name);
      expect(t.columns.filter((c) => c.conflictVisible).map((c) => c.name), name).toEqual(['deleted_at']);
    }
  });

  it('types et listes fermées', () => {
    const col = (t: string, c: string) => {
      const x = SYNC_CATALOGUE.column(t, c);
      if (!x) throw new Error(`${t}.${c}`);
      return x;
    };
    const ok = (t: string, c: string, v: unknown) => SYNC_CATALOGUE.isValidValue(col(t, c), v);
    for (const v of ['A', 'B', 'C']) expect(ok('recovery_day', 'level', v)).toBe(true);
    expect(ok('recovery_day', 'level', 'D')).toBe(false);
    for (const v of ['good', 'partial', 'insufficient']) expect(ok('recovery_day', 'quality', v)).toBe(true);
    expect(ok('recovery_day', 'quality', null)).toBe(false);
    for (const v of ['measure_missing_hrv', 'measure_missing_rhr', 'baseline_incomplete', 'zero_variance', null]) expect(ok('recovery_day', 'abstain_reason', v)).toBe(true);
    expect(ok('recovery_day', 'abstain_reason', 'other')).toBe(false);
    for (const c of ['recovery', 'sleep_minutes', 'sleep_score', 'bedtime_sigma_minutes', 'target_zone_from', 'target_zone_to', 'hrv_ms', 'resting_hr']) expect(ok('recovery_day', c, null), c).toBe(true);
    for (const c of ['exertion', 'exertion_prev_day', 'sleep_need_minutes', 'learning_nights', 'contributors', 'explanation_keys', 'computed_at', 'engine_version']) expect(ok('recovery_day', c, null), c).toBe(false);
    expect(ok('recovery_day', 'recovery', 72.5)).toBe(false);
    expect(ok('recovery_day', 'contributors', '[]')).toBe(true);
    expect(ok('recovery_day', 'contributors', '{nope')).toBe(false);
    expect(ok('recovery_day', 'computed_at', '2026-11-09T07:00:00.000Z')).toBe(true);
    expect(ok('recovery_day', 'computed_at', 'hier')).toBe(false);
    expect(ok('muscle_recovery', 'muscle_id', 'm'.repeat(64))).toBe(true);
    expect(ok('muscle_recovery', 'muscle_id', 'm'.repeat(65))).toBe(false);
    expect(ok('muscle_recovery', 'percent', 40)).toBe(true);
    expect(ok('muscle_recovery', 'percent', 40.5)).toBe(false);
    expect(ok('muscle_recovery', 'ready_at', '2026-11-12T18:00:00.000Z')).toBe(true);
    expect(ok('muscle_recovery', 'ready_at', null)).toBe(false);
  });
});

describe('(b) iPhone → PC', () => {
  it('résumé et muscles écrits sur l’iPhone : identiques sur le PC, rien en file côté PC, rien d’inconnu', async () => {
    const [iphone, pc] = await iphoneAndPc();
    const saved = await (await iphone.data.repos.recovery()).saveDay(output());
    expect(saved?.day.id).toBe('recovery|2026-11-09');
    await roundTrip();
    const onPc = await (await pc.data.repos.recovery()).getDay(DAY);
    expect(onPc?.summary).toEqual(output().summary);
    expect(onPc?.deviceId).toBe(IPHONE);
    expect((await (await pc.data.repos.recovery()).listMuscles(DAY)).map((m) => [m.id, m.percent, m.hours])).toEqual([
      ['muscle|2026-11-09|lats', 30, 72],
      ['muscle|2026-11-09|quads', 40, 96],
    ]);
    for (const table of ['recovery_day', 'muscle_recovery']) expect([table, await count(pc, table)]).toEqual([table, await count(iphone, table)]);
    expect(await recoveryOutbox(pc)).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
  });

  it('jour recalculé (muscle disparu), puis supprimé, puis rétabli sur l’iPhone : suivi sur le PC', async () => {
    const [iphone, pc] = await iphoneAndPc();
    const repo = await iphone.data.repos.recovery();
    await repo.saveDay(output());
    await roundTrip();
    const base = output();
    await repo.saveDay({ summary: { ...base.summary, recovery: 55 }, muscles: base.muscles.slice(1) });
    await roundTrip();
    expect((await (await pc.data.repos.recovery()).getDay(DAY))?.summary.recovery).toBe(55);
    expect((await (await pc.data.repos.recovery()).listMuscles(DAY)).map((m) => m.muscleId)).toEqual(['quads']);
    await repo.deleteDay(DAY);
    await roundTrip();
    expect(await (await pc.data.repos.recovery()).getDay(DAY)).toBeNull();
    expect(await (await pc.data.repos.recovery()).listMuscles(DAY)).toEqual([]);
    await repo.saveDay(output());
    await roundTrip();
    expect((await (await pc.data.repos.recovery()).getDay(DAY))?.summary.recovery).toBe(72);
    expect((await (await pc.data.repos.recovery()).listMuscles(DAY)).map((m) => m.muscleId)).toEqual(['lats', 'quads']);
  });

  it('recalcul identique sur l’iPhone (seul l’instant de calcul change) : rien n’est republié', async () => {
    const [iphone] = await iphoneAndPc();
    const repo = await iphone.data.repos.recovery();
    await repo.saveDay(output());
    await roundTrip();
    expect(await recoveryOutbox(iphone)).toEqual([]);
    await repo.saveDay(output(DAY, { computedAt: '2026-11-09T08:00:00.000Z' }));
    expect(await recoveryOutbox(iphone)).toEqual([]);
  });
});

describe('(c) l’iPhone écrit, le PC lit', () => {
  it('écriture locale sur le PC : ignorée (rien d’écrit, rien en file) ; la ligne reçue de l’iPhone n’est pas touchée', async () => {
    const [iphone, pc] = await iphoneAndPc();
    await (await iphone.data.repos.recovery()).saveDay(output());
    await roundTrip();
    const before = await dayRow(pc);
    const repoPc = await pc.data.repos.recovery();
    expect(await repoPc.saveDay(output(DAY, { recovery: 10 }))).toBeNull();
    expect(await repoPc.saveDay(output(DAY2))).toBeNull();
    await repoPc.deleteDay(DAY);
    expect(await dayRow(pc)).toEqual(before);
    expect(await count(pc, 'recovery_day')).toBe(1);
    expect(await recoveryOutbox(pc)).toEqual([]);
    await roundTrip();
    expect((await (await iphone.data.repos.recovery()).getDay(DAY))?.summary.recovery).toBe(72);
    expect(await (await iphone.data.repos.recovery()).getDay(DAY2)).toBeNull();
  });
});

describe('(d) vecteurs d’application de recovery_day et muscle_recovery', () => {
  const AT = '2026-11-09T08:00:00.000Z' as IsoDateTime;
  const H = (ms: number, dev: string = IPHONE): Hlc => `${String(1_794_000_000_000 + ms).padStart(15, '0')}-0000-${dev}` as Hlc;
  const f = (value: SyncField[0], hlc: Hlc): SyncField => [value, hlc, null];
  const dayValues = (over: Record<string, SyncField[0]> = {}): [string, SyncField[0]][] =>
    Object.entries({
      date: DAY, level: 'C', recovery: 72, abstain_reason: null, quality: 'good', exertion: 4.5, exertion_prev_day: 2, sleep_minutes: 450, sleep_need_minutes: 480, sleep_score: 94,
      bedtime_sigma_minutes: 22.5, target_zone_from: 6, target_zone_to: 8, hrv_ms: HRV, resting_hr: RHR, learning_nights: 14, contributors: '[]', explanation_keys: '[]',
      computed_at: AT, engine_version: 1, created_at: AT, deleted_at: null, ...over,
    });
  const dayOp = (hlc: Hlc, over: Record<string, SyncField[0]> = {}): SyncOp => ({ t: 'recovery_day', id: `recovery|${DAY}`, at: AT, f: new Map(dayValues(over).map(([k, v]) => [k, f(v, hlc)])) });
  const muscleOp = (hlc: Hlc, percent: number, deleted: string | null = null): SyncOp => ({
    t: 'muscle_recovery',
    id: `muscle|${DAY}|quads`,
    at: AT,
    f: new Map(
      Object.entries({ date: DAY, muscle_id: 'quads', muscle_group: 'Jambes', percent, hours: 96, last_worked_at: '2026-11-08T18:00:00.000Z', ready_at: '2026-11-12T18:00:00.000Z', created_at: AT, deleted_at: deleted }).map(
        ([k, v]) => [k, f(v, hlc)],
      ),
    ),
  });
  /** Une modification partielle (champs changés seulement), comme le journal d'un `_au`. */
  const patch = (t: string, id: string, hlc: Hlc, fields: Record<string, SyncField[0]>): SyncOp => ({ t, id, at: AT, f: new Map(Object.entries(fields).map(([k, v]) => [k, f(v, hlc)])) });
  const ctx = (logger = createMemorySyncLogger()): ApplyContext => ({ catalogue: SYNC_CATALOGUE, localSv: 10, remoteSv: 10, now: AT, knows: () => true, logger });
  const pcDevice = async (id = PC): Promise<SimDevice> => {
    const d = await createSimDevice(id, { name: 'PC', schema: 'i0' });
    devices.push(d);
    return d;
  };
  const state = async (d: SimDevice) => ({
    day: await d.driver.select('SELECT id, recovery, level, hrv_ms, deleted_at, hlc FROM recovery_day ORDER BY id'),
    muscles: await d.driver.select('SELECT id, percent, deleted_at, hlc FROM muscle_recovery ORDER BY id'),
  });

  it('ligne reçue sur le PC : écrite telle quelle (lecteur), aucune entrée en file, aucun conflit', async () => {
    const pc = await pcDevice();
    await guarded(pc.data, (repos) => applyOps(repos, [dayOp(H(2)), muscleOp(H(2), 40)], ctx()));
    expect((await (await pc.data.repos.recovery()).getDay(DAY))?.summary).toMatchObject({ recovery: 72, hrvMs: HRV, restingHr: RHR, level: 'C' });
    expect((await (await pc.data.repos.recovery()).listMuscles(DAY)).map((m) => [m.id, m.percent])).toEqual([[`muscle|${DAY}|quads`, 40]]);
    expect(await pc.driver.select('SELECT 1 FROM sync_outbox')).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM conflict_log')).toEqual([]);
  });

  it('même date écrite deux fois : la dernière écriture (HLC) gagne, quel que soit l’ordre de réception ; rejouer ne change rien', async () => {
    const older = [dayOp(H(2)), muscleOp(H(2), 40)];
    const newer = [patch('recovery_day', `recovery|${DAY}`, H(5, IPHONE2), { recovery: 55, hrv_ms: 70.5 }), patch('muscle_recovery', `muscle|${DAY}|quads`, H(5, IPHONE2), { percent: 60 })];
    const x = await pcDevice();
    const y = await pcDevice(IPHONE2.replace(/c/g, 'd'));
    await guarded(x.data, (repos) => applyOps(repos, [...older, ...newer], ctx()));
    await guarded(y.data, (repos) => applyOps(repos, older, ctx()));
    await guarded(y.data, (repos) => applyOps(repos, [...newer].reverse(), ctx()));
    await guarded(y.data, (repos) => applyOps(repos, older, ctx())); // l'ancienne écriture rejouée après la récente : sans effet
    expect(await state(x)).toEqual(await state(y));
    expect((await state(x)).day).toMatchObject([{ recovery: 55, hrv_ms: 70.5, level: 'C' }]);
    expect((await state(x)).muscles).toMatchObject([{ percent: 60 }]);
    // Idempotence : le même lot rejoué n'écrit rien de plus.
    const before = await state(x);
    await guarded(x.data, (repos) => applyOps(repos, [...older, ...newer], ctx()));
    expect(await state(x)).toEqual(before);
    for (const d of [x, y]) expect(await d.driver.select('SELECT 1 FROM sync_outbox'), d.name).toEqual([]);
  });

  it('suppression logique respectée : une réécriture plus ancienne ne ressuscite pas le jour ; une restauration plus récente le rétablit', async () => {
    const pc = await pcDevice();
    await guarded(pc.data, (repos) => applyOps(repos, [dayOp(H(2)), muscleOp(H(2), 40)], ctx()));
    await guarded(pc.data, (repos) => applyOps(repos, [patch('recovery_day', `recovery|${DAY}`, H(6), { deleted_at: AT }), muscleOp(H(6), 40, AT)], ctx()));
    expect(await (await pc.data.repos.recovery()).getDay(DAY)).toBeNull();
    expect(await (await pc.data.repos.recovery()).listMuscles(DAY)).toEqual([]);
    await guarded(pc.data, (repos) => applyOps(repos, [patch('recovery_day', `recovery|${DAY}`, H(4), { recovery: 30 })], ctx()));
    expect(await (await pc.data.repos.recovery()).getDay(DAY)).toBeNull();
    await guarded(pc.data, (repos) => applyOps(repos, [patch('recovery_day', `recovery|${DAY}`, H(8), { deleted_at: null, recovery: 64 })], ctx()));
    expect((await (await pc.data.repos.recovery()).getDay(DAY))?.summary.recovery).toBe(64);
  });

  it('identifiant incohérent avec la date (recréation reçue) : jamais écrit', async () => {
    const pc = await pcDevice();
    const bad: SyncOp = { ...dayOp(H(2)), id: `recovery|${DAY2}` };
    await guarded(pc.data, (repos) => applyOps(repos, [bad], ctx()));
    expect(await pc.driver.select('SELECT id FROM recovery_day')).toEqual([]);
  });

  it('deux iPhone écrivent le même jour hors ligne : convergence sur l’écriture la plus récente, journal des conflits sans valeur corporelle', async () => {
    const [a, pc] = await iphoneAndPc();
    const b = await createSimDevice(IPHONE2, { name: 'iPhone 2', schema: 'i0', devicePlatform: 'ios', clock: createManualClock(a.clock.nowMs()) });
    devices.push(b);
    await pair(pc, b);
    await b.cycle();
    syncFolders(devices);
    await roundTrip();
    await (await a.data.repos.recovery()).saveDay(output(DAY, { recovery: 40, hrvMs: 50.11 }));
    b.clock.advance(3_000);
    await (await b.data.repos.recovery()).saveDay(output(DAY, { recovery: 80, hrvMs: 70.22 }));
    await roundTrip();
    await roundTrip();
    for (const d of [a, b, pc]) {
      expect((await (await d.data.repos.recovery()).getDay(DAY))?.summary, d.name).toMatchObject({ recovery: 80, hrvMs: 70.22 });
      expect(await count(d, 'recovery_day'), d.name).toBe(1);
    }
    const logs = async (d: SimDevice) => JSON.stringify(await d.driver.select("SELECT * FROM conflict_log WHERE table_name IN ('recovery_day', 'muscle_recovery')"));
    expect(await logs(a)).toBe(await logs(b));
    expect(await logs(pc)).toBe(await logs(a));
    for (const d of [a, b, pc]) for (const v of ['50.11', '70.22', String(RHR)]) expect(await logs(d), `${d.name} ${v}`).not.toContain(v);
  });
});

describe('(e) instantané et PC associé après coup', () => {
  it('les deux tables sont dans l’instantané de l’iPhone et reçues par le PC', async () => {
    const [a, b] = await iphoneAndPc('i0', async (iphone) => {
      await (await iphone.data.repos.recovery()).saveDay(output());
    });
    const pages: string[] = [];
    for await (const page of snapshotPages(a.data.repos, SYNC_CATALOGUE, epochId(1, a.id), new Map<DeviceId, DeviceAck>(), 10)) pages.push(...page);
    const text = pages.join(' ');
    for (const id of ['recovery|2026-11-09', 'muscle|2026-11-09|lats', 'muscle|2026-11-09|quads']) expect(text, id).toContain(id);
    await roundTrip();
    expect((await (await b.data.repos.recovery()).getDay(DAY))?.summary).toEqual(output().summary);
    expect(await (await b.data.repos.recovery()).listMuscles(DAY)).toHaveLength(2);
    expect(await b.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
  });
});

describe('(f) PC resté en schéma 9 (ADR 0011 §7.2)', () => {
  it('lignes reçues : aucune erreur, gardées dans sync_unknown ; réintégrées après la migration 0010', async () => {
    const [iphone, pc] = await iphoneAndPc('v9');
    await (await iphone.data.repos.recovery()).saveDay(output());
    await roundTrip();
    expect((await pc.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name')).map((r) => r.table_name)).toEqual(['muscle_recovery', 'recovery_day']);
    expect(await pc.driver.select("SELECT 1 FROM sqlite_master WHERE name IN ('recovery_day', 'muscle_recovery')")).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    await migrate(pc.driver, migrations);
    await reintegrateUnknownFields(pc.driver, { catalogue: SYNC_CATALOGUE, now: new Date(pc.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await dayRow(pc)).toEqual([{ id: 'recovery|2026-11-09', date: DAY, level: 'C', recovery: 72, abstain_reason: null, hrv_ms: HRV, resting_hr: RHR, gone: 0 }]);
    expect(await count(pc, 'muscle_recovery')).toBe(2);
  });
});

describe('(g) aucune valeur corporelle dans un journal', () => {
  it('journal technique de la synchro des deux appareils : ni HRV ni FC repos, quel que soit le parcours', async () => {
    const [iphone, pc] = await iphoneAndPc();
    await (await iphone.data.repos.recovery()).saveDay(output());
    await roundTrip();
    await (await pc.data.repos.recovery()).saveDay(output(DAY, { hrvMs: 88.88 }));
    await (await iphone.data.repos.recovery()).deleteDay(DAY);
    await roundTrip();
    for (const d of [iphone, pc]) {
      const text = JSON.stringify(d.logger.entries);
      for (const v of [String(HRV), String(RHR), '88.88']) expect(text, `${d.name} ${v}`).not.toContain(v);
    }
  });
});

describe('(h) vecteur chiffré recovery_day (tests/fixtures/sync/vectors.json)', () => {
  it('enregistrement de journal en schéma 10 : opérations valides pour le catalogue, forme canonique stable', () => {
    const record = vectors.records.find((r) => r.name === 'journal-ops-recovery');
    if (!record || !('json' in record.plaintext)) throw new Error('vecteur journal-ops-recovery absent');
    expect(record.sv).toBe(10);
    const parsed = parseJournalRecord(record.plaintext.json);
    if (!parsed || parsed.k !== 'ops') throw new Error('vecteur illisible');
    expect(parsed.sv).toBe(10);
    expect(parsed.ops.map((op) => [op.t, op.id])).toEqual([
      ['recovery_day', 'recovery|2026-11-09'],
      ['muscle_recovery', 'muscle|2026-11-09|quads'],
    ]);
    for (const op of parsed.ops) {
      const t = SYNC_CATALOGUE.table(op.t);
      if (!t) throw new Error(op.t);
      expect(SYNC_CATALOGUE.isValidRowId(t, op.id)).toBe(true);
      expect([...op.f.keys()].sort(), op.t).toEqual([...publishedColumns(t)].sort());
      for (const [name, [value]] of op.f) {
        const col = SYNC_CATALOGUE.column(op.t, name);
        expect(col && SYNC_CATALOGUE.isValidValue(col, value), `${op.t}.${name}`).toBe(true);
      }
      expect(t.natural?.expected(new Map([...op.f].map(([k, [v]]) => [k, v])))).toBe(op.id);
    }
    expect(journalRecordToText(parsed)).toBe(record.plaintext.json);
  });
});

describe('libellés de synchro', () => {
  it('report d’époque : un libellé par table', () => {
    expect(carryKindText('recovery_day')).toBe('Résumé de récupération du jour');
    expect(carryKindText('muscle_recovery')).toBe('Récupération d’un muscle');
  });
});
