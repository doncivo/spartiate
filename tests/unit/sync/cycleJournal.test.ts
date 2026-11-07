import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SyncPlatformError } from '../../../src/platform/sync/types';
import { createSimDevice, pair, setupFirst, syncFolders, warmSimDevices, type SimDevice } from '../../sim/syncDevice';

/**
 * 0.2.4 points 1 et 2 : le journal de synchro dit ce qui se passe (reçu, publié, fichiers attendus d'iCloud) seulement quand il se passe
 * quelque chose, et l'étape d'un échec. Codes, compteurs, noms de tables, identifiants courts d'appareil, durées : jamais de contenu.
 */

const PC_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const IPHONE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let devices: SimDevice[] = [];
beforeAll(async () => {
  await warmSimDevices();
});
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function pairedDevices(): Promise<{ pc: SimDevice; iphone: SimDevice }> {
  const pc = await createSimDevice(PC_ID, { name: 'PC' });
  const iphone = await createSimDevice(IPHONE_ID, { name: 'iPhone', clock: pc.clock });
  devices = [pc, iphone];
  await setupFirst(pc);
  await pc.cycle();
  await pair(pc, iphone);
  await iphone.cycle();
  syncFolders(devices);
  await pc.cycle();
  syncFolders(devices);
  return { pc, iphone };
}

const events = (device: SimDevice, name: string) => device.logger.entries.filter((e) => e.event === name);

describe('journal de synchro : received, published, cloud-pending', () => {
  it('publié : nombre d’enregistrements et tables ; reçu : appareil source (8 caractères), tables:lignes et durée', async () => {
    const { pc, iphone } = await pairedDevices();
    const before = { published: events(pc, 'published').length, received: events(iphone, 'received').length };
    await pc.createTask('Titre secret du PC');
    await pc.cycle();
    const published = events(pc, 'published').slice(before.published);
    expect(published).toHaveLength(1);
    expect(published[0]?.detail).toMatchObject({ count: expect.any(Number), tables: 'task' });
    syncFolders(devices);
    await iphone.cycle();
    const received = events(iphone, 'received').slice(before.received);
    expect(received).toHaveLength(1);
    expect(received[0]?.detail).toMatchObject({ from: PC_ID.slice(0, 8), tables: 'task:1', ms: expect.any(Number) });
    const all = JSON.stringify(iphone.logger.entries) + JSON.stringify(pc.logger.entries);
    expect(all).not.toContain('Titre secret du PC');
  });

  it('un cycle vide ne journalise ni received, ni published, ni cloud-pending', async () => {
    const { pc, iphone } = await pairedDevices();
    syncFolders(devices);
    await iphone.cycle();
    const mark = { pc: pc.logger.entries.length, iphone: iphone.logger.entries.length };
    await pc.cycle();
    await iphone.cycle();
    const fresh = [...pc.logger.entries.slice(mark.pc), ...iphone.logger.entries.slice(mark.iphone)].map((e) => e.event);
    expect(fresh.filter((e) => e === 'received' || e === 'published' || e === 'cloud-pending' || e === 'cloud-ready')).toEqual([]);
  });

  it('cloud-pending quand le nombre de fichiers attendus change, cloud-ready au retour à 0, rien tant que le nombre est stable', async () => {
    const { pc, iphone } = await pairedDevices();
    await pc.createTask('Arrivée tardive');
    await pc.cycle();
    syncFolders(devices, { placeholder: true });
    await iphone.cycle();
    const pending = events(iphone, 'cloud-pending');
    expect(pending).toHaveLength(1);
    expect(pending[0]?.detail).toMatchObject({ files: expect.any(Number) });
    expect(pending[0]?.detail.files as number).toBeGreaterThan(0);
    await iphone.cycle();
    expect(events(iphone, 'cloud-pending'), 'même nombre : pas de nouvelle ligne').toHaveLength(1);
    syncFolders(devices);
    await iphone.cycle();
    expect(events(iphone, 'cloud-ready')).toHaveLength(1);
    await iphone.cycle();
    expect(events(iphone, 'cloud-ready'), 'une seule fois').toHaveLength(1);
  });
});

describe('journal de synchro : étape des échecs', () => {
  it('cycle-failed porte l’étape (scan)', async () => {
    const { pc } = await pairedDevices();
    const scan = pc.platform.scan.bind(pc.platform);
    pc.platform.scan = () => Promise.reject(new SyncPlatformError('io'));
    await pc.cycle();
    pc.platform.scan = scan;
    const failed = events(pc, 'cycle-failed');
    expect(failed.at(-1)?.detail).toMatchObject({ code: 'io', stage: 'scan' });
  });
});
