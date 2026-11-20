import { afterEach, describe, expect, it } from 'vitest';
import type { EpochId, SyncValue } from '../../../../src/domain/sync/format';
import type { DeviceId, Hlc, IsoDateTime } from '../../../../src/domain/types';
import type { SyncDeps } from '../../../../src/sync/deps';
import { mergeSnapshot, type LoadedSnapshot } from '../../../../src/sync/snapshot';
import { createSimDevice, pair, setupFirst, syncFolders, V18_CATALOGUE, type SimDevice } from '../../../sim/syncDevice';

/**
 * FIX-A009, passe qa-test : cas limites de la conservation des colonnes inconnues d'une table connue reçues par instantané. Lecteur réel au
 * schéma 18 (SQLite du banc, `nutrition_target` sans les colonnes de la 0019), vrai `mergeSnapshot`, instantanés synthétiques ; puis deux
 * appareils pour une ligne supprimée. Données synthétiques (D-292).
 */
const WRITER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20' as DeviceId;
const READER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb18';
const TARGET = '5c1d0e2f-0000-4000-8000-000000000a09';
const EPOCH = `e0001-${WRITER}` as EpochId;

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

const hlcAt = (ms: number): Hlc => `${String(ms).padStart(15, '0')}-0000-${WRITER}` as Hlc;

/** Lecteur 18 avec la cible déjà présente (écrite sous garde : rien dans la file). */
async function reader(): Promise<{ b: SimDevice; deps: SyncDeps; base: number }> {
  const b = await createSimDevice(READER, { name: 'iPhone', schema: 'v18' });
  devices = [b];
  const base = b.clock.nowMs() - 60_000;
  const at = new Date(base).toISOString();
  await b.driver.transaction(async (tx) => {
    await tx.execute('INSERT INTO sync_guard (id) VALUES (1)');
    await tx.execute(
      `INSERT INTO nutrition_target (id, week_start, kcal, protein_g, fat_g, carb_g, source, accepted, engine_version, created_at, updated_at, device_id, hlc)
       VALUES (?, '2026-11-16', 2500, 150, 70, 316, 'manual', 1, NULL, ?, ?, ?, ?)`,
      [TARGET, at, at, WRITER, hlcAt(base)],
    );
    await tx.execute('DELETE FROM sync_guard');
  });
  const deps = { deviceId: b.id, catalogue: V18_CATALOGUE, sv: 18, data: b.data, clock: b.clock, hlc: b.hlc, logger: b.logger } as unknown as SyncDeps;
  return { b, deps, base };
}

function snapshot(sv: number, star: Hlc, fields: Record<string, SyncValue>, clocks: Record<string, Hlc> = {}): LoadedSnapshot {
  const row = new Map<string, SyncValue>([['id', TARGET], ['kcal', 2500], ...Object.entries(fields)]);
  return {
    records: [{ k: 'snap-rows', rows: [['nutrition_target', row, new Map<string, Hlc>([['*', star], ...Object.entries(clocks)])]] }],
    end: { k: 'snap-end', count: 1, covers: new Map(), epoch: EPOCH, sv },
  } as unknown as LoadedSnapshot;
}

const merge = (deps: SyncDeps, snap: LoadedSnapshot, sv = snap.end.sv) => mergeSnapshot(deps, snap, { catalogue: deps.catalogue, localSv: 18, remoteSv: sv, now: new Date(deps.clock.nowMs()).toISOString() as IsoDateTime, knows: () => true, logger: deps.logger });
const unknownOf = (d: SimDevice) => d.driver.select<{ field: string; value: string; hlc: string; sv: number }>("SELECT field, value, hlc, sv FROM sync_unknown WHERE table_name = 'nutrition_target' ORDER BY field");
const conflicts = async (d: SimDevice) => (await d.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n;

describe('FIX-A009, qa-test : cas limites', () => {
  it('lecteur déjà au même schéma (instantané 18) : aucun champ gardé, aucun changement', async () => {
    const { b, deps, base } = await reader();
    const before = await b.driver.select('SELECT * FROM nutrition_target');
    await merge(deps, snapshot(18, hlcAt(base), { rest_kcal: 2200 }));
    expect(await unknownOf(b)).toEqual([]);
    expect(await b.driver.select('SELECT * FROM nutrition_target')).toEqual(before);
  });

  it('horloge plus ancienne que celle déjà gardée : la valeur gardée la plus récente reste', async () => {
    const { b, deps, base } = await reader();
    await merge(deps, snapshot(19, hlcAt(base), { rest_kcal: 2300 }, { rest_kcal: hlcAt(base + 20_000) }));
    await merge(deps, snapshot(19, hlcAt(base), { rest_kcal: 2200 }, { rest_kcal: hlcAt(base + 10_000) }));
    expect(await unknownOf(b)).toEqual([{ field: 'rest_kcal', value: '2300', hlc: hlcAt(base + 20_000), sv: 19 }]);
  });

  it('deux instantanés successifs : le même rejoué ne double rien ; le suivant plus récent remplace la valeur gardée', async () => {
    const { b, deps, base } = await reader();
    const first = snapshot(19, hlcAt(base), { rest_kcal: 2200 });
    await merge(deps, first);
    await merge(deps, first);
    expect(await unknownOf(b)).toEqual([{ field: 'rest_kcal', value: '2200', hlc: hlcAt(base), sv: 19 }]);
    await merge(deps, snapshot(20, hlcAt(base), { rest_kcal: 2100 }, { rest_kcal: hlcAt(base + 5_000) }));
    expect(await unknownOf(b)).toEqual([{ field: 'rest_kcal', value: '2100', hlc: hlcAt(base + 5_000), sv: 20 }]);
  });

  it('mêmes validations que le journal : colonnes techniques et noms invalides jamais gardés ; mise à jour : réintégré, sans conflit', async () => {
    const { b, deps, base } = await reader();
    await merge(deps, snapshot(19, hlcAt(base), { rest_kcal: 2200, hlc: hlcAt(base), device_id: WRITER, updated_at: '2026-11-19T10:00:00.000Z', 'Rest-Kcal': 1 }));
    expect((await unknownOf(b)).map((f) => f.field)).toEqual(['rest_kcal']);
    await b.upgradeSchema('i0');
    expect(await b.driver.select('SELECT kcal, rest_kcal FROM nutrition_target WHERE id = ?', [TARGET])).toEqual([{ kcal: 2500, rest_kcal: 2200 }]);
    expect(await unknownOf(b)).toEqual([]);
    expect(await conflicts(b)).toBe(0);
  });

  it.each(['journal', 'snapshot'] as const)('colonne inconnue d’une ligne supprimée (deleted_at), reçue par %s : gardée, gardée comme par le journal, ligne jamais ressuscitée', async (route) => {
    const a = await createSimDevice(WRITER, { name: 'PC', schema: 'i0' });
    const b = await createSimDevice(READER, { name: 'iPhone', schema: 'v18', clock: a.clock });
    devices = [a, b];
    await setupFirst(a);
    await a.cycle();
    if (route === 'journal') {
      await pair(a, b);
      await b.cycle();
      syncFolders(devices);
    }
    const at = new Date(a.clock.nowMs()).toISOString();
    const created = a.hlc.now();
    await a.driver.execute(
      `INSERT INTO nutrition_target (id, week_start, kcal, protein_g, fat_g, carb_g, source, accepted, engine_version, rest_kcal, rest_carb_g, training_days, created_at, updated_at, device_id, hlc)
       VALUES (?, '2026-11-16', 2500, 150, 70, 316, 'manual', 1, NULL, 2200, 240, '135', ?, ?, ?, ?)`,
      [TARGET, at, at, a.id, created],
    );
    a.clock.advance(1_000);
    const later = new Date(a.clock.nowMs()).toISOString();
    await a.driver.execute('UPDATE nutrition_target SET deleted_at = ?, updated_at = ?, hlc = ? WHERE id = ?', [later, later, a.hlc.now(), TARGET]);
    await a.cycle();
    if (route === 'snapshot') {
      a.clock.advance(8 * 86_400_000);
      await a.cycle();
      a.clock.advance(11 * 60_000);
      await pair(a, b);
    } else syncFolders(devices);
    await b.cycle();
    // Même conservation par l'instantané que par le journal : valeur, horloge propre (création) et `sv` de l'écrivain.
    expect(await unknownOf(b)).toEqual([
      { field: 'rest_carb_g', value: '240', hlc: created, sv: 20 },
      { field: 'rest_kcal', value: '2200', hlc: created, sv: 20 },
      { field: 'training_days', value: '"135"', hlc: created, sv: 20 },
    ]);
    await b.upgradeSchema('i0');
    // La ligne reste supprimée (jamais ressuscitée). Valeur réintégrée et conflits non affirmés ici : défaut antérieur de la réintégration
    // (horloge « * » plus récente que le champ gardé : valeur écartée et conflit inscrit, journal compris), hors A-009, soumis à l'architect
    // (docs/FIX-A009.md, « Reste »).
    expect(await b.driver.select('SELECT deleted_at IS NOT NULL AS deleted FROM nutrition_target WHERE id = ?', [TARGET])).toEqual([{ deleted: 1 }]);
  });
});
