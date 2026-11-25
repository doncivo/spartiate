import { afterEach, describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { openSqliteWasmDriver } from '../../../../src/db/drivers/sqliteWasm';
import { migrate, type MigrationPlan } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { migrationManifest } from '../../../../src/db/migrations/manifest';
import { useAppStore } from '../../../../src/features/app/appStore';
import { bootstrapApp } from '../../../../src/features/app/bootstrap';
import { writeExcluded } from '../../../../src/features/training/exclusionsStore';
import { createUnavailableBackup } from '../../../../src/platform/backup';
import { createUnavailableFiles } from '../../../../src/platform/files';
import { createMemorySyncPlatform } from '../../../../src/platform/sync/memory';
import { createSyncService } from '../../../../src/sync';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

vi.mock('../../../../src/sync', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, createSyncService: vi.fn(original['createSyncService'] as typeof createSyncService) };
});

/**
 * DATA-0292 (D-26, BL-138, D-489) : périmètre de non-régression de la synchro pour la migration 0022 (schéma 22, réglages locaux seulement) :
 * (a) rien n'entre dans les horloges, pierres tombales ni file ; (b) une écriture en `sv` 22 est appliquée par un appareil resté en 21 sans rien garder
 * (ni `sync_unknown`, ni `sync_parked`), l'appareil à jour est vu « plus récent » (`schema`) ; (c) `sv` publié = dernière entrée du manifeste ;
 * (d) base à jour : démarrage sans chargement des instructions de migration.
 */
const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OLD = `fitness-park-${String.fromCharCode(97, 110, 116, 111, 110, 121)}`;

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

describe('(a) migration 0022 : aucune trace de synchro', () => {
  it('sync_field_clock, sync_tombstone et sync_outbox restent vides, même avec des réglages à réécrire', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations.slice(0, 21));
    await db.execute("INSERT INTO settings (key, value, updated_at, device_id, hlc) VALUES ('training.activeEquipmentProfile', ?, '2026-11-24T08:00:00.000Z', ?, ?)", [JSON.stringify(OLD), PC, `000000000000001-0000-${PC}`]);
    await db.execute('DELETE FROM sync_outbox');
    await migrate(db, migrations);
    for (const table of ['sync_field_clock', 'sync_tombstone', 'sync_outbox', 'sync_unknown', 'sync_parked']) expect(await db.select(`SELECT 1 FROM ${table}`), table).toEqual([]);
    expect(await db.select("SELECT value FROM settings WHERE key = 'training.activeEquipmentProfile'")).toEqual([{ value: '"salle-complete"' }]);
    await db.close();
  });
});

describe('(b) appareil resté en 21 qui reçoit une écriture en sv 22', () => {
  it('appliquée sans erreur, rien dans sync_unknown ni sync_parked ; l’appareil à jour est « plus récent » (schema)', async () => {
    const pc = await createSimDevice(PC, { name: 'PC', schema: 'v21' });
    const iphone = await createSimDevice(IPHONE, { name: 'iPhone', schema: 'i0', devicePlatform: 'ios', clock: createManualClock(pc.clock.nowMs()) });
    devices = [pc, iphone];
    await setupFirst(pc);
    await pc.cycle();
    await pair(pc, iphone);
    await iphone.cycle();
    syncFolders(devices);
    await pc.cycle();
    await writeExcluded(iphone.data.repos, 'squat-barbell', true);
    let status = await pc.cycle();
    for (let i = 0; i < 2; i += 1) {
      for (const d of devices) {
        d.clock.advance(1_000);
        status = d === pc ? await d.cycle() : (await d.cycle(), status);
      }
      syncFolders(devices);
    }
    status = await pc.cycle();
    expect(await pc.driver.select('SELECT exercise_id FROM exercise_exclusion')).toEqual([{ exercise_id: 'squat-barbell' }]);
    for (const table of ['sync_unknown', 'sync_parked']) expect(await pc.driver.select(`SELECT 1 FROM ${table}`), table).toEqual([]);
    expect(status.devices.find((d) => d.deviceId === IPHONE)).toMatchObject({ status: 'active', newer: 'schema' });
    expect(status.phase).toBe('idle');
  });
});

const common = { desktop: null, files: createUnavailableFiles(), backups: createUnavailableBackup() } as const;

describe('(c) et (d) démarrage d’une base à jour', () => {
  it('sv publié = dernière entrée du manifeste (23) ; aucun chargement des instructions de migration', async () => {
    useAppStore.setState({ dbStatus: 'idle', dbErrorDetail: null });
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations);
    const load = vi.fn(() => Promise.resolve(migrations));
    const plan: MigrationPlan = { entries: migrationManifest, load };
    vi.mocked(createSyncService).mockClear();
    const container = await bootstrapApp({ ...common, open: () => Promise.resolve(db), migrations: plan, syncPlatform: createMemorySyncPlatform() });
    expect(container).toBeDefined();
    expect(load).not.toHaveBeenCalled();
    const options = vi.mocked(createSyncService).mock.calls[0]?.[0];
    expect(options?.sv).toBe(migrationManifest.at(-1)?.version);
    expect(options?.sv).toBe(23);
    await container?.sync?.syncNow('manual');
    expect(container?.sync?.status().phase).not.toBe('error');
    await db.close();
  });
});
