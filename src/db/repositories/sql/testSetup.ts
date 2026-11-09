import { createManualClock, type ManualClock } from '../../../domain/clock';
import { createHlcClock, createWriteStamper } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import type { SqlDriver } from '../../driver';
import { openSqliteWasmDriver } from '../../drivers/sqliteWasm';
import { legacyMigrations as migrations } from '../../../../tests/fixtures/legacy-schema';
import { migrate } from '../../migrator';
import { migrations as baseMigrations } from '../../migrations';
import { createSqlRepositoriesFor } from './index';
import { createDataAccess, type DataAccess, type RepositoryFactory, type RepositoryOptions } from '../dataAccess';
import { SYNC_CATALOGUE } from '../../../domain/sync/syncTables';
import { createLegacyRepositories } from '../../../../tests/fixtures/legacy-schema/catalogue';

/**
 * Base de test : driver SQLite Wasm en mémoire, migrations de l'app appliquées,
 * `DataAccess` branché sur `createSqlRepositories` avec une horloge manuelle
 * (hlc et updated_at déterministes, avançables avec `clock.advance(ms)`).
 */
export interface TestDb {
  readonly driver: SqlDriver;
  readonly data: DataAccess;
  readonly clock: ManualClock;
  readonly deviceId: DeviceId;
  close(): Promise<void>;
}

export async function openTestDb(
  deviceId: DeviceId,
  startAt: string | number = '2026-10-01T08:00:00.000Z',
): Promise<TestDb> {
  const driver = await openSqliteWasmDriver();
  await migrate(driver, migrations);
  const clock = createManualClock(startAt);
  const hlc = createHlcClock({ clock, deviceId });
  const stamper = createWriteStamper(clock, hlc);
  const data = createDataAccess(driver, stamper, createLegacyRepositories);
  return { driver, data, clock, deviceId, close: () => driver.close() };
}

/**
 * Base de test sur la base neuve (migrations réelles, catalogue de production). Par défaut l'appareil de test ÉCRIT les résumés de récupération
 * (comme l'iPhone) ; `{ recoveryWriter: false }` simule le PC lecteur (I5-01) ; `factory` remplace la fabrique (stockage de production).
 */
export async function openBaseDb(deviceId: DeviceId, startAt: string | number = '2026-10-01T08:00:00.000Z', options: RepositoryOptions & { readonly factory?: RepositoryFactory } = {}): Promise<TestDb> {
  const driver = await openSqliteWasmDriver();
  await migrate(driver, baseMigrations);
  const clock = createManualClock(startAt);
  const hlc = createHlcClock({ clock, deviceId });
  const { factory, ...repositoryOptions } = options;
  const data = createDataAccess(driver, createWriteStamper(clock, hlc), factory ?? createSqlRepositoriesFor(SYNC_CATALOGUE, { recoveryWriter: true, ...repositoryOptions }));
  return { driver, data, clock, deviceId, close: () => driver.close() };
}
