import { afterEach, describe, expect, it } from 'vitest';
import { RESET_SETTINGS, RESET_TABLES } from '../../../../src/domain/dataReset';
import { decideOnboarding, isEmptyBase } from '../../../../src/domain/onboarding/draft';
import type { DeviceId, LocalDate, LocalTime } from '../../../../src/domain/types';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import { createMemorySyncLogger } from '../../../../src/sync/log';
import { readResetAtMs, resetAllData } from '../../../../src/sync/dataReset';
import { openBaseDb, type TestDb } from '../../../../src/db/repositories/sql/testSetup';

/**
 * RESET-01 (D-180 à D-186) : effacement complet par table, réglages et état de synchro gardés, séance en cours refusée, onboarding rouvert, journal
 * sans valeur. Données synthétiques uniquement (D-38).
 */
const A = '60000000-0000-4000-8000-0000000000e1' as DeviceId;
const W = '7e2d1c3a-0000-4000-8000-0000000000e1';
let db: TestDb;
afterEach(async () => db.close());

const tablesOf = async (d: TestDb): Promise<string[]> =>
  (await d.driver.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((r) => r.name);
const countOf = async (d: TestDb, table: string): Promise<number> => Number((await d.driver.select<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))[0]?.n ?? 0);

async function seed(): Promise<void> {
  db = await openBaseDb(A, '2026-11-12T08:00:00.000Z');
  const repos = db.data.repos;
  await (await repos.profile()).save({ sex: 'male', birthYear: 1990, heightCm: 181.5, goal: null, experience: null, units: 'metric' }, 2026);
  await (await repos.bodyWeights()).saveManual({ date: '2026-11-10' as LocalDate, kg: 82.4, timezone: 'Europe/Paris' }, '2026-11-12' as LocalDate);
  await (await repos.measurements()).save('2026-11-09' as LocalDate, 'waist', 82.5);
  await (await repos.progressPhotos()).add('2026-11-09' as LocalDate, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]));
  await (await repos.foodFavorites()).add({ source: 'ciqual', ref: 'ciqual:20' });
  // I6-06 : séance cardio publiée et son tracé local (position synthétique).
  await (await repos.cardio()).add({ kind: 'run', startedAt: '2026-11-12T07:00:00.000Z', durationSec: 1800, distanceM: 5000, avgHr: null, rpe: 6, notes: '', source: 'gps' }, [{ lat: 0, lon: 0, at: 1_800_000_000_000, accuracyM: 5 }]);
  const food = await db.data.transaction(async (tx) => (await tx.foods()).create({ source: 'custom', barcode: null, name: 'Fiche synthétique', brand: null, per100g: { kcal: 100, proteinG: null, fatG: null, carbG: null, fiberG: null }, fetchedAt: null }));
  await db.data.transaction(async (tx) =>
    (await tx.mealEntries()).create({ date: '2026-11-10' as LocalDate, time: '12:30' as LocalTime, foodId: food.id, foodName: 'Fiche synthétique', source: 'custom', grams: 150, kcal: 150, proteinG: null, fatG: null, carbG: null, method: 'search', confidence: null }),
  );
  await (await repos.dayCompleteness()).declare('2026-11-10' as LocalDate, 'complete');
  await (await repos.recoverySamples()).recordImport({ type: 'hrv', importedAt: '2026-11-09T07:00:00.000Z', newestSampleAt: '2026-11-09T02:12:00.000Z', added: 1, duplicates: 0, rejected: 0 });
  const w = await repos.workouts();
  await w.start({ source: 'empty', id: W, name: 'Séance synthétique' });
  await w.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 1 });
  const open = await w.getOpen();
  for (const s of open?.sets ?? []) await w.validateSet(s.id, { reps: 8, loadKg: 50 });
  db.clock.advance(1_000);
  await db.data.transaction(async (tx) => (await tx.workouts()).close(W));
  // Réglages : un de chaque sort ; état de synchro (appairage, curseurs) simulé.
  await repos.settings.set('ui.theme', 'light');
  await repos.settings.set('training.restSeconds', 90);
  await repos.settings.set('onboarding.completed', true);
  await repos.settings.set('nutrition.prefs', { v: 1 });
  await repos.settings.set('training.activeEquipmentProfile', 'maison');
  await repos.sync.setMeta('epoch', JSON.stringify('e1-60000000-0000-4000-8000-0000000000e1'));
  await db.driver.execute('INSERT INTO conflict_log (table_name, row_id, field, kept_value, discarded_value, kept_device, discarded_device, kept_hlc, discarded_hlc, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
    'body_weight',
    'weight|2026-11-10|manual',
    'kg',
    '82.4',
    '82.0',
    A,
    A,
    null,
    null,
    '2026-11-12T08:00:00.000Z',
  ]);
  db.clock.advance(1_000);
}

describe('classement de toutes les tables du schéma (D-181)', () => {
  it('chaque table d’une base migrée est classée « effacée » ou « gardée » ; une table nouvelle non classée fait échouer ce test', async () => {
    db = await openBaseDb(A);
    const tables = await tablesOf(db);
    const unclassified = tables.filter((name) => RESET_TABLES[name] === undefined);
    expect(unclassified, 'tables à classer dans RESET_TABLES (src/domain/dataReset.ts)').toEqual([]);
    expect(Object.keys(RESET_TABLES).filter((name) => !tables.includes(name)), 'classées mais absentes du schéma').toEqual([]);
  });
});

describe('« Repartir de zéro » sur cet appareil', () => {
  it('toutes les tables effacées sont vides ; data_reset porte une ligne, en file d’envoi ; rien d’autre en file', async () => {
    await seed();
    const logger = createMemorySyncLogger();
    const outcome = await resetAllData(db.data, SYNC_CATALOGUE, logger);
    expect(outcome.kind).toBe('done');
    for (const [table, fate] of Object.entries(RESET_TABLES)) if (fate === 'wiped') expect(await countOf(db, table), table).toBe(0);
    expect(await countOf(db, 'data_reset')).toBe(1);
    expect(await db.driver.select('SELECT table_name, field FROM sync_outbox')).toEqual([{ table_name: 'data_reset', field: '*' }]);
    expect(await db.driver.select("SELECT 1 FROM sync_field_clock WHERE table_name <> 'data_reset'")).toEqual([]);
    expect(await db.driver.select('SELECT 1 FROM sync_guard')).toEqual([]);
  });

  it('réglages de l’appareil et état de synchro gardés ; réglages de données remis au défaut', async () => {
    await seed();
    await resetAllData(db.data, SYNC_CATALOGUE, createMemorySyncLogger());
    const s = db.data.repos.settings;
    expect(await s.get('ui.theme')).toBe('light');
    expect(await s.get('training.restSeconds')).toBe(90);
    expect(await s.get('onboarding.completed')).toBe(false);
    expect(await s.get('nutrition.prefs')).toBeNull();
    expect(await s.get('training.activeEquipmentProfile')).toBeNull();
    expect(await db.data.repos.sync.getMeta('epoch')).toBe(JSON.stringify('e1-60000000-0000-4000-8000-0000000000e1'));
    const left = await db.driver.select<{ key: string }>('SELECT key FROM settings ORDER BY key');
    for (const { key } of left) expect(RESET_SETTINGS[key as keyof typeof RESET_SETTINGS], key).not.toBe('wiped');
  });

  it('même état qu’une installation neuve : base vide, onboarding ouvert au prochain démarrage (D-184)', async () => {
    await seed();
    await resetAllData(db.data, SYNC_CATALOGUE, createMemorySyncLogger());
    const completed = await db.data.repos.settings.get('onboarding.completed');
    const empty = isEmptyBase(await (await db.data.repos.userData()).presence());
    expect(empty).toBe(true);
    expect(decideOnboarding({ completed, empty, requested: false })).toBe('show');
  });

  it('séance en cours : refus, rien n’est effacé ni mis en file (D-184)', async () => {
    db = await openBaseDb(A);
    await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-10' as LocalDate, kg: 82.4, timezone: 'Europe/Paris' }, '2026-11-12' as LocalDate);
    await (await db.data.repos.workouts()).start({ source: 'empty', id: W, name: 'En cours' });
    const before = await db.driver.select('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq');
    const outcome = await resetAllData(db.data, SYNC_CATALOGUE, createMemorySyncLogger());
    expect(outcome).toEqual({ kind: 'refused', reason: 'session-open' });
    expect(await countOf(db, 'body_weight')).toBe(1);
    expect(await countOf(db, 'workout')).toBe(1);
    expect(await countOf(db, 'data_reset')).toBe(0);
    expect(await db.driver.select('SELECT table_name, row_id, field FROM sync_outbox ORDER BY seq')).toEqual(before);
  });

  it('journal : un seul événement data-reset, des comptes seulement, aucune valeur (D-186)', async () => {
    await seed();
    const logger = createMemorySyncLogger();
    await resetAllData(db.data, SYNC_CATALOGUE, logger);
    const events = logger.entries.filter((e) => e.event === 'data-reset');
    expect(events).toHaveLength(1);
    const detail = events[0]?.detail ?? {};
    expect(Object.keys(detail).sort()).toEqual(['kept', 'origin', 'rows', 'settings', 'tables']);
    expect(detail.origin).toBe('local');
    for (const key of ['rows', 'settings', 'tables', 'kept'] as const) expect(typeof detail[key]).toBe('number');
    expect(Number(detail.rows)).toBeGreaterThan(5);
    expect(JSON.stringify(logger.entries)).not.toMatch(/82\.4|Fiche synthétique|Séance synthétique|ciqual:20|2026-11-10/);
  });

  it('les sauvegardes d’avant sont repérables : heure de l’effacement mémorisée (D-185)', async () => {
    await seed();
    expect(await readResetAtMs(db.data.repos)).toBeNull();
    const at = db.clock.nowMs();
    await resetAllData(db.data, SYNC_CATALOGUE, createMemorySyncLogger());
    expect(await readResetAtMs(db.data.repos)).toBeGreaterThanOrEqual(at);
  });
});
