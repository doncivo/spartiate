import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DbError, type SqlDriver } from './driver';
import { openSqliteWasmDriver } from './drivers/sqliteWasm';
import { migrate } from './migrator';
import { migrations } from './migrations';
import { createSerializedDriver } from './serializedDriver';
import { useAppStore } from '../features/app/appStore';
import { bootstrapDatabase } from '../features/app/bootstrap';

/**
 * A-008 (audit Codex 0.26.0) : un ROLLBACK rejeté (autre que « no transaction is active ») laissait la transaction ouverte côté SQLite alors que
 * le pilote la croyait terminée ; l'écriture suivante était acquittée dans cette transaction, puis perdue. Preuve reprise de
 * `partie2-rollback.test.mjs` sur le vrai `createSerializedDriver` ; base Wasm synthétique, panne de transport injectée avant ROLLBACK.
 */
const NO_TX = 'error returned from database: (code: 1) cannot rollback - no transaction is active';
const IPC = 'synthetic-ipc-rejection-before-rollback';

interface Rig {
  readonly base: SqlDriver;
  readonly driver: SqlDriver;
  readonly sent: string[];
}

async function rig(fail: { rollback?: string; guardDelete?: boolean } = {}): Promise<Rig> {
  const base = await openSqliteWasmDriver();
  await base.execute('CREATE TABLE item (id TEXT PRIMARY KEY)');
  await base.execute("INSERT INTO item VALUES ('avant')");
  await base.execute('CREATE TABLE sync_guard (id INTEGER)');
  const sent: string[] = [];
  const driver = createSerializedDriver('sqlite-wasm', {
    execute: (sql, params) => {
      sent.push(sql);
      if (sql === 'ROLLBACK' && fail.rollback !== undefined) return Promise.reject(new Error(fail.rollback));
      if (sql === 'DELETE FROM sync_guard' && fail.guardDelete) return Promise.reject(new Error('disk I/O error'));
      return base.execute(sql, params);
    },
    select: (sql, params) => base.select(sql, params),
    close: () => base.close(),
  });
  return { base, driver, sent };
}

const failingWork = (driver: SqlDriver) =>
  driver.transaction(async (tx) => {
    await tx.execute("INSERT INTO item VALUES ('transaction-refusee')");
    throw new Error('work-failed');
  });

describe('A-008 : échec fermé quand l’annulation ne peut pas être établie', () => {
  let current: Rig | undefined;
  beforeEach(() => {
    current = undefined;
  });
  afterEach(async () => {
    await current?.driver.close().catch(() => undefined);
  });

  it('témoin : ROLLBACK réussi, l’écriture suivante est acquittée et durable', async () => {
    const r = (current = await rig());
    await expect(failingWork(r.driver)).rejects.toThrow('work-failed');
    expect((await r.driver.execute("INSERT INTO item VALUES ('suivante')")).rowsAffected).toBe(1);
    expect((await r.driver.select('SELECT id FROM item ORDER BY id')).map((row) => row.id)).toEqual(['avant', 'suivante']);
  });

  it('critère 2 : ROLLBACK rejeté, l’écriture suivante est REFUSÉE et l’appelant reçoit l’erreur d’origine', async () => {
    const r = (current = await rig({ rollback: IPC }));
    await expect(failingWork(r.driver)).rejects.toThrow('work-failed');
    await expect(r.driver.execute("INSERT INTO item VALUES ('suivante-acquittee')")).rejects.toMatchObject({ name: 'DbError', code: 'connection-poisoned' });
    // La transaction est restée ouverte côté SQLite : l'annuler à la main prouve que rien n'a été validé.
    await r.base.execute('ROLLBACK');
    expect((await r.base.select('SELECT id FROM item ORDER BY id')).map((row) => row.id)).toEqual(['avant']);
  });

  it('critère 3 : lecture, transaction et appel déjà en file sont refusés ; close() reste permis', async () => {
    const r = (current = await rig({ rollback: IPC }));
    const failing = failingWork(r.driver);
    const queued = r.driver.execute("INSERT INTO item VALUES ('en-file')");
    await expect(failing).rejects.toThrow('work-failed');
    await expect(queued).rejects.toMatchObject({ code: 'connection-poisoned' });
    await expect(r.driver.select('SELECT 1')).rejects.toMatchObject({ code: 'connection-poisoned' });
    await expect(r.driver.transaction(() => Promise.resolve(1))).rejects.toMatchObject({ code: 'connection-poisoned' });
    await expect(r.driver.close()).resolves.toBeUndefined();
  });

  it('critère 4 : l’erreur porte l’erreur d’origine et la cause du ROLLBACK, sans instruction supplémentaire', async () => {
    const r = (current = await rig({ rollback: IPC }));
    await failingWork(r.driver).catch(() => undefined);
    const error = await r.driver.execute('SELECT 1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).message).toContain('work-failed');
    expect((error as DbError).message).toContain(IPC);
    expect(r.sent).toEqual(['BEGIN IMMEDIATE', "INSERT INTO item VALUES ('transaction-refusee')", 'ROLLBACK']);
  });

  it('critère 5 : « no transaction is active » inchangé (garde retirée, file rendue)', async () => {
    const r = (current = await rig({ rollback: NO_TX }));
    await expect(failingWork(r.driver)).rejects.toThrow('work-failed');
    expect((await r.driver.execute("INSERT INTO item VALUES ('suivante')")).rowsAffected).toBe(1);
    expect(r.sent).toContain('DELETE FROM sync_guard');
  });

  it('critère 6 : retrait de sync_guard en échec après transaction perdue, l’écriture suivante est refusée', async () => {
    const r = (current = await rig({ rollback: NO_TX, guardDelete: true }));
    await expect(failingWork(r.driver)).rejects.toThrow('work-failed');
    await expect(r.driver.execute("INSERT INTO item VALUES ('hors-outbox')")).rejects.toMatchObject({ code: 'connection-poisoned' });
  });
});

describe('A-008 : état durable visible dans l’app (critère 7)', () => {
  beforeEach(() => {
    useAppStore.setState({ dbStatus: 'idle', dbErrorDetail: null, dbBackupFailed: false, dbFailure: null });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('le pilote empoisonné fait passer dbStatus à « error », kind « connection-poisoned »', async () => {
    const base = await openSqliteWasmDriver();
    const driver = createSerializedDriver('sqlite-wasm', {
      execute: (sql, params) => (sql === 'ROLLBACK' ? Promise.reject(new Error(IPC)) : base.execute(sql, params)),
      select: (sql, params) => base.select(sql, params),
      close: () => base.close(),
    });
    await bootstrapDatabase(() => Promise.resolve(driver), { backup: () => Promise.resolve(undefined) });
    expect(useAppStore.getState().dbStatus).toBe('ready');
    await driver.transaction(() => Promise.reject(new Error('work-failed'))).catch(() => undefined);
    const state = useAppStore.getState();
    expect(state.dbStatus).toBe('error');
    expect(state.dbFailure).toMatchObject({ kind: 'connection-poisoned', errorName: 'DbError' });
    expect(state.dbFailure?.message).toContain(IPC);
  });
});
