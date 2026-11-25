import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createSimDevice, SCHEMA_VERSION, setupFirst, warmSimDevices, type SimDevice } from '../../../sim/syncDevice';
import { publishOutbox } from '../../../../src/sync/publisher';
import { META, readJson } from '../../../../src/sync/meta';
import type { SyncDeps } from '../../../../src/sync/deps';
import type { DeviceAck } from '../../../../src/domain/sync/format';
import { LEGACY_SYNC_CATALOGUE } from '../../../fixtures/legacy-schema/catalogue';

/**
 * DATA-0293 (BL-038, relecture à froid) : tant qu'une intention d'ajout (`inflight`) n'est pas résolue, `publishOutbox` ne publie rien : un instantané
 * orphelin ouvert au cycle suivant n'appelle pas `resolveInflight`, la file serait ajoutée une seconde fois. Données synthétiques.
 */
let d: SimDevice | undefined;
beforeAll(warmSimDevices);
afterEach(async () => {
  await d?.close();
  d = undefined;
});

describe('publishOutbox et intention d’ajout non résolue', () => {
  it('ne réécrit ni n’ajoute rien tant que `inflight` est posée ; l’intention reste', async () => {
    const dev = await createSimDevice('ef50b6f7-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { devicePlatform: 'ios' });
    d = dev;
    await setupFirst(dev);
    await dev.cycle();
    await dev.createTask('Avant');
    await dev.cycle();
    const head = await readJson<DeviceAck>(dev.data.repos, META.head);
    if (!head) throw new Error('tête absente');
    await dev.createTask('Après');
    const deps: SyncDeps = { catalogue: LEGACY_SYNC_CATALOGUE, data: dev.data, platform: dev.platform, deviceId: dev.id, devicePlatform: dev.devicePlatform, hlc: dev.hlc, clock: dev.clock, logger: dev.logger, sv: SCHEMA_VERSION, appVersion: '0.3.3' };
    const inflight = { epoch: head.epoch, segment: head.segment, expect: head.record, count: 1, maxHlc: head.hlc, entries: [] };
    await dev.data.repos.sync.setMeta(META.inflight, JSON.stringify(inflight));
    let appends = 0;
    const append = dev.platform.appendJournal.bind(dev.platform);
    dev.platform.appendJournal = (request) => {
      appends += 1;
      return append(request);
    };
    const outcome = await publishOutbox(deps, head.epoch, head, head.segment);
    expect(appends).toBe(0);
    expect(outcome).toMatchObject({ published: 0, error: null });
    expect(JSON.parse((await dev.data.repos.sync.getMeta(META.inflight)) ?? 'null')).toEqual(inflight);
    expect((await dev.data.repos.sync.readOutbox()).length).toBeGreaterThan(0);
  });
});
