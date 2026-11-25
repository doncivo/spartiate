import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import type { LocalDate } from '../../../../src/domain/types';
import { createSimDevice, pair, setupFirst, syncFolders, warmSimDevices, type SimDevice } from '../../../sim/syncDevice';
import { backupOf } from '../epochCarryKit';

/**
 * DATA-0293 (§ 21.2 a, `synchronous = NORMAL`, D-584) : en WAL avec NORMAL, une coupure de courant ou un plantage du système peut ramener la base locale
 * avant des validations déjà PUBLIEES (le dossier journal, lui, les garde). Simulation : un poids est publié, puis la base de A est ramenée à un état
 * d'avant (toutes les tables, sans marqueur de restauration : rien ne dit à l'app que la base a reculé). Constat sur le moteur au cycle suivant :
 * aucune perte chez B, aucun segment écrasé, aucun conflit, et A RETROUVE le poids publié (le moteur relit son propre journal) : convergence, aucune
 * alerte à ajouter (D-584). Valeurs synthétiques.
 */
const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let devices: SimDevice[] = [];
beforeAll(() => warmSimDevices());
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

/** Retour en arrière de la base, SANS marqueur de restauration (contrairement à `restore` du kit). */
async function rollBack(device: SimDevice, copy: Map<string, unknown[]>): Promise<void> {
  await device.driver.execute('PRAGMA foreign_keys = OFF');
  await device.driver.transaction(async (tx) => {
    await tx.execute('INSERT INTO sync_guard (id) VALUES (1)');
    for (const [table, rows] of copy) {
      if (table === 'sync_guard' || table === 'schema_migrations') continue;
      await tx.execute(`DELETE FROM ${table}`);
      for (const row of rows as Record<string, string | number | null>[]) {
        const cols = Object.keys(row);
        await tx.execute(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] ?? null));
      }
    }
    await tx.execute('DELETE FROM sync_guard');
  });
  await device.driver.execute('PRAGMA foreign_keys = ON');
  await device.restart();
}

async function roundTrip(times = 3): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}
const weights = (d: SimDevice) => d.driver.select<{ id: string; kg: number }>('SELECT id, kg FROM body_weight WHERE deleted_at IS NULL ORDER BY id');
const D1 = '2026-11-20' as LocalDate;
const D2 = '2026-11-21' as LocalDate;

describe('base locale ramenée avant une publication (synchronous = NORMAL)', () => {
  it('B garde tout, aucun segment écrasé, aucun conflit ; A retrouve le poids publié (convergence)', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
    devices = [a, b];
    await setupFirst(a);
    await a.cycle();
    await pair(a, b);
    await b.cycle();
    syncFolders(devices);
    await a.cycle();
    await roundTrip(2);
    const before = await backupOf(a);
    await (await a.data.repos.bodyWeights()).saveManual({ date: D1, kg: 80, timezone: 'Europe/Paris' }, D1);
    await roundTrip(2);
    expect(await weights(b)).toEqual([{ id: 'weight|2026-11-20|manual', kg: 80 }]);
    const files = a.folder.fileNames(a.id).filter((n) => n.endsWith('.spj'));
    const sizes = files.map((f) => a.folder.fileSize(a.id, f));
    await rollBack(a, before);
    expect(await weights(a)).toEqual([]);
    // Cycle suivant puis nouvelle écriture sur A : jamais d'exception, jamais de segment écrasé.
    await (await a.data.repos.bodyWeights()).saveManual({ date: D2, kg: 79, timezone: 'Europe/Paris' }, D2);
    await roundTrip(4);
    for (const [i, f] of files.entries()) expect(a.folder.fileSize(a.id, f), f).toBeGreaterThanOrEqual(sizes[i] ?? 0);
    expect(await weights(b)).toEqual([
      { id: 'weight|2026-11-20|manual', kg: 80 },
      { id: 'weight|2026-11-21|manual', kg: 79 },
    ]);
    expect((await b.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n).toBe(0);
    expect((await a.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n).toBe(0);
    expect(await a.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    // Constat : A retrouve le poids publié (le moteur relit son propre journal quand la base a reculé) : convergence, aucune alerte nécessaire.
    expect(await weights(a)).toEqual(await weights(b));
    expect(a.service.status().warnings ?? []).toEqual([]);
  });
});
