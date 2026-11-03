import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteWasmDriver } from '../../db/drivers/sqliteWasm';
import { migrate } from '../../db/migrator';
import { legacyMigrations as migrations } from '../../../tests/fixtures/legacy-schema';
import { createMemorySyncPlatform } from '../../platform/sync/memory';
import { createUnavailableBackup } from '../../platform/backup';
import { createUnavailableFiles } from '../../platform/files';
import { useAppStore } from './appStore';
import { bootstrapApp } from './bootstrap';

/** Conteneur et démarrage (ADR 0011, section 3.2 et avenant « Amorce » point 7 ; Y-02 critère 19). */

const common = { desktop: null, files: createUnavailableFiles(), migrations } as const;

describe('démarrage et synchro (Y-02 critère 19)', () => {
  beforeEach(() => {
    useAppStore.setState({ dbStatus: 'idle', dbErrorDetail: null });
  });

  it('sans plateforme de synchro (null) ou plateforme indisponible (iPhone avant l’ordre 5) : aucun service (aucun coût ni écran)', async () => {
    const none = await bootstrapApp({ ...common, open: openSqliteWasmDriver, backups: createUnavailableBackup(), syncPlatform: null });
    expect(none?.sync).toBeNull();
    expect(none?.syncPlatform).toBeNull();
    const unavailable = { ...createMemorySyncPlatform(), available: () => false };
    const ios = await bootstrapApp({ ...common, open: openSqliteWasmDriver, backups: createUnavailableBackup(), syncPlatform: unavailable });
    expect(ios?.sync).toBeNull();
  });

  it('par défaut : openSyncPlatform (navigateur : plateforme mémoire), service construit et plateforme partagée avec Réglages', async () => {
    const container = await bootstrapApp({ ...common, open: openSqliteWasmDriver, backups: createUnavailableBackup() });
    expect(container?.sync?.status().phase).toBe('not-configured');
    expect(container?.syncPlatform?.available()).toBe(true);
  });

  it('avec plateforme : service construit ; sync_guard trouvée au démarrage supprimée', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations);
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    const container = await bootstrapApp({ ...common, open: () => Promise.resolve(db), backups: createUnavailableBackup(), syncPlatform: createMemorySyncPlatform() });
    expect(container?.sync?.status().phase).toBe('not-configured');
    expect(await db.select('SELECT * FROM sync_guard')).toEqual([]);
  });
});
