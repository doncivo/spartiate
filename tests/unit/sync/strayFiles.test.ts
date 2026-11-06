import { afterEach, describe, expect, it } from 'vitest';
import { parseSyncFileName } from '../../../src/domain/sync/format';
import { createSimDevice, setupFirst, type SimDevice } from '../../sim/syncDevice';

/**
 * 0.1.4 (5) : copies de conflit d'iCloud (« state 2.spx »). Ignorées à la lecture, jamais supprimées, signalées une seule fois dans le journal
 * technique (pas une fois par cycle : le cycle périodique tourne toutes les 25 s au premier plan).
 */
const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

describe('copies de conflit iCloud (0.1.4 point 5)', () => {
  it.each(['state 2.spx', 'state 3.spx', 'state (1).spx', 'state.spx.icloud', 'j-00000001 2.spj', 's-00000001 2.sps', 'state.next 2.spx'])('« %s » n’est pas un fichier de synchro', (name) => {
    expect(parseSyncFileName(name)).toBeNull();
  });

  it('les vrais noms restent reconnus', () => {
    expect(parseSyncFileName('state.spx')).toEqual({ kind: 'state' });
    expect(parseSyncFileName('j-00000001.spj')).toEqual({ kind: 'segment', n: 1 });
  });

  it('une copie dans le dossier de l’appareil est ignorée : cycle terminé, état intact, et signalée une seule fois', async () => {
    const a = await createSimDevice(A_ID);
    devices = [a];
    await setupFirst(a);
    await a.service.syncNow('open');
    a.folder.addStrayEntries(A_ID, 1);
    await a.service.syncNow('manual');
    expect(a.service.status().errorCode ?? null, JSON.stringify(a.logger.entries.slice(-5))).toBeNull();
    await a.service.syncNow('timer');
    await a.service.syncNow('timer');
    const signals = a.logger.entries.filter((e) => e.event === 'folder-extra-files');
    expect(signals).toHaveLength(1);
    expect(signals[0]?.detail).toEqual({ count: 1 });
    // Une copie de plus : nouveau signalement (le compteur a changé), jamais plus d’un par changement.
    a.folder.addStrayEntries(A_ID, 1);
    await a.service.syncNow('timer');
    await a.service.syncNow('timer');
    expect(a.logger.entries.filter((e) => e.event === 'folder-extra-files').map((e) => e.detail)).toEqual([{ count: 1 }, { count: 2 }]);
  });

  it('le signal ne contient ni nom de fichier ni chemin', async () => {
    const a = await createSimDevice(A_ID);
    devices = [a];
    await setupFirst(a);
    await a.service.syncNow('open');
    a.folder.addStrayEntries(A_ID, 2);
    await a.service.syncNow('manual');
    expect(JSON.stringify(a.logger.entries.filter((e) => e.event === 'folder-extra-files'))).not.toMatch(/\.spx|iCloud|\//);
  });
});

describe('une seule synchro à la fois (0.1.4 point 5)', () => {
  it('minuteur, retour au premier plan, bouton et écriture différée en même temps : jamais deux cycles qui se chevauchent', async () => {
    const { startSyncScheduler } = await import('../../../src/sync');
    const { vi } = await import('vitest');
    const a = await createSimDevice(A_ID);
    devices = [a];
    await setupFirst(a);
    await a.service.syncNow('open');
    let active = 0;
    let peak = 0;
    let scans = 0;
    const real = a.platform.scan.bind(a.platform);
    vi.spyOn(a.platform, 'scan').mockImplementation(async (r) => {
      active += 1;
      scans += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      await Promise.resolve();
      try {
        return await real(r);
      } finally {
        active -= 1;
      }
    });
    const listeners = new Set<() => void>();
    const writes = new Set<() => void>();
    let poll: (() => void) | undefined;
    const doc = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    };
    const scheduler = startSyncScheduler(a.service, {
      document: doc as unknown as Document,
      clock: a.clock,
      setInterval: (handler) => ((poll = handler), 1),
      clearInterval: () => undefined,
      localWrites: (l) => (writes.add(l), () => writes.delete(l)),
    });
    scans = 0;
    a.clock.advance(60_000);
    for (const l of writes) l();
    poll?.();
    const manual = [a.service.syncNow('manual'), a.service.syncNow('manual'), a.service.syncNow('tray')];
    doc.visibilityState = 'hidden';
    for (const l of listeners) l();
    doc.visibilityState = 'visible';
    for (const l of listeners) l();
    a.clock.advance(60_000);
    poll?.();
    await Promise.all(manual);
    await scheduler.tick();
    await a.service.syncNow('manual');
    expect(peak).toBe(1);
    // Les demandes en attente sont regroupées : bien moins de cycles que de déclenchements (9 ici).
    expect(scans).toBeLessThanOrEqual(5);
    scheduler.dispose();
  });
});
