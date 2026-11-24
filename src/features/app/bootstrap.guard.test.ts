import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteWasmDriver } from '../../db/drivers/sqliteWasm';
import { migrate } from '../../db/migrator';
import { migrations } from '../../db/migrations';
import { createUnavailableBackup } from '../../platform/backup';
import { createUnavailableFiles } from '../../platform/files';
import { createMemorySyncPlatform } from '../../platform/sync/memory';
import { useAppStore } from './appStore';
import { bootstrapApp } from './bootstrap';

/** DATA-0293 (BL-094, BL-031, BL-030) : une garde de synchro illisible au démarrage met le démarrage en échec fermé, elle n'est plus lue comme « zéro ». */
const common = { desktop: null, files: createUnavailableFiles(), migrations, backups: createUnavailableBackup(), syncPlatform: createMemorySyncPlatform() } as const;

describe('démarrage : garde de synchro (échec fermé)', () => {
  beforeEach(() => {
    useAppStore.setState({ dbStatus: 'idle', dbErrorDetail: null });
  });

  it('lecture de sync_guard en échec : le démarrage échoue (étape sync.assertGuardEmpty), jamais un démarrage avec une garde peut-être orpheline', async () => {
    const real = await openSqliteWasmDriver();
    await migrate(real, migrations);
    const db = { ...real, select: (sql: string, params?: never) => (sql.includes('FROM sync_guard') ? Promise.reject(new Error('disque illisible')) : real.select(sql, params)) } as typeof real;
    const container = await bootstrapApp({ ...common, open: () => Promise.resolve(db) });
    expect(container).toBeNull();
    expect(useAppStore.getState().dbStatus).toBe('error');
    expect(useAppStore.getState().dbErrorDetail ?? '').toContain('disque illisible');
  });

  it('garde trouvée et supprimée : démarrage normal (comportement conservé)', async () => {
    const db = await openSqliteWasmDriver();
    await migrate(db, migrations);
    await db.execute('INSERT INTO sync_guard (id) VALUES (1)');
    const container = await bootstrapApp({ ...common, open: () => Promise.resolve(db) });
    expect(container).not.toBeNull();
    expect(await db.select('SELECT * FROM sync_guard')).toEqual([]);
  });
});
