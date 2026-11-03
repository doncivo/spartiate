import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

const DEVICE = '60000000-0000-4000-8000-0000000000b1' as DeviceId;
const D1 = '2026-10-05' as LocalDate;
let db: TestDb;
afterEach(async () => db.close());

describe('ProfileRepository', () => {
  it('aucune ligne tant que rien n’est enregistré (jamais de profil vide au démarrage)', async () => {
    db = await openBaseDb(DEVICE);
    expect(await db.data.repos.profile.get()).toBeNull();
    expect(await db.driver.select('SELECT 1 FROM profile')).toEqual([]);
  });

  it('save crée profile|singleton avec des NULL, pas des zéros, puis met à jour champ par champ', async () => {
    db = await openBaseDb(DEVICE);
    const created = await db.data.repos.profile.save({ birthYear: 1990 }, 2026);
    expect(created).toMatchObject({ id: 'profile|singleton', birthYear: 1990, heightCm: null, sex: null, goal: null });
    db.clock.advance(1_000);
    const updated = await db.data.repos.profile.save({ birthYear: 1990, heightCm: 181, sex: 'male' }, 2026);
    expect(updated).toMatchObject({ birthYear: 1990, heightCm: 181, sex: 'male', goal: null });
    const outbox = await db.driver.select<{ field: string }>("SELECT field FROM sync_outbox WHERE table_name = 'profile' ORDER BY seq");
    expect(outbox.map((o) => o.field)).toContain('height_cm');
    expect(await db.driver.select('SELECT id FROM profile')).toEqual([{ id: 'profile|singleton' }]);
  });

  it('une valeur effacée redevient NULL', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.repos.profile.save({ heightCm: 180 }, 2026);
    db.clock.advance(1_000);
    const cleared = await db.data.repos.profile.save({ heightCm: null }, 2026);
    expect(cleared.heightCm).toBeNull();
  });

  it('refuse une valeur hors bornes sans rien écrire', async () => {
    db = await openBaseDb(DEVICE);
    await expect(db.data.repos.profile.save({ heightCm: 50 }, 2026)).rejects.toThrow();
    expect(await db.driver.select('SELECT 1 FROM profile')).toEqual([]);
  });
});

describe('BodyWeightRepository', () => {
  it('saveManual crée weight|date|manual, measured_at NULL, puis remplace le même jour', async () => {
    db = await openBaseDb(DEVICE);
    const first = await db.data.repos.bodyWeights.saveManual({ date: D1, kg: 82.4, timezone: 'Europe/Paris' }, D1);
    expect(first).toMatchObject({ id: 'weight|2026-10-05|manual', kg: 82.4, source: 'manual', measuredAt: null, healthUuid: null });
    db.clock.advance(1_000);
    await db.data.repos.bodyWeights.saveManual({ date: D1, kg: 82.0, timezone: 'Europe/Paris' }, D1);
    expect((await db.data.repos.bodyWeights.listRecent(10)).map((w) => w.kg)).toEqual([82.0]);
  });

  it('refuse zéro, négatif et date future', async () => {
    db = await openBaseDb(DEVICE);
    await expect(db.data.repos.bodyWeights.saveManual({ date: D1, kg: 0, timezone: 'Europe/Paris' }, D1)).rejects.toThrow();
    await expect(db.data.repos.bodyWeights.saveManual({ date: '2026-10-06' as LocalDate, kg: 80, timezone: 'Europe/Paris' }, D1)).rejects.toThrow();
    expect(await db.driver.select('SELECT 1 FROM body_weight')).toEqual([]);
  });

  it('softDelete cache la pesée ; saveManual du même jour la rétablit', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.repos.bodyWeights.saveManual({ date: D1, kg: 80, timezone: 'Europe/Paris' }, D1);
    db.clock.advance(1_000);
    await db.data.repos.bodyWeights.softDelete(D1, 'manual');
    expect(await db.data.repos.bodyWeights.listRecent(10)).toEqual([]);
    db.clock.advance(1_000);
    await db.data.repos.bodyWeights.saveManual({ date: D1, kg: 81, timezone: 'Europe/Paris' }, D1);
    expect((await db.data.repos.bodyWeights.listRecent(10)).map((w) => w.kg)).toEqual([81]);
  });

  it('listRecent : plus récentes d’abord', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.repos.bodyWeights.saveManual({ date: '2026-10-04' as LocalDate, kg: 79, timezone: 'Europe/Paris' }, D1);
    await db.data.repos.bodyWeights.saveManual({ date: D1, kg: 80, timezone: 'Europe/Paris' }, D1);
    expect((await db.data.repos.bodyWeights.listRecent(10)).map((w) => w.date)).toEqual([D1, '2026-10-04']);
  });
});
