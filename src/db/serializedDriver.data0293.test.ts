import { afterEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from './driver';
import { openSqliteWasmDriver } from './drivers/sqliteWasm';
import { migrate } from './migrator';
import { migrations } from './migrations';
import { createSerializedDriver } from './serializedDriver';

/**
 * DATA-0293 (BL-095, BL-093) : même classe que A-008. BL-095 : `BEGIN IMMEDIATE` exécuté par le moteur puis rejeté par le transport laissait une
 * transaction ouverte à l'insu du pilote. BL-093 : sur une base migrée, un ROLLBACK rejeté arrête tout et ne laisse rien dans les tables de capture.
 * Base Wasm synthétique, panne de transport injectée.
 */
const IPC = 'synthetic-ipc-rejection';
const NO_TX = 'error returned from database: (code: 1) cannot rollback - no transaction is active';

interface Rig {
  readonly base: SqlDriver;
  readonly driver: SqlDriver;
  readonly sent: string[];
}
async function rig(fail: { beginAfterRun?: boolean; beginBeforeRun?: boolean; rollback?: string } = {}, migrated = false): Promise<Rig> {
  const base = await openSqliteWasmDriver();
  if (migrated) await migrate(base, migrations);
  else {
    await base.execute('CREATE TABLE item (id TEXT PRIMARY KEY)');
    await base.execute('CREATE TABLE sync_guard (id INTEGER)');
  }
  const sent: string[] = [];
  const driver = createSerializedDriver('sqlite-wasm', {
    execute: async (sql, params) => {
      sent.push(sql);
      if (sql === 'BEGIN IMMEDIATE' && fail.beginBeforeRun === true) throw new Error('database is locked');
      if (sql === 'BEGIN IMMEDIATE' && fail.beginAfterRun === true) {
        await base.execute(sql, params);
        throw new Error(IPC);
      }
      if (sql === 'ROLLBACK' && fail.rollback !== undefined) throw new Error(fail.rollback);
      return base.execute(sql, params);
    },
    select: (sql, params) => base.select(sql, params),
    close: () => base.close(),
  });
  return { base, driver, sent };
}
let current: Rig | undefined;
afterEach(async () => {
  await current?.driver.close().catch(() => undefined);
  current = undefined;
});

describe('BL-095 : BEGIN IMMEDIATE rejeté après exécution', () => {
  it('la transaction ouverte à l’insu du pilote est annulée : l’erreur du BEGIN est rendue, l’écriture suivante est durable', async () => {
    const r = (current = await rig({ beginAfterRun: true }));
    await expect(r.driver.transaction(() => Promise.resolve(1))).rejects.toThrow(IPC);
    expect(r.sent).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK']);
    // Plus aucune transaction ouverte côté moteur : un BEGIN direct réussit.
    await r.base.execute('BEGIN');
    await r.base.execute('ROLLBACK');
    expect((await r.driver.execute("INSERT INTO item VALUES ('suivante')")).rowsAffected).toBe(1);
  });

  it('ROLLBACK de nettoyage rejeté à son tour : échec fermé (connexion invalidée)', async () => {
    const r = (current = await rig({ beginAfterRun: true, rollback: IPC }));
    await expect(r.driver.transaction(() => Promise.resolve(1))).rejects.toThrow(IPC);
    await expect(r.driver.execute("INSERT INTO item VALUES ('refusee')")).rejects.toMatchObject({ code: 'connection-poisoned' });
  });

  it('BEGIN refusé sans être exécuté (verrou) : « no transaction is active » au nettoyage, aucun empoisonnement', async () => {
    const r = (current = await rig({ beginBeforeRun: true, rollback: NO_TX }));
    await expect(r.driver.transaction(() => Promise.resolve(1))).rejects.toThrow('database is locked');
    expect((await r.driver.execute("INSERT INTO item VALUES ('suivante')")).rowsAffected).toBe(1);
  });
});

describe('BL-093 : sur une base migrée, ROLLBACK rejeté puis arrêt', () => {
  it('écriture publiée dans la transaction : ROLLBACK rejeté, connexion invalidée, curseur, horloges par champ et file inchangés après l’annulation à la main, garde orpheline vue par assertGuardEmpty', async () => {
    const r = (current = await rig({ rollback: IPC }, true));
    const before = {
      clock: await r.base.select('SELECT * FROM sync_field_clock'),
      outbox: await r.base.select('SELECT * FROM sync_outbox'),
      state: await r.base.select('SELECT * FROM sync_state'),
    };
    await expect(
      r.driver.transaction(async (tx) => {
        await tx.execute("INSERT INTO profile (id, display_name, created_at, updated_at, device_id, hlc) VALUES ('profile', 'x', '2026-11-24T10:00:00.000Z', '2026-11-24T10:00:00.000Z', 'd', '000000000000001-0000-d')").catch(() => undefined);
        await tx.execute('INSERT INTO sync_guard (id) VALUES (1)');
        throw new Error('work-failed');
      }),
    ).rejects.toThrow('work-failed');
    await expect(r.driver.select('SELECT 1')).rejects.toMatchObject({ code: 'connection-poisoned' });
    // La transaction est restée ouverte côté moteur : l'annuler à la main prouve que rien n'a été validé.
    await r.base.execute('ROLLBACK');
    expect(await r.base.select('SELECT * FROM sync_field_clock')).toEqual(before.clock);
    expect(await r.base.select('SELECT * FROM sync_outbox')).toEqual(before.outbox);
    expect(await r.base.select('SELECT * FROM sync_state')).toEqual(before.state);
    expect(await r.base.select('SELECT * FROM sync_guard')).toEqual([]);
  });
});
