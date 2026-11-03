import { describe, expect, it } from 'vitest';
import { createUnavailableFiles } from '../../platform';
import { openSqliteWasmDriver } from '../../db/drivers/sqliteWasm';
import { legacyMigrations } from '../../../tests/fixtures/legacy-schema';
import { LEGACY_STORAGE } from '../../../tests/fixtures/legacy-schema/catalogue';
import { createStorage, SYNC_STORAGE } from '../../db/repositories';
import { SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import { bootstrapApp, type BootstrapAppOptions } from './bootstrap';

/** Point de relecture sync-icloud (a) : catalogue et repositories voyagent dans un seul objet, jamais l'un sans l'autre. */

const common = { desktop: null, files: createUnavailableFiles(), syncPlatform: null } as const;

describe('stockage de synchro : catalogue et repositories ensemble', () => {
  it('le stockage de production porte le catalogue I0 et les repositories qui lui correspondent', () => {
    expect(SYNC_STORAGE.catalogue).toBe(SYNC_CATALOGUE);
    expect(createStorage(SYNC_CATALOGUE).catalogue).toBe(SYNC_CATALOGUE);
  });

  it('bootstrapApp n’accepte plus de catalogue ni de repositories isolés', () => {
    // @ts-expect-error `catalogue` seul n'existe plus : il faut `storage`.
    const alone: BootstrapAppOptions = { catalogue: SYNC_CATALOGUE };
    // @ts-expect-error `repositories` seul n'existe plus : il faut `storage`.
    const other: BootstrapAppOptions = { repositories: () => undefined };
    expect([alone, other]).toHaveLength(2);
  });

  it('un stockage legacy démarre sur le schéma legacy : le moteur et les repositories parlent du même catalogue', async () => {
    const db = await openSqliteWasmDriver();
    const container = await bootstrapApp({ ...common, open: () => Promise.resolve(db), migrations: legacyMigrations, storage: LEGACY_STORAGE });
    expect(container?.catalogue).toBe(LEGACY_STORAGE.catalogue);
    expect(await container?.data.repos.syncMeta.maxHlc()).not.toBeUndefined();
  });
});
