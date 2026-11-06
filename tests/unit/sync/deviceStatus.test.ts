import { describe, expect, it } from 'vitest';
import type { SyncStateRow } from '../../../src/db/repositories';
import type { DeviceId } from '../../../src/domain/types';
import { storedDeviceStatuses } from '../../../src/sync';

/** Appareils affichés d'après `sync_state` : même règle pour le moteur (APPAREILS) et les bandeaux A-09 avant le premier cycle (revue 5). */

const SELF = '60000000-0000-4000-8000-0000000000a1' as DeviceId;
const PHONE = '60000000-0000-4000-8000-0000000000b2' as DeviceId;
const LAPTOP = '60000000-0000-4000-8000-0000000000c3' as DeviceId;

const row = (deviceId: string, patch: Partial<SyncStateRow> = {}): SyncStateRow => ({
  deviceId,
  isSelf: false,
  platform: 'windows',
  appVersion: null,
  epoch: null,
  cursorSegment: 0,
  cursorRecord: 0,
  ackHlc: null,
  headSegment: 0,
  headRecord: 0,
  headHlc: null,
  stateEpoch: null,
  stateSeq: 0,
  stateDigest: null,
  lastAcks: '{}',
  lastSeenHlc: null,
  lastSyncAt: null,
  schemaVersion: null,
  formatMajor: null,
  kid: null,
  purgeHorizon: null,
  snapshotSeq: null,
  snapshotHlc: null,
  status: 'active',
  ...patch,
});

describe('storedDeviceStatuses', () => {
  it('soi, les appareils dont un état a été accepté ; soi en tête', () => {
    const rows = [row(PHONE, { platform: 'ios', stateSeq: 2, status: 'foreign' }), row(LAPTOP), row(SELF, { isSelf: true })];
    const devices = storedDeviceStatuses(rows, { self: SELF });
    expect(devices.map((d) => [d.deviceId, d.self, d.platform, d.status])).toEqual([
      [SELF, true, 'windows', 'active'],
      [PHONE, false, 'ios', 'foreign'],
    ]);
    expect(storedDeviceStatuses(rows, { self: SELF, accepted: new Set([LAPTOP]) }).map((d) => d.deviceId)).toEqual([SELF, PHONE, LAPTOP]);
  });

  it('sans identifiant local : soi d’après la ligne', () => {
    expect(storedDeviceStatuses([row(SELF, { isSelf: true })], {}).map((d) => d.self)).toEqual([true]);
  });

  it('statut inconnu : signalé « corrupt », jamais « active »', () => {
    expect(storedDeviceStatuses([row(PHONE, { stateSeq: 1, status: 'lost' })], { self: SELF })[0]?.status).toBe('corrupt');
  });
});

/**
 * 0.1.4 (4) : « PC : Jamais lu » sur l'iPhone alors que les modifications du PC lui étaient parvenues. `lastReadAt` d'un autre appareil
 * ne venait que de `ack_hlc` (dernier enregistrement de journal lu) ; après une reprise depuis un instantané ou un changement d'époque,
 * les données de l'autre appareil sont appliquées, le curseur est à sa tête, mais `ack_hlc` reste vide jusqu'à son prochain écrit.
 * Règle : un curseur arrivé à la tête annoncée de l'appareil vaut lecture jusqu'au hlc de cette tête. Même règle dans les deux sens.
 */
describe('dernière modification lue d’un autre appareil (0.1.4 point 4)', () => {
  const HLC_HEAD = '001793905560000-0000-60000000-0000-4000-8000-0000000000c3' as never;
  const base = { stateSeq: 3, epoch: 'e1', headSegment: 2, headRecord: 5, headHlc: HLC_HEAD };

  for (const [name, platform] of [['iPhone qui regarde le PC', 'windows'], ['PC qui regarde l’iPhone', 'ios']] as const) {
    it(`${name} : curseur à la tête, accusé vide : l’heure de la tête, pas « jamais lu »`, () => {
      const [, other] = storedDeviceStatuses([row(SELF, { isSelf: true }), row(PHONE, { ...base, platform, cursorSegment: 2, cursorRecord: 5, ackHlc: null })], { self: SELF });
      expect(other?.lastReadAt).not.toBeNull();
    });

    it(`${name} : curseur avant la tête, accusé vide : toujours « jamais lu »`, () => {
      const [, other] = storedDeviceStatuses([row(SELF, { isSelf: true }), row(PHONE, { ...base, platform, cursorSegment: 1, cursorRecord: 2, ackHlc: null })], { self: SELF });
      expect(other?.lastReadAt).toBeNull();
    });

    it(`${name} : un accusé plus récent que la tête prime`, () => {
      const ack = '001793959260000-0000-60000000-0000-4000-8000-0000000000c3' as never;
      const [, other] = storedDeviceStatuses([row(SELF, { isSelf: true }), row(PHONE, { ...base, platform, cursorSegment: 2, cursorRecord: 5, ackHlc: ack })], { self: SELF });
      expect(other?.lastReadAt).toBe('2026-11-06T10:01:00.000Z');
    });
  }
});
