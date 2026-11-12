import { createManualClock, type ManualClock } from '../../src/domain/clock';
import { createHlcClock, createWriteStamper, type HlcClock } from '../../src/domain/hlc';
import type { Task } from '../../src/domain/model';
import type { DeviceId, LocalDate, SpaceId, TaskId } from '../../src/domain/types';
import type { SqlDriver } from '../../src/db/driver';
import { exportSqliteWasmImage, openSqliteWasmDriver } from '../../src/db/drivers/sqliteWasm';
import { legacyMigrations as legacyMigrationList } from '../fixtures/legacy-schema';
import { migrate } from '../../src/db/migrator';
import { createDataAccess, createSqlRepositoriesFor, createStorage, type DataAccess } from '../../src/db/repositories';
import { migrations as i0Migrations } from '../../src/db/migrations';
import { SYNC_CATALOGUE, createCatalogue } from '../../src/domain/sync/syncTables';
import { SYNC_TABLE_ORDER } from '../../src/domain/sync/format';
import { LEGACY_SYNC_CATALOGUE, createLegacyRepositories } from '../fixtures/legacy-schema/catalogue';
import { createMemorySyncPlatform, type MemorySyncFolder, type MemorySyncPlatform } from '../../src/platform/sync/memory';
import type { RemoteChanges, SyncStatus } from '../../src/platform/sync/types';
import { createMemorySyncLogger, createSyncService, type SyncEngineService } from '../../src/sync';
import { createSimFolder, propagate, type PropagateOptions } from './syncCloudSim';

/**
 * Appareil simulé (ADR 0011, section 12) : sa base SQLite Wasm (migrations de l'app), son horloge contrôlée, son `HlcClock`, son coffre
 * et **son** dossier iCloud simulé, la plateforme mémoire `SyncPlatform` et le vrai service de synchro. Plusieurs appareils dans le même
 * processus échangent leurs dossiers par `syncCloudSim.propagate`.
 */

export const PRO = '00000000-0000-4000-8000-000000000001' as SpaceId;
export const SCHEMA_VERSION = legacyMigrationList.at(-1)?.version ?? 1;

export interface SimDevice {
  /** Identifiant d'appareil ; change seulement par `restartAs` (Y-10, « Associer de nouveau »). */
  id: DeviceId;
  readonly name: string;
  /** I-06 : plateforme simulée (`windows` par défaut) ; l'iPhone importe la clé depuis la fenêtre principale (ADR 0011 §23). */
  readonly devicePlatform: 'windows' | 'ios';
  readonly driver: SqlDriver;
  readonly data: DataAccess;
  readonly clock: ManualClock;
  hlc: HlcClock;
  readonly folder: MemorySyncFolder;
  platform: MemorySyncPlatform;
  service: SyncEngineService;
  readonly logger: ReturnType<typeof createMemorySyncLogger>;
  readonly changes: RemoteChanges[];
  /** Un cycle complet ; renvoie l'état obtenu. */
  cycle(): Promise<SyncStatus>;
  /** Nouvelle instance de l'app sur la même base et le même dossier (redémarrage). */
  restart(): Promise<void>;
  /** Y-10 (« Associer de nouveau ») : redémarrage sous l'identité `device.id` posée par le moteur (même base, dossier, plateforme). */
  restartAs(id: DeviceId): Promise<void>;
  createTask(title: string, extra?: Partial<Task>): Promise<Task>;
  updateTask(id: TaskId, patch: Parameters<DataAccess['repos']['tasks']['update']>[1]): Promise<Task>;
  deleteTask(id: TaskId): Promise<void>;
  task(id: TaskId): Promise<Task | null>;
  close(): Promise<void>;
}

let counter = 0;

/**
 * Base migrée construite une seule fois par processus de test : chaque appareil en reçoit une copie au lieu de rejouer les
 * 17 migrations (la moitié du coût d'un test à deux appareils).
 */
/** `legacy` : ancien schéma et ancien catalogue (banc de test, D-67) ; `i0` : migration 0001 réelle et catalogue de production. */
export type SimSchema = 'legacy' | 'i0' | 'v3' | 'v5' | 'v6' | 'v7' | 'v8' | 'v9' | 'v10';

/**
 * I1-03 : `v3` : base et catalogue d'une app arrêtée à la migration 0003 (séance locale, ni `workout` ni `workout_set` publiées), `sv` = 3 :
 * appareil pas encore mis à jour qui reçoit des séances closes d'un appareil en schéma 4.
 */
export const V3_CATALOGUE = createCatalogue({ tables: SYNC_CATALOGUE.tables.slice(0, 7), order: SYNC_TABLE_ORDER.slice(0, 7) });
/**
 * I2-01 (PR 2/2) : `v5` : base et catalogue de la 0.3.0 (migration 0005 : tables de progression LOCALES, absentes du catalogue ; séries sans
 * difficulté publiée), `sv` = 5 : appareil pas encore mis à jour qui reçoit profils, décisions et difficultés d'un appareil en 0.3.1.
 */
export const V5_CATALOGUE = createCatalogue({
  tables: SYNC_CATALOGUE.tables.slice(0, 9).map((t) => (t.name === 'workout_set' ? { ...t, columns: t.columns.filter((c) => c.name !== 'difficulty') } : t)),
  order: SYNC_TABLE_ORDER.slice(0, 9),
});
/** I3-02 : `v6` : base et catalogue sans mésocycle (migration 0006), `sv` = 6 : appareil pas encore mis à jour qui reçoit des cycles. */
export const V6_CATALOGUE = createCatalogue({ tables: SYNC_CATALOGUE.tables.slice(0, 11), order: SYNC_TABLE_ORDER.slice(0, 11) });
/** I4-02 : `v7` : base et catalogue sans nutrition (migration 0007), `sv` = 7 : appareil pas encore mis à jour qui reçoit fiches, portions, entrées et cibles. */
export const V7_CATALOGUE = createCatalogue({ tables: SYNC_CATALOGUE.tables.slice(0, 12), order: SYNC_TABLE_ORDER.slice(0, 12) });
/** I4-07 : `v8` : base et catalogue sans recettes ni journée complète (migration 0008), `sv` = 8 : appareil pas encore mis à jour qui reçoit `recipe`, `recipe_ingredient` et `day_completeness`. */
export const V8_CATALOGUE = createCatalogue({ tables: SYNC_CATALOGUE.tables.slice(0, 16), order: SYNC_TABLE_ORDER.slice(0, 16) });
/** I5-01 : `v9` : base et catalogue sans résumés de récupération (migration 0009), `sv` = 9 : PC pas encore mis à jour qui reçoit `recovery_day` et `muscle_recovery`. */
export const V9_CATALOGUE = createCatalogue({ tables: SYNC_CATALOGUE.tables.slice(0, 19), order: SYNC_TABLE_ORDER.slice(0, 19) });
/** I6-01 : `v10` : base et catalogue sans journal de facteurs (migration 0010), `sv` = 10 : appareil pas encore mis à jour qui reçoit `recovery_factor`. */
export const V10_CATALOGUE = createCatalogue({ tables: SYNC_CATALOGUE.tables.slice(0, 21), order: SYNC_TABLE_ORDER.slice(0, 21) });
const SCHEMA_CATALOGUES = { v3: V3_CATALOGUE, v5: V5_CATALOGUE, v6: V6_CATALOGUE, v7: V7_CATALOGUE, v8: V8_CATALOGUE, v9: V9_CATALOGUE, v10: V10_CATALOGUE } as const;
const schemaMigrations = (schema: SimSchema) => (schema === 'i0' ? i0Migrations : schema === 'v3' ? i0Migrations.slice(0, 3) : schema === 'v5' ? i0Migrations.slice(0, 5) : schema === 'v6' ? i0Migrations.slice(0, 6) : schema === 'v7' ? i0Migrations.slice(0, 7) : schema === 'v8' ? i0Migrations.slice(0, 8) : schema === 'v9' ? i0Migrations.slice(0, 9) : schema === 'v10' ? i0Migrations.slice(0, 10) : legacyMigrationList);
const migratedImages: Partial<Record<SimSchema, Promise<Uint8Array>>> = {};
function migratedDatabaseImage(schema: SimSchema = 'legacy'): Promise<Uint8Array> {
  const migrations = schemaMigrations(schema);
  migratedImages[schema] ??= (async () => {
    const template = await openSqliteWasmDriver();
    try {
      await migrate(template, migrations);
      return await exportSqliteWasmImage(template);
    } finally {
      await template.close();
    }
  })();
  return migratedImages[schema] as Promise<Uint8Array>;
}

/**
 * Coût unique par processus de test (initialisation de SQLite Wasm et les 17 migrations de la base modèle, ~200 ms, bien plus quand la
 * machine est chargée) : à payer dans un `beforeAll`, hors du budget du premier test du fichier.
 */
export async function warmSimDevices(): Promise<void> {
  await migratedDatabaseImage();
}

/** I-06 : `appVersion` (numéro publié, `0.4.0` par défaut) et `devicePlatform` (`windows` par défaut) de l'appareil simulé. */
export async function createSimDevice(id: string, options: { readonly name?: string; readonly start?: string; readonly clock?: ManualClock; readonly appVersion?: string; readonly devicePlatform?: 'windows' | 'ios'; readonly schema?: SimSchema } = {}): Promise<SimDevice> {
  const schema = options.schema ?? 'legacy';
  const catalogue = schema === 'i0' ? SYNC_CATALOGUE : schema === 'legacy' ? LEGACY_SYNC_CATALOGUE : SCHEMA_CATALOGUES[schema];
  const driver = await openSqliteWasmDriver({}, await migratedDatabaseImage(schema));
  const clock = options.clock ?? createManualClock(options.start ?? '2026-10-05T08:00:00.000Z');
  let deviceId = id as DeviceId;
  const folder = createSimFolder();
  const logger = createMemorySyncLogger();
  const changes: RemoteChanges[] = [];
  let hlc = createHlcClock({ clock, deviceId });
  const stamper = { next: () => createWriteStamper(clock, hlc).next() };
  // I5-01 : l'iPhone simulé écrit les résumés de récupération, le PC simulé les lit seulement (comme `bootstrapApp`).
  const repositoryOptions = { recoveryWriter: options.devicePlatform === 'ios' };
  const data = createDataAccess(driver, stamper, schema === 'i0' ? createSqlRepositoriesFor(SYNC_CATALOGUE, repositoryOptions) : schema === 'legacy' ? createLegacyRepositories : createStorage(SCHEMA_CATALOGUES[schema], repositoryOptions).repositories);
  await data.repos.settings.set('device.id', deviceId);

  const makePlatform = (): MemorySyncPlatform => createMemorySyncPlatform({ folder, nowMs: () => clock.nowMs(), ...(options.devicePlatform ? { platform: options.devicePlatform } : {}) });
  const makeService = (platform: MemorySyncPlatform): SyncEngineService => {
    const service = createSyncService({ data, catalogue, platform, hlc, clock, deviceId, ...(options.devicePlatform ? { devicePlatform: options.devicePlatform } : {}), sv: schema === 'legacy' ? SCHEMA_VERSION : (schemaMigrations(schema).at(-1)?.version ?? 1), appVersion: options.appVersion ?? '0.4.0', logger, setTimeout: () => 0, clearTimeout: () => undefined });
    service.onRemoteChanges((c) => changes.push(c));
    return service;
  };
  const platform = makePlatform();
  const device: SimDevice = {
    id: deviceId,
    name: options.name ?? id.slice(0, 4),
    devicePlatform: options.devicePlatform ?? 'windows',
    driver,
    data,
    clock,
    hlc,
    folder,
    platform,
    service: makeService(platform),
    logger,
    changes,
    async cycle() {
      await device.service.syncNow('manual');
      return device.service.status();
    },
    async restart() {
      // Le dossier, le coffre et own.json survivent (Rust) ; l'horloge locale repart de la base (graine, ADR 0005).
      hlc = createHlcClock({ clock, deviceId, seed: await data.repos.syncMeta.maxHlc() });
      device.hlc = hlc;
      device.service = makeService(device.platform);
    },
    async restartAs(next) {
      deviceId = next;
      device.id = next;
      await device.restart();
    },
    async createTask(title, extra = {}) {
      counter += 1;
      const taskId = (extra.id ?? `${String(counter).padStart(8, '0')}-0000-4000-8000-${String(deviceId).slice(24)}`) as TaskId;
      return data.repos.tasks.create({
        id: taskId,
        spaceId: PRO,
        projectId: null,
        title,
        note: '',
        date: '2026-10-05' as LocalDate,
        time: null,
        status: 'todo',
        doneAt: null,
        sortOrder: counter,
        carriedOver: false,
        recurrenceId: null,
        seriesIndex: null,
        seriesTemplate: null,
        goalId: null,
        icon: null,
        someday: false,
        source: 'local',
        externalId: null,
        appleListId: null,
        appleRecurring: false,
        externalEventId: null,
        ...extra,
      });
    },
    updateTask: (taskId, patch) => data.repos.tasks.update(taskId, patch),
    async deleteTask(taskId) {
      await data.repos.tasks.softDelete([taskId]);
    },
    async task(taskId) {
      return (await data.repos.tasks.getById(taskId, { includeDeleted: true })) ?? null;
    },
    close: () => driver.close(),
  };
  return device;
}

/** Premier appareil : choisit son dossier et crée la clé. */
export async function setupFirst(device: SimDevice): Promise<void> {
  await device.platform.folder.choose();
  await device.platform.key.create();
}

/**
 * Associe `joiner` au dossier de `owner` (clé de secours saisie dans la fenêtre `pairing`) ; le dossier de `owner` est d'abord recopié.
 */
export async function pair(owner: SimDevice, joiner: SimDevice): Promise<void> {
  propagate(owner.folder, joiner.folder, owner.id);
  await joiner.platform.folder.choose();
  await owner.platform.key.openPairing('show');
  const payload = await owner.platform.key.pairingPayload();
  await owner.platform.key.closePairing();
  // iPhone : saisie de la clé de secours dans la fenêtre principale (pas de fenêtre `pairing`).
  if (joiner.devicePlatform === 'windows') await joiner.platform.key.openPairing('import');
  await joiner.platform.key.import({ recoveryKey: payload.recoveryKey });
}

/** Recopie mutuelle des dossiers de tous les appareils (iCloud à jour partout). */
export function syncFolders(devices: readonly SimDevice[], options: PropagateOptions = {}): void {
  for (const from of devices) for (const to of devices) if (from !== to) propagate(from.folder, to.folder, from.id, options);
}

/** Valeurs des tâches (titre, note, état, suppression) d'un appareil, triées : comparaison de convergence. */
export async function taskSnapshot(device: SimDevice): Promise<unknown[]> {
  return device.driver.select('SELECT id, title, note, status, date, deleted_at IS NOT NULL AS deleted FROM task ORDER BY id');
}
