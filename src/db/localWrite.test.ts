import { afterEach, describe, expect, it, vi } from 'vitest';
import { asEntityId, type DeviceId } from '../domain/types';
import { onLocalWrite } from './localWrite';
import { openBaseDb, type TestDb } from './repositories/sql/testSetup';

/** 0.1.3 (k) : toute écriture locale publiable (profil, pesée) le dit à la synchro ; une pesée venue de Santé aussi. */
const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-00000000000a');

describe('signal d’écriture locale (0.1.3 k)', () => {
  let db: TestDb | undefined;
  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it('profil, pesée manuelle, pesée Santé et suppression notifient chacune', async () => {
    db = await openBaseDb(DEVICE);
    const listener = vi.fn();
    const stop = onLocalWrite(listener);
    const weights = await db.data.repos.bodyWeights();
    const profile = await db.data.repos.profile();
    await weights.saveManual({ date: '2026-10-01' as never, kg: 83.1, timezone: 'Europe/Paris' }, '2026-10-01' as never);
    expect(listener).toHaveBeenCalledTimes(1);
    await weights.saveHealth({ kg: 82.4, measuredAt: '2026-10-01T05:48:00.000Z' as never, timezone: 'Europe/Paris', healthUuid: 'AAAA-1111' }, '2026-10-01' as never);
    expect(listener).toHaveBeenCalledTimes(2);
    await weights.softDelete('2026-10-01' as never, 'manual');
    expect(listener).toHaveBeenCalledTimes(3);
    await profile.save({ birthYear: 1990 }, 2026);
    expect(listener).toHaveBeenCalledTimes(4);
    stop();
    await weights.saveManual({ date: '2026-10-02' as never, kg: 83, timezone: 'Europe/Paris' }, '2026-10-02' as never);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('une lecture n’est pas une écriture', async () => {
    db = await openBaseDb(DEVICE);
    const listener = vi.fn();
    const stop = onLocalWrite(listener);
    await (await db.data.repos.bodyWeights()).listRecent(10);
    await (await db.data.repos.profile()).get();
    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it('une écriture refusée (profil invalide) ne notifie pas', async () => {
    db = await openBaseDb(DEVICE);
    const listener = vi.fn();
    const stop = onLocalWrite(listener);
    await expect((await db.data.repos.profile()).save({ birthYear: 1500 }, 2026)).rejects.toBeDefined();
    expect(listener).not.toHaveBeenCalled();
    stop();
  });
});
