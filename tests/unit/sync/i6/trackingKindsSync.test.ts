import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/**
 * SUIVIS-029 (relecture sync-icloud, D-26) : genres de suivi d'une 0.29.0 (`visbody_*`, `note_*`) dans la table publiée `measurement`. Une ligne écrite en
 * SQL comme le ferait la 0.29.0 passe à l'autre appareil à l'identique ; rien d'inconnu ni de parqué ; cycles sans erreur ; la liste des zones (sans
 * genre) n'en rend aucune. Test de garde : vert par construction (catalogue et `measurement` inchangés), il fige le comportement.
 */
const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function pcAndIphone(): Promise<[SimDevice, SimDevice]> {
  const pc = await createSimDevice(PC, { name: 'PC', schema: 'i0' });
  const iphone = await createSimDevice(IPHONE, { name: 'iPhone', schema: 'i0', devicePlatform: 'ios', clock: createManualClock(pc.clock.nowMs()) });
  devices = [pc, iphone];
  await setupFirst(pc);
  await pc.cycle();
  await pair(pc, iphone);
  await iphone.cycle();
  syncFolders(devices);
  await pc.cycle();
  return [pc, iphone];
}

const rows = (d: SimDevice) => d.driver.select('SELECT id, date, kind, value, deleted_at FROM measurement ORDER BY id');

describe('genres de suivi (0.29.0) dans `measurement`', () => {
  it('insérés en SQL sur l’iPhone : reçus à l’identique par le PC, rien d’inconnu ni de parqué, zones seules dans list()', async () => {
    const [pc, iphone] = await pcAndIphone();
    const at = new Date(iphone.clock.nowMs()).toISOString();
    for (const [kind, value] of [['visbody_bmr_dakcal', 178.3], ['note_fatigue', 1]] as const) {
      await iphone.driver.execute('INSERT INTO measurement (id, date, kind, value, created_at, updated_at, device_id, hlc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        `measurement|2026-11-20|${kind}`,
        '2026-11-20',
        kind,
        value,
        at,
        at,
        IPHONE,
        iphone.hlc.now(),
      ]);
    }
    for (let i = 0; i < 2; i += 1) {
      for (const d of devices) {
        d.clock.advance(1_000);
        const status = await d.cycle();
        expect(status.phase, d.name).not.toBe('error');
        expect(status.errorCode ?? null, d.name).toBeNull();
      }
      syncFolders(devices);
    }
    const expected = [
      { id: 'measurement|2026-11-20|note_fatigue', date: '2026-11-20', kind: 'note_fatigue', value: 1, deleted_at: null },
      { id: 'measurement|2026-11-20|visbody_bmr_dakcal', date: '2026-11-20', kind: 'visbody_bmr_dakcal', value: 178.3, deleted_at: null },
    ];
    for (const d of [pc, iphone]) {
      expect(await rows(d), d.name).toEqual(expected);
      expect(await d.driver.select('SELECT 1 FROM sync_unknown'), d.name).toEqual([]);
      expect(await d.driver.select('SELECT 1 FROM sync_parked'), d.name).toEqual([]);
      expect(await (await d.data.repos.measurements()).list(), d.name).toEqual([]);
    }
    expect((await (await pc.data.repos.measurements()).list('visbody_bmr_dakcal')).map((r) => r.value)).toEqual([178.3]);
  });
});
