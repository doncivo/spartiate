import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import type { RecoverySampleInput } from '../recoverySampleRepository';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I5-01 point 1.5 : `RecoverySampleRepository` (tables LOCALES `recovery_sample` et `recovery_import_state`, migration 0010). Insertion par lot en
 * ignorant les doublons, lecture par type et fenêtre, purge au-delà de 120 jours, état du dernier import. Aucune mise en file de synchro.
 * Fixtures synthétiques.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000fb' as DeviceId;
const T1 = '2026-11-09T08:00:00.000Z';
let db: TestDb;
afterEach(async () => db.close());
const repo = async () => db.data.repos.recoverySamples();

const hrv = (at: string, value: number, source = 'hrv.csv'): RecoverySampleInput => ({ type: 'hrv', startAt: at, endAt: at, value, stage: null, source });
const rhr = (at: string, value: number): RecoverySampleInput => ({ type: 'fc-repos', startAt: at, endAt: at, value, stage: null, source: 'fc-repos.csv' });
const steps = (start: string, end: string, value: number): RecoverySampleInput => ({ type: 'pas', startAt: start, endAt: end, value, stage: null, source: 'pas.csv' });
const sleep = (start: string, end: string, stage: 'in_bed' | 'asleep' | 'rem'): RecoverySampleInput => ({ type: 'sommeil', startAt: start, endAt: end, value: null, stage, source: 'sommeil.csv' });
const day = (n: number, hour = 5): string => `2026-11-${String(n).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

describe('RecoverySampleRepository', () => {
  it('insertMany : insère par lot, compte les ajoutés ; relire donne les échantillons, valeurs et instants inchangés', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    expect(await r.insertMany([hrv(day(7), 55), hrv(day(8), 61.5), hrv(day(9), 48)], T1)).toEqual({ added: 3, duplicates: 0 });
    const rows = await r.listWindow('hrv', day(1), day(30));
    expect(rows.map((s) => [s.startAt, s.value, s.stage, s.source, s.importedAt])).toEqual([
      [day(7), 55, null, 'hrv.csv', T1],
      [day(8), 61.5, null, 'hrv.csv', T1],
      [day(9), 48, null, 'hrv.csv', T1],
    ]);
  });

  it('réimporter le même fichier n’ajoute rien (doublons comptés, valeur d’origine conservée) ; un doublon dans le lot est compté aussi', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.insertMany([hrv(day(7), 55), hrv(day(8), 61)], T1);
    expect(await r.insertMany([hrv(day(7), 99, 'autre.csv'), hrv(day(8), 61), hrv(day(9), 40), hrv(day(9), 40)], '2026-11-10T08:00:00.000Z')).toEqual({ added: 1, duplicates: 3 });
    const rows = await r.listWindow('hrv', day(1), day(30));
    expect(rows.map((s) => s.value)).toEqual([55, 61, 40]);
    expect(rows[0]?.importedAt).toBe(T1);
    expect(await r.insertMany([], T1)).toEqual({ added: 0, duplicates: 0 });
  });

  it('un lot de plusieurs centaines de lignes est inséré (pas de limite de paramètres)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const batch = Array.from({ length: 1_000 }, (_, i) => hrv(new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(), 40 + (i % 50)));
    expect(await r.insertMany(batch, T1)).toEqual({ added: 1_000, duplicates: 0 });
    expect(await r.insertMany(batch, T1)).toEqual({ added: 0, duplicates: 1_000 });
  });

  it('sommeil : un segment par stade et par intervalle ; types séparés ; pas à valeur nulle conservé (0 réel)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const night = [sleep(day(8, 22), day(9, 5), 'in_bed'), sleep(day(8, 22), day(9, 5), 'asleep'), sleep(day(9, 1), day(9, 2), 'rem')];
    expect(await r.insertMany([...night, rhr(day(9), 50), steps(day(9, 8), day(9, 9), 0)], T1)).toEqual({ added: 5, duplicates: 0 });
    expect(await r.insertMany(night, T1)).toEqual({ added: 0, duplicates: 3 });
    expect((await r.listWindow('sommeil', day(8, 0), day(9, 23))).map((s) => s.stage)).toEqual(['in_bed', 'asleep', 'rem']);
    expect((await r.listWindow('pas', day(9, 0), day(9, 23))).map((s) => s.value)).toEqual([0]);
    expect((await r.listWindow('fc-repos', day(9, 0), day(9, 23))).map((s) => s.value)).toEqual([50]);
  });

  it('listWindow : tout échantillon qui chevauche la fenêtre, du plus ancien au plus récent ; hors fenêtre exclu', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.insertMany([sleep(day(8, 22), day(9, 5), 'asleep'), sleep(day(7, 22), day(8, 5), 'asleep'), hrv(day(9, 6), 50)], T1);
    expect((await r.listWindow('sommeil', day(9, 0), day(9, 12))).map((s) => s.startAt)).toEqual([day(8, 22)]);
    expect((await r.listWindow('sommeil', day(10, 0), day(11, 0)))).toEqual([]);
    expect(await r.listWindow('hrv', day(9, 7), day(9, 8))).toEqual([]);
  });

  it('entrée invalide : tout le lot est refusé, rien n’est écrit', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const bad: RecoverySampleInput[][] = [
      [hrv(day(7), 55), { ...hrv(day(8), 55), value: null }],
      [hrv(day(7), 55), { ...hrv(day(8), 55), stage: 'rem' }],
      [hrv(day(7), 55), { ...sleep(day(8), day(9), 'asleep'), value: 3 }],
      [hrv(day(7), 55), { ...hrv(day(8), 55), type: 'tension' as 'hrv' }],
      [hrv(day(7), 55), { ...hrv(day(8), 55), startAt: day(9), endAt: day(8) }],
      [hrv(day(7), 55), { ...hrv(day(8), 55), startAt: 'hier' }],
      [hrv(day(7), 55), { ...hrv(day(8), Number.NaN) }],
      [hrv(day(7), 55), { ...hrv(day(8), 55), source: '' }],
    ];
    for (const [i, b] of bad.entries()) await expect(r.insertMany(b, T1), String(i)).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recovery_sample')).toEqual([{ n: 0 }]);
  });

  it('purgeOlder : supprime les échantillons terminés avant 120 jours, garde le reste, rend le nombre supprimé', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    const now = '2026-11-09T12:00:00.000Z';
    await r.insertMany([hrv('2026-07-01T05:00:00.000Z', 40), hrv('2026-07-12T05:00:00.000Z', 41), hrv('2026-07-13T05:00:00.000Z', 42), hrv(day(8), 43), sleep('2026-07-01T22:00:00.000Z', '2026-07-12T05:00:00.000Z', 'asleep')], T1);
    // 120 jours avant le 9 novembre 12:00 = 12 juillet 12:00 : les échantillons terminés avant sont purgés.
    expect(await r.purgeOlderThan(now)).toBe(3);
    expect((await r.listWindow('hrv', '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')).map((s) => s.value)).toEqual([42, 43]);
    expect(await r.purgeOlderThan(now)).toBe(0);
    expect(await r.purgeOlderThan(now, 1)).toBe(2); // coupure au 8 novembre 12:00
  });

  it('état du dernier import : un par type, remplacé à chaque import, absent avant le premier ; comptes seulement', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    expect(await r.getImportState('hrv')).toBeNull();
    expect(await r.listImportStates()).toEqual([]);
    await r.recordImport({ type: 'hrv', importedAt: T1, newestSampleAt: day(9), added: 3, duplicates: 1, rejected: 2 });
    await r.recordImport({ type: 'sommeil', importedAt: T1, newestSampleAt: null, added: 0, duplicates: 0, rejected: 0 });
    expect(await r.getImportState('hrv')).toEqual({ type: 'hrv', importedAt: T1, newestSampleAt: day(9), added: 3, duplicates: 1, rejected: 2 });
    await r.recordImport({ type: 'hrv', importedAt: '2026-11-10T08:00:00.000Z', newestSampleAt: day(10), added: 1, duplicates: 3, rejected: 0 });
    expect(await r.getImportState('hrv')).toEqual({ type: 'hrv', importedAt: '2026-11-10T08:00:00.000Z', newestSampleAt: day(10), added: 1, duplicates: 3, rejected: 0 });
    expect((await r.listImportStates()).map((s) => s.type)).toEqual(['hrv', 'sommeil']);
    await expect(r.recordImport({ type: 'hrv', importedAt: T1, newestSampleAt: null, added: -1, duplicates: 0, rejected: 0 })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('table locale : aucune mise en file de synchro, aucune horloge de champ', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await db.driver.execute('DELETE FROM sync_outbox');
    await r.insertMany([hrv(day(7), 55)], T1);
    await r.recordImport({ type: 'hrv', importedAt: T1, newestSampleAt: day(7), added: 1, duplicates: 0, rejected: 0 });
    await r.purgeOlderThan('2027-11-09T00:00:00.000Z');
    expect(await db.driver.select('SELECT * FROM sync_outbox')).toEqual([]);
    expect(await db.driver.select('SELECT * FROM sync_field_clock')).toEqual([]);
  });

  it('plan de requête : fenêtre par type et purge par fin passent par un index', async () => {
    db = await openBaseDb(DEVICE);
    const plan = async (sql: string) => (await db.driver.select<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`)).map((p) => p.detail).join(' ');
    expect(await plan("SELECT * FROM recovery_sample WHERE type = 'hrv' AND end_at >= '2026-11-01' AND start_at <= '2026-11-30' ORDER BY start_at")).toMatch(/USING (COVERING )?INDEX/);
    expect(await plan("DELETE FROM recovery_sample WHERE end_at < '2026-07-01'")).toMatch(/USING (COVERING )?INDEX/);
  });
});
