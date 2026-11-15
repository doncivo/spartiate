import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { ROW_REPUBLISH_FIELD } from '../../../../src/sync/publisher';
import { WHOLE_ROW_FIELD } from '../../../../src/sync/olderWriter';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/**
 * SYNC-01 (D-275 ; ADR 0011 §7.2, critères 1 à 4) : une ligne CRÉÉE par un appareil resté au schéma précédent (18, sans les colonnes de la
 * 0019) n'est jamais perdue en silence sur l'appareil à jour (19). Détection (avertissement `older-device`, aucune reprise complète inutile),
 * conservation durable (`sync_parked`, redémarrage compris), puis reprise après la mise à jour de l'autre appareil (republication de ses
 * lignes entières, une fois). Sens inverse et même schéma : `twoVersions`, `reintegrate` et les suites existantes. Données synthétiques.
 */

const NEW_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OLD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const M1 = '5c1d0e2f-0000-4000-8000-000000000101';
const T1 = '5c1d0e2f-0000-4000-8000-000000000102';
const ROUTINE = '5c1d0e2f-0000-4000-8000-000000000103';

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

/** B à jour (19) choisit le dossier ; A (resté en 18) le rejoint. */
async function mixed(): Promise<{ a: SimDevice; b: SimDevice }> {
  const b = await createSimDevice(NEW_ID, { name: 'PC', schema: 'i0' });
  const a = await createSimDevice(OLD_ID, { name: 'iPhone', schema: 'v18', clock: createManualClock(b.clock.nowMs()) });
  devices = [b, a];
  await setupFirst(b);
  await b.cycle();
  await pair(b, a);
  await a.cycle();
  syncFolders(devices);
  await b.cycle();
  return { a, b };
}

async function roundTrip(times = 2): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}

const iso = (d: SimDevice): string => new Date(d.clock.nowMs()).toISOString();

/** Création telle que l'app 18 la fait : colonnes de la 0018 seulement, capturée par le déclencheur `_ai` de l'appareil (hors garde). */
async function createCycleOn18(a: SimDevice): Promise<void> {
  const at = iso(a);
  await a.driver.execute(
    `INSERT INTO mesocycle (id, routine_id, start_date, weeks, unlimited, deload_week, block_origin_week, block_origin_index, rotation_index, pauses, status, outcome, ended_on, created_at, updated_at, device_id, hlc)
     VALUES (?, ?, '2026-11-16', 5, 0, NULL, 1, 0, 0, '[]', 'active', NULL, NULL, ?, ?, ?, ?)`,
    [M1, ROUTINE, at, at, a.id, a.hlc.now()],
  );
}

async function createTargetOn18(a: SimDevice): Promise<void> {
  const at = iso(a);
  await a.driver.execute(
    `INSERT INTO nutrition_target (id, week_start, kcal, protein_g, fat_g, carb_g, source, accepted, engine_version, created_at, updated_at, device_id, hlc)
     VALUES (?, '2026-11-16', 2500, 150, 70, 316, 'manual', 1, NULL, ?, ?, ?, ?)`,
    [T1, at, at, a.id, a.hlc.now()],
  );
}

const cycleRow = (d: SimDevice) => d.driver.select('SELECT id, routine_id, start_date, weeks, unlimited, pauses, status, next_weeks, ramp_up, deleted_at, hlc FROM mesocycle ORDER BY id');
const targetRow = (d: SimDevice) => d.driver.select('SELECT id, week_start, kcal, carb_g, source, rest_kcal, rest_carb_g, training_days, deleted_at, hlc FROM nutrition_target ORDER BY id');
const parked = (d: SimDevice) => d.driver.select<{ reason: string; table_name: string }>('SELECT reason, table_name FROM sync_parked ORDER BY id');
const conflicts = async (d: SimDevice) => (await d.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n;

describe('SYNC-01 : ligne créée par un appareil au schéma 18, reçue par un appareil au schéma 19', () => {
  it('critère 1 : jamais appliquée à moitié ni oubliée : conservée telle quelle, redémarrage compris', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await roundTrip();
    expect(await cycleRow(b)).toEqual([]);
    expect(await parked(b)).toEqual([{ reason: 'missing-row', table_name: 'mesocycle' }]);
    await b.restart();
    await roundTrip();
    expect(await parked(b)).toEqual([{ reason: 'missing-row', table_name: 'mesocycle' }]);
  });

  it('critère 1 : relecture du même journal (curseurs ramenés à zéro) : aucune partie gardée en double, ni après une modification sur 18', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await roundTrip();
    a.clock.advance(5_000);
    await a.driver.execute('UPDATE mesocycle SET weeks = 6, updated_at = ?, hlc = ? WHERE id = ?', [iso(a), a.hlc.now(), M1]);
    await roundTrip();
    const before = (await b.driver.select<{ op: string }>('SELECT op FROM sync_parked ORDER BY id')).map((r) => r.op);
    await b.driver.execute('UPDATE sync_state SET cursor_segment = 0, cursor_record = 0 WHERE is_self = 0');
    await roundTrip();
    await b.restart();
    await roundTrip();
    expect((await b.driver.select<{ op: string }>('SELECT op FROM sync_parked ORDER BY id')).map((r) => r.op)).toEqual(before);
    expect(await cycleRow(b)).toEqual([]);
  });

  it('critère 2 : avertissement « appareil plus ancien » sur l’appareil à jour, sans reprise complète inutile ni donnée dans le journal technique', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await roundTrip();
    const status = b.service.status();
    expect(status.warnings ?? []).toContain('older-device');
    // La reprise depuis l'instantané ne peut pas compléter la ligne : jamais demandée pour elle, et pas de « reçu non appliqué » trompeur.
    expect(status.warnings ?? []).not.toContain('received-unapplied');
    expect(b.logger.entries.map((e) => e.event)).not.toContain('parked-resume-requested');
    const logged = JSON.stringify(b.logger.entries);
    for (const value of [M1, ROUTINE, '2026-11-16']) expect(logged).not.toContain(value);
    // L'appareil resté en 18 ne voit rien de tel (il lit les champs plus récents dans sync_unknown).
    expect(a.service.status().warnings ?? []).not.toContain('older-device');
  });

  it('critère 2 : l’avertissement tient après un redémarrage tant que la ligne attend', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await roundTrip();
    await b.restart();
    await b.cycle();
    expect(b.service.status().warnings ?? []).toContain('older-device');
  });

  it('critère 3 : A mis à jour en 19 : la ligne arrive sur B, une seule fois, mêmes valeurs ; avertissement levé ; aucun conflit', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await createTargetOn18(a);
    await roundTrip();
    expect((await parked(b)).length).toBe(2);
    await a.upgradeSchema('i0');
    await roundTrip();
    expect(await cycleRow(b)).toEqual(await cycleRow(a));
    expect(await targetRow(b)).toEqual(await targetRow(a));
    expect((await cycleRow(b)).length).toBe(1);
    expect(await parked(b)).toEqual([]);
    expect(b.service.status().warnings ?? []).not.toContain('older-device');
    expect(await conflicts(a)).toBe(0);
    expect(await conflicts(b)).toBe(0);
    // Une fois : un nouvel échange ne republie rien et ne change rien.
    const before = await cycleRow(b);
    await roundTrip();
    expect(await a.data.repos.sync.outboxCount()).toBe(0);
    expect(await cycleRow(b)).toEqual(before);
  });

  it('critère 3 : ligne modifiée sur 18 après sa création (opérations en plusieurs parties) : valeur finale de A sur B après la mise à jour', async () => {
    const { a, b } = await mixed();
    await createCycleOn18(a);
    await roundTrip();
    a.clock.advance(5_000);
    await a.driver.execute('UPDATE mesocycle SET weeks = 6, updated_at = ?, hlc = ? WHERE id = ?', [iso(a), a.hlc.now(), M1]);
    await roundTrip();
    expect(await cycleRow(b)).toEqual([]);
    await a.upgradeSchema('i0');
    await roundTrip();
    expect(await cycleRow(b)).toEqual(await cycleRow(a));
    expect((await cycleRow(b))[0]).toMatchObject({ weeks: 6, next_weeks: null, ramp_up: null });
    expect(await parked(b)).toEqual([]);
  });

  it('critère 3 : appareil déjà en 19 sans republication (0.24.0) : ses lignes repartent une fois, l’autre les a déjà : rien ne change, aucun conflit', async () => {
    const b = await createSimDevice(NEW_ID, { name: 'PC', schema: 'i0' });
    const a = await createSimDevice(OLD_ID, { name: 'iPhone', schema: 'i0', clock: createManualClock(b.clock.nowMs()) });
    devices = [b, a];
    await setupFirst(b);
    await b.cycle();
    await pair(b, a);
    await a.cycle();
    syncFolders(devices);
    await b.cycle();
    await a.driver.execute(
      `INSERT INTO mesocycle (id, routine_id, start_date, weeks, unlimited, deload_week, block_origin_week, block_origin_index, rotation_index, pauses, status, outcome, ended_on, next_weeks, ramp_up, created_at, updated_at, device_id, hlc)
       VALUES (?, ?, '2026-11-16', 5, 0, NULL, 1, 0, 0, '[]', 'active', NULL, NULL, 6, 1, ?, ?, ?, ?)`,
      [M1, ROUTINE, iso(a), iso(a), a.id, a.hlc.now()],
    );
    await roundTrip();
    const before = await cycleRow(b);
    expect(before).toEqual(await cycleRow(a));
    // Marque de republication absente : base d'un appareil passé en 19 avec la 0.24.0.
    await a.driver.execute("DELETE FROM sync_meta WHERE key = 'schemaRepublished'");
    await a.cycle();
    expect(await a.data.repos.sync.outboxCount()).toBe(0);
    expect(a.logger.entries.map((e) => e.event)).toContain('schema-republished');
    syncFolders(devices);
    await roundTrip();
    expect(await cycleRow(b)).toEqual(before);
    expect(await conflicts(a)).toBe(0);
    expect(await conflicts(b)).toBe(0);
    const republished = a.logger.entries.filter((e) => e.event === 'schema-republished').length;
    await roundTrip();
    expect(a.logger.entries.filter((e) => e.event === 'schema-republished').length).toBe(republished);
  });
});

describe('SYNC-01 : republication', () => {
  it('entrée « ligne entière » identique à celle du publieur', () => {
    expect(WHOLE_ROW_FIELD).toBe(ROW_REPUBLISH_FIELD);
  });
});
