import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../src/domain/clock';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../sim/syncDevice';

/**
 * 0.2.3 (point 1) : séance close sur l'iPhone, de bout en bout, lue par le chemin du Journal du PC (listClosed + getClosed).
 * Cas réel d'Ali : la séance est faite et close AVANT l'association (ou la ré-association) de l'iPhone, puis la synchro est lancée.
 */
const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const W1 = '7d2e1c3a-0000-4000-8000-000000000001';

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function closedOnIphone(b: SimDevice): Promise<string[]> {
  const r = await b.data.repos.workouts();
  await r.start({ source: 'empty', id: W1, name: 'Séance d’essai' });
  const w = await r.addExercise(W1, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 3 });
  for (const s of w.sets) await r.validateSet(s.id, { reps: 8, loadKg: 60 });
  b.clock.advance(20 * 60_000);
  await b.data.transaction(async (repos) => (await repos.workouts()).close(W1));
  return w.sets.map((s) => s.id);
}

async function journalOnPc(a: SimDevice): Promise<{ id: string; sets: string[] }[]> {
  const r = await a.data.repos.workouts();
  const list = await r.listClosed(50);
  const full = await Promise.all(list.map((w) => r.getClosed(w.id)));
  return full.flatMap((w) => (w === null ? [] : [{ id: w.id, sets: w.sets.map((s) => s.id) }]));
}

describe('séance close sur l’iPhone → Journal du PC', () => {
  it('close avant l’association de l’iPhone : visible sur le PC avec toutes ses séries', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
    devices = [a, b];
    const sets = await closedOnIphone(b);
    await setupFirst(a);
    await a.cycle();
    await pair(a, b);
    for (let i = 0; i < 3; i += 1) {
      for (const d of devices) {
        d.clock.advance(1_000);
        await d.cycle();
      }
      syncFolders(devices);
    }
    expect(await journalOnPc(a)).toEqual([{ id: W1, sets }]);
  });

  it('close après l’association : visible sur le PC avec toutes ses séries', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC', schema: 'i0' });
    const b = await createSimDevice(B_ID, { name: 'iPhone', schema: 'i0', clock: createManualClock(a.clock.nowMs()) });
    devices = [a, b];
    await setupFirst(a);
    await a.cycle();
    await pair(a, b);
    await b.cycle();
    syncFolders(devices);
    await a.cycle();
    const sets = await closedOnIphone(b);
    for (let i = 0; i < 2; i += 1) {
      for (const d of devices) {
        d.clock.advance(1_000);
        await d.cycle();
      }
      syncFolders(devices);
    }
    expect(await journalOnPc(a)).toEqual([{ id: W1, sets }]);
  });
});
