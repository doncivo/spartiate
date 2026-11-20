import { afterEach, describe, expect, it } from 'vitest';
import type { EpochId, SyncValue } from '../../../../src/domain/sync/format';
import type { DeviceId, Hlc, IsoDateTime } from '../../../../src/domain/types';
import { reintegrateUnknownFields } from '../../../../src/db/repositories/sql/syncUnknown';
import type { SyncDeps } from '../../../../src/sync/deps';
import { replaceFromSnapshot, type LoadedSnapshot } from '../../../../src/sync/snapshot';
import { createSimDevice, V18_CATALOGUE, type SimDevice } from '../../../sim/syncDevice';

/**
 * FIX-A009b, passe qa-test : cas limites de la règle de réintégration de l'avenant 39 (ADR 0011) et test manquant de FIX-A009 (filtre
 * `retained` du remplacement d'époque). Une base réelle (SQLite du banc), vraie réintégration (`reintegrateUnknownFields`), vrai
 * `replaceFromSnapshot`, lignes et instantanés synthétiques (D-292).
 */
const LOCAL = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
const WRITER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21' as DeviceId;
const TARGET = '5c1d0e2f-0000-4000-8000-000000000b09';
const OTHER = '5c1d0e2f-0000-4000-8000-000000000b10';
const EPOCH = `e0002-${WRITER}` as EpochId;

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

const hlcAt = (ms: number, dev: string = WRITER): Hlc => `${String(ms).padStart(15, '0')}-0000-${dev}` as Hlc;
const unknownOf = (d: SimDevice) => d.driver.select<{ field: string; sv: number }>('SELECT field, sv FROM sync_unknown ORDER BY row_id, field');
const conflicts = async (d: SimDevice) => (await d.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n;
const targetOf = (d: SimDevice) => d.driver.select('SELECT kcal, rest_kcal, rest_carb_g, training_days FROM nutrition_target WHERE id = ?', [TARGET]);

/** Appareil au schéma 20 avec la cible présente, écrite sous garde avec son repli « * » à `star` (colonnes de la 0019 nulles). */
async function device(): Promise<{ d: SimDevice; base: number }> {
  const d = await createSimDevice(LOCAL, { name: 'iPhone', schema: 'i0' });
  devices = [d];
  const base = d.clock.nowMs() - 60_000;
  const at = new Date(base).toISOString();
  await d.driver.transaction(async (tx) => {
    await tx.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await tx.execute(
      `INSERT INTO nutrition_target (id, week_start, kcal, protein_g, fat_g, carb_g, source, accepted, engine_version, created_at, updated_at, device_id, hlc)
       VALUES (?, '2026-11-16', 2500, 150, 70, 316, 'manual', 1, NULL, ?, ?, ?, ?)`,
      [TARGET, at, at, WRITER, hlcAt(base + 5_000)],
    );
    await tx.execute("INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc) VALUES ('nutrition_target', ?, '*', ?, NULL)", [TARGET, hlcAt(base + 5_000)]);
    await tx.execute('DELETE FROM sync_guard');
  });
  return { d, base };
}

const keep = (d: SimDevice, row: string, field: string, value: SyncValue, hlc: Hlc, sv: number) =>
  d.driver.execute('INSERT INTO sync_unknown (table_name, row_id, field, value, hlc, base_hlc, sv) VALUES (?, ?, ?, ?, ?, NULL, ?)', ['nutrition_target', row, field, JSON.stringify(value), hlc, sv]);
const run = (d: SimDevice) => reintegrateUnknownFields(d.driver, { now: new Date(d.clock.nowMs()).toISOString() as IsoDateTime });

describe('FIX-A009b, qa-test : cas limites de l’avenant 39', () => {
  it('deux champs gardés de schémas différents (19 et 21) sur la même ligne, plus anciens que « * » : tous deux réintégrés, aucun conflit', async () => {
    const { d, base } = await device();
    await keep(d, TARGET, 'rest_kcal', 2200, hlcAt(base + 1_000), 19);
    await keep(d, TARGET, 'training_days', '135', hlcAt(base + 2_000), 21);
    expect(await run(d)).toMatchObject({ reintegrated: 2, superseded: 0, remaining: 0 });
    expect(await targetOf(d)).toEqual([{ kcal: 2500, rest_kcal: 2200, rest_carb_g: null, training_days: '135' }]);
    expect(await conflicts(d)).toBe(0);
  });

  it('réintégration rejouée deux fois : idempotente (même état, rien de plus au second passage)', async () => {
    const { d, base } = await device();
    await keep(d, TARGET, 'rest_kcal', 2200, hlcAt(base + 1_000), 20);
    await run(d);
    const clocks = await d.driver.select('SELECT field, hlc FROM sync_field_clock WHERE row_id = ? ORDER BY field', [TARGET]);
    expect(await run(d)).toMatchObject({ reintegrated: 0, superseded: 0, remaining: 0 });
    expect(await targetOf(d)).toEqual([{ kcal: 2500, rest_kcal: 2200, rest_carb_g: null, training_days: null }]);
    expect(await d.driver.select('SELECT field, hlc FROM sync_field_clock WHERE row_id = ? ORDER BY field', [TARGET])).toEqual(clocks);
    expect(clocks).toContainEqual({ field: 'rest_kcal', hlc: hlcAt(base + 1_000) });
    expect(await conflicts(d)).toBe(0);
  });

  it('horloge propre égale à celle du champ gardé : rien n’est écrit, le champ quitte sync_unknown', async () => {
    const { d, base } = await device();
    await d.driver.transaction(async (tx) => {
      await tx.execute('INSERT INTO sync_guard (id) VALUES (1)');
      await tx.execute('UPDATE nutrition_target SET rest_kcal = 2100 WHERE id = ?', [TARGET]);
      await tx.execute("INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc) VALUES ('nutrition_target', ?, 'rest_kcal', ?, NULL)", [TARGET, hlcAt(base + 1_000)]);
      await tx.execute('DELETE FROM sync_guard');
    });
    await keep(d, TARGET, 'rest_kcal', 2200, hlcAt(base + 1_000), 20);
    expect(await run(d)).toMatchObject({ reintegrated: 0, superseded: 1, remaining: 0 });
    expect(await targetOf(d)).toEqual([{ kcal: 2500, rest_kcal: 2100, rest_carb_g: null, training_days: null }]);
    expect(await conflicts(d)).toBe(0);
  });

  it('valeur locale non nulle écrite avec la ligne (« * ») : règle ordinaire, le champ gardé plus ancien est écarté', async () => {
    const { d, base } = await device();
    await d.driver.transaction(async (tx) => {
      await tx.execute('INSERT INTO sync_guard (id) VALUES (1)');
      await tx.execute('UPDATE nutrition_target SET rest_kcal = 2100 WHERE id = ?', [TARGET]);
      await tx.execute('DELETE FROM sync_guard');
    });
    await keep(d, TARGET, 'rest_kcal', 2200, hlcAt(base + 1_000), 20);
    expect(await run(d)).toMatchObject({ reintegrated: 0, superseded: 1, remaining: 0 });
    expect(await targetOf(d)).toEqual([{ kcal: 2500, rest_kcal: 2100, rest_carb_g: null, training_days: null }]);
  });

  it('ligne purgée puis absente (trace) : champ gardé antérieur retiré, rien recréé ; postérieur : attend (ligne incomplète)', async () => {
    const { d, base } = await device();
    await d.driver.transaction(async (tx) => {
      await tx.execute('INSERT INTO sync_guard (id) VALUES (1)');
      await tx.execute("DELETE FROM sync_field_clock WHERE row_id = ?", [TARGET]);
      await tx.execute('DELETE FROM nutrition_target WHERE id = ?', [TARGET]);
      await tx.execute("INSERT INTO sync_tombstone (table_name, row_id, deleted_hlc, purged_at) VALUES ('nutrition_target', ?, ?, ?)", [TARGET, hlcAt(base + 3_000), new Date(base).toISOString()]);
      await tx.execute('DELETE FROM sync_guard');
    });
    await keep(d, TARGET, 'rest_kcal', 2200, hlcAt(base + 1_000), 20);
    await keep(d, TARGET, 'rest_carb_g', 240, hlcAt(base + 4_000), 20);
    expect(await run(d)).toMatchObject({ reintegrated: 0, superseded: 1, remaining: 1 });
    expect(await targetOf(d)).toEqual([]);
    expect(await unknownOf(d)).toEqual([{ field: 'rest_carb_g', sv: 20 }]);
    expect(await conflicts(d)).toBe(0);
  });

  it('ligne recréée (présente de nouveau, « * » postérieur au champ gardé, colonne nulle) : la valeur gardée s’applique, sans conflit', async () => {
    const { d, base } = await device();
    await keep(d, TARGET, 'rest_kcal', 2200, hlcAt(base - 30_000), 20);
    expect(await run(d)).toMatchObject({ reintegrated: 1, superseded: 0, remaining: 0 });
    expect(await targetOf(d)).toEqual([{ kcal: 2500, rest_kcal: 2200, rest_carb_g: null, training_days: null }]);
    expect(await conflicts(d)).toBe(0);
  });
});

describe('FIX-A009, test manquant : filtre `retained` du remplacement d’époque', () => {
  it('une ligne écartée par l’horizon de remise à zéro ne laisse aucune colonne gardée ; la ligne reprise garde la sienne', async () => {
    const b = await createSimDevice('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb18', { name: 'iPhone', schema: 'v18' });
    devices = [b];
    const base = b.clock.nowMs() - 60_000;
    const horizon = hlcAt(base + 10_000);
    await b.driver.execute("INSERT INTO sync_meta (key, value) VALUES ('dataResetSeen', ?)", [horizon]);
    const full = (id: string, created: Hlc, star: Hlc): [string, Map<string, SyncValue>, Map<string, Hlc>] => [
      'nutrition_target',
      new Map<string, SyncValue>([
        ['id', id], ['week_start', '2026-11-16'], ['kcal', 2500], ['protein_g', 150], ['fat_g', 70], ['carb_g', 316], ['source', 'manual'], ['accepted', 1],
        ['engine_version', null], ['created_at', new Date(base).toISOString()], ['deleted_at', null], ['rest_kcal', 2200],
      ]),
      new Map<string, Hlc>([['*', star], ['created_at', created]]),
    ];
    const snap = {
      records: [{ k: 'snap-rows', rows: [full(TARGET, hlcAt(base + 1_000), hlcAt(base + 1_000)), full(OTHER, hlcAt(base + 20_000), hlcAt(base + 20_000))] }],
      end: { k: 'snap-end', count: 2, covers: new Map(), epoch: EPOCH, sv: 20 },
    } as unknown as LoadedSnapshot;
    const deps = { deviceId: b.id, catalogue: V18_CATALOGUE, sv: 18, data: b.data, clock: b.clock, hlc: b.hlc, logger: b.logger } as unknown as SyncDeps;
    expect(await replaceFromSnapshot(deps, snap)).not.toBe('clock-ahead');
    expect(await b.driver.select('SELECT id FROM nutrition_target ORDER BY id')).toEqual([{ id: OTHER }]);
    expect(await b.driver.select('SELECT row_id, field FROM sync_unknown')).toEqual([{ row_id: OTHER, field: 'rest_kcal' }]);
  });
});
