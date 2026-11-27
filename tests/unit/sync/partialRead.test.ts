import { afterEach, describe, expect, it } from 'vitest';
import { propagate } from '../../sim/syncCloudSim';
import { createSimDevice, pair, selectSimSchema, setupFirst, syncFolders, type SimDevice } from '../../sim/syncDevice';

// SYNC-0302 (D-673, option C) : l'heure de « Dernière synchronisation » avance quand un fichier d'un autre appareil n'a pas pu être lu en
// entier ; le statut porte alors `partialRead`, mémorisé dans `sync_meta.partialRead` (local, jamais publié) et levé au premier cycle complet.
// Aucun changement du moteur de lecture : mêmes curseurs, même statut d'appareil, même contenu appliqué.
selectSimSchema('i0');

const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let devices: SimDevice[] = [];
afterEach(async () => {
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
const cursorOf = async (d: SimDevice, id: string) => (await d.driver.select<{ cursor_segment: number; cursor_record: number }>('SELECT cursor_segment, cursor_record FROM sync_state WHERE device_id = ?', [id]))[0];

/** B lit un segment de A dont un enregistrement est illisible (aucun instantané plus récent) : lecture partielle. */
async function partialCycle(a: SimDevice, b: SimDevice): Promise<Awaited<ReturnType<SimDevice['cycle']>>> {
  await a.createTask('Un');
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
    // Moteur de lecture inchangé : la ligne lisible est appliquée, le curseur s'arrête avant l'enregistrement illisible.
    expect((await b.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM meal_entry'))[0]?.n).toBe(1);
    expect(await cursorOf(b, A_ID)).toMatchObject({ cursor_segment: 1 });

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
});
