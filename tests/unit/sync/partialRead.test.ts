import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Repositories } from '../../../src/db/repositories';
import { SyncPlatformError } from '../../../src/platform/sync/types';
import { propagate } from '../../sim/syncCloudSim';
import { backupOf, restoreBackup } from './reset/resetKit';
import { createSimDevice, pair, selectSimSchema, setupFirst, syncFolders, type SimDevice } from '../../sim/syncDevice';

// SYNC-0302 (D-673, option C) : l'heure de « Dernière synchronisation » avance quand un fichier d'un autre appareil n'a pas pu être lu en
// entier ; le statut porte alors `partialRead`, mémorisé dans `sync_meta.partialRead` (local, jamais publié) et levé au premier cycle complet.
// Aucun changement du moteur de lecture : mêmes curseurs, même statut d'appareil, même contenu appliqué.
selectSimSchema('i0');

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let devices: SimDevice[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function twoDevices(): Promise<[SimDevice, SimDevice]> {
  const a = await createSimDevice(A_ID, { name: 'PC' });
  const b = await createSimDevice(B_ID, { name: 'iPhone', clock: a.clock });
  devices = [a, b];
  await setupFirst(a);
  await a.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders(devices);
  await a.cycle();
  await b.cycle();
  return [a, b];
}

const partialMeta = async (d: SimDevice): Promise<string | null> =>
  (await d.driver.select<{ value: string | null }>("SELECT value FROM sync_meta WHERE key = 'partialRead'"))[0]?.value ?? null;
const stateOf = async (d: SimDevice, id: string) => (await d.driver.select<{ status: string; cursor_segment: number; cursor_record: number; last_sync_at: string | null }>('SELECT status, cursor_segment, cursor_record, last_sync_at FROM sync_state WHERE device_id = ?', [id]))[0];
const nowIso = (d: SimDevice): string => new Date(d.clock.nowMs()).toISOString();

/** A écrit encore, le dossier de B reçoit des fichiers non téléchargés : le cycle de B n'avance pas l'heure (attente d'iCloud). */
async function waitingCycle(a: SimDevice, b: SimDevice): Promise<Awaited<ReturnType<SimDevice['cycle']>>> {
  a.clock.advance(1_000);
  await a.createTask('En attente');
  await a.cycle();
  propagate(a.folder, b.folder, A_ID, { placeholder: true });
  a.clock.advance(60_000);
  const waiting = await b.cycle();
  expect(waiting.pendingFiles.length).toBeGreaterThan(0);
  return waiting;
}

/** A republie (fichier intact recopié, tête avancée) : le cycle suivant de B est complet. */
async function healingCycle(a: SimDevice, b: SimDevice): Promise<Awaited<ReturnType<SimDevice['cycle']>>> {
  a.clock.advance(1_000);
  await a.createTask('Trois');
  await a.cycle();
  propagate(a.folder, b.folder, A_ID);
  a.clock.advance(60_000);
  return b.cycle();
}

/** B lit un segment de A dont un enregistrement est illisible (aucun instantané plus récent) : lecture partielle. */
async function partialCycle(a: SimDevice, b: SimDevice): Promise<Awaited<ReturnType<SimDevice['cycle']>>> {
  // Deux cycles de A : deux enregistrements dans le même segment ; le second sera illisible chez B.
  await a.createTask('Un');
  await a.cycle();
  a.clock.advance(5);
  await a.createTask('Deux');
  await a.cycle();
  propagate(a.folder, b.folder, A_ID);
  const segment = a.folder.fileNames(A_ID).find((n) => /\/j-\d{8}\.spj$/.test(n)) ?? '';
  const records = b.folder.records(A_ID, segment);
  b.folder.corruptRecord(A_ID, segment, records.length - 1);
  a.clock.advance(60_000);
  return b.cycle();
}

/**
 * Curseur de B sur A après la lecture partielle (règle existante de `reader.ts` : à l'arrêt, le dernier groupe de même hlc est appliqué mais
 * le curseur reste avant lui, relu sans effet au cycle suivant) : ici le seul enregistrement lisible, donc le début de l'époque.
 */
const CURSOR_SEGMENT = 0;
const CURSOR_RECORD = 0;

describe('SYNC-0302 : lecture partielle à côté de l’heure de dernière synchro', () => {
  it('cycle complet : heure avancée, aucune lecture partielle, rien en méta', async () => {
    const [a, b] = await twoDevices();
    await a.createTask('Un');
    await a.cycle();
    propagate(a.folder, b.folder, A_ID);
    a.clock.advance(60_000);
    const status = await b.cycle();
    expect(status.lastSyncAt).toBe(new Date(a.clock.nowMs()).toISOString());
    expect(status.partialRead).toBeUndefined();
    expect(await partialMeta(b)).toBeNull();
  });

  it('un fichier de A illisible en partie : l’heure avance, `partialRead` posé et mémorisé ; un cycle complet le lève', async () => {
    const [a, b] = await twoDevices();
    const before = (await b.cycle()).lastSyncAt;
    const status = await partialCycle(a, b);
    const at = new Date(a.clock.nowMs()).toISOString();
    expect(status.lastSyncAt).toBe(at);
    expect(status.lastSyncAt).not.toBe(before);
    expect(status.pendingFiles).toEqual([]);
    expect(status.partialRead).toBe(true);
    expect(JSON.parse((await partialMeta(b)) ?? 'null')).toEqual({ at });
    // Moteur de lecture inchangé : la ligne lisible est appliquée, l'appareil est marqué « Fichiers illisibles » (statut existant).
    expect((await b.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM meal_entry'))[0]?.n).toBe(1);
    expect(await stateOf(b, A_ID)).toMatchObject({ status: 'corrupt', cursor_segment: CURSOR_SEGMENT, cursor_record: CURSOR_RECORD });

    // A republie (fichier intact recopié, tête avancée) : cycle complet, indicateur levé, méta effacée.
    a.clock.advance(1_000);
    await a.createTask('Trois');
    await a.cycle();
    propagate(a.folder, b.folder, A_ID);
    a.clock.advance(60_000);
    const healed = await b.cycle();
    expect(healed.lastSyncAt).toBe(new Date(a.clock.nowMs()).toISOString());
    expect(healed.partialRead).toBeUndefined();
    expect(await partialMeta(b)).toBeNull();
    expect((await b.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM meal_entry'))[0]?.n).toBe(3);
  });

  it('après un redémarrage, cycle dont l’heure n’avance pas (fichier en attente d’iCloud) : la mention de la dernière heure reste', async () => {
    const [a, b] = await twoDevices();
    const partial = await partialCycle(a, b);
    expect(partial.partialRead).toBe(true);
    await b.restart();
    a.clock.advance(1_000);
    await a.createTask('Trois');
    await a.cycle();
    propagate(a.folder, b.folder, A_ID, { placeholder: true });
    a.clock.advance(60_000);
    const waiting = await b.cycle();
    expect(waiting.pendingFiles.length).toBeGreaterThan(0);
    expect(waiting.lastSyncAt).toBe(partial.lastSyncAt);
    expect(waiting.partialRead).toBe(true);
  });

  it('relecture, D-777 : méta illisible et heure gardée (attente d’iCloud) : mention posée, journal « partial-read-unreadable », cycle sans échec', async () => {
    const [a, b] = await twoDevices();
    const last = (await b.cycle()).lastSyncAt;
    await b.data.repos.sync.setMeta('partialRead', '{');
    const mark = b.logger.entries.length;
    const waiting = await waitingCycle(a, b);
    expect(waiting.phase).toBe('waiting-icloud');
    expect(waiting.lastSyncAt).toBe(last);
    expect(waiting.partialRead).toBe(true);
    const events = b.logger.entries.slice(mark).map((e) => e.event);
    expect(events).toContain('partial-read-unreadable');
    expect(events).not.toContain('cycle-error');
    expect(events).not.toContain('cycle-crashed');
  });

  it('relecture, critère 3b : lecture partielle puis cycle en échec (dossier injoignable) : même heure, mention gardée', async () => {
    const [a, b] = await twoDevices();
    const partial = await partialCycle(a, b);
    const scan = vi.spyOn(b.platform, 'scan').mockRejectedValue(new SyncPlatformError('folder-unreachable'));
    a.clock.advance(60_000);
    const failed = await b.cycle();
    expect(failed.phase).toBe('error');
    expect(failed.errorCode).toBe('folder-unreachable');
    expect(failed.lastSyncAt).toBe(partial.lastSyncAt);
    expect(failed.partialRead).toBe(true);
    scan.mockRestore();
  });

  it('relecture, chaîne : partiel, redémarrage, cycle complet : mention levée, méta effacée', async () => {
    const [a, b] = await twoDevices();
    expect((await partialCycle(a, b)).partialRead).toBe(true);
    await b.restart();
    const healed = await healingCycle(a, b);
    expect(healed.lastSyncAt).toBe(nowIso(a));
    expect(healed.partialRead).toBeUndefined();
    expect(await partialMeta(b)).toBeNull();
  });

  it('relecture, chaîne : complet, redémarrage, cycle qui n’avance pas l’heure : aucune mention', async () => {
    const [a, b] = await twoDevices();
    const complete = await b.cycle();
    expect(complete.partialRead).toBeUndefined();
    await b.restart();
    const waiting = await waitingCycle(a, b);
    expect(waiting.lastSyncAt).toBe(complete.lastSyncAt);
    expect(waiting.partialRead).toBeUndefined();
    expect(await partialMeta(b)).toBeNull();
  });

  it('relecture : sauvegarde prise pendant une lecture partielle, restaurée (« Garder »), puis premier cycle complet : aucune mention fausse', async () => {
    const [a, b] = await twoDevices();
    const partial = await partialCycle(a, b);
    const copy = await backupOf(b);
    expect(JSON.parse((await partialMeta(b)) ?? 'null')).toEqual({ at: partial.lastSyncAt });
    // A republie un fichier intact ; B est restauré depuis la sauvegarde qui porte encore la méta de la lecture partielle.
    a.clock.advance(1_000);
    await a.createTask('Trois');
    await a.cycle();
    propagate(a.folder, b.folder, A_ID);
    await restoreBackup(b, copy);
    await b.service.chooseRestoreOption('keep-synced');
    a.clock.advance(60_000);
    const after = await b.cycle();
    expect(after.phase).toBe('idle');
    expect(after.lastSyncAt).toBe(nowIso(a));
    expect(after.partialRead).toBeUndefined();
    expect(await partialMeta(b)).toBeNull();
  });

  it('relecture, critère 2 : arrêt entre l’heure et la méta (même transaction) : ni l’une ni l’autre écrite, puis posées ensemble', async () => {
    const [a, b] = await twoDevices();
    const before = (await stateOf(b, B_ID))?.last_sync_at ?? null;
    expect(before).not.toBeNull();
    // Arrêt simulé dans la transaction de l'étape 8, après saveState et avant setMeta('partialRead').
    const real = b.data.transaction.bind(b.data);
    let saved = false;
    vi.spyOn(b.data, 'transaction').mockImplementation(<T>(work: (repos: Repositories) => Promise<T>) =>
      real((repos) => {
        const sync = new Proxy(repos.sync, {
          get(target, key, receiver) {
            if (key === 'saveState') return async (...args: Parameters<Repositories['sync']['saveState']>) => {
              if (args[1].lastSyncAt !== undefined) saved = true;
              return target.saveState(...args);
            };
            if (key === 'setMeta') return async (meta: string, value: string | null) => {
              if (meta === 'partialRead') throw new Error('arrêt simulé');
              return target.setMeta(meta, value);
            };
            const value: unknown = Reflect.get(target, key, receiver);
            return typeof value === 'function' ? (value as (...x: unknown[]) => unknown).bind(target) : value;
          },
        });
        return work(new Proxy(repos, { get: (target, key, receiver) => (key === 'sync' ? sync : Reflect.get(target, key, receiver)) }));
      }),
    );
    const crashed = await partialCycle(a, b);
    expect(saved).toBe(true);
    expect(crashed.phase).toBe('error');
    expect((await stateOf(b, B_ID))?.last_sync_at).toBe(before);
    expect(await partialMeta(b)).toBeNull();
    vi.restoreAllMocks();
    await b.restart();
    a.clock.advance(60_000);
    const again = await b.cycle();
    expect(again.lastSyncAt).toBe(nowIso(a));
    expect(again.partialRead).toBe(true);
    expect(JSON.parse((await partialMeta(b)) ?? 'null')).toEqual({ at: again.lastSyncAt });
  });
});
