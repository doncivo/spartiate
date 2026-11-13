import { afterEach, describe, expect, it } from 'vitest';
import type { CardioSessionInput, TrackPoint } from '../../../domain/cardio';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-06 (D-221, D-222) : `CardioRepository` (tables `cardio_session`, publiée, et `cardio_track`, locale ; migration 0017). Validation par le domaine
 * avant toute écriture ; tracé gardé sur l'appareil, jamais en file de synchro ; suppression logique publiée et tracé local effacé avec elle.
 * Positions synthétiques (aucune position réelle).
 */
const DEVICE = '60000000-0000-4000-8000-0000000000c1' as DeviceId;
const NOW = '2026-11-13T18:00:00.000Z';
let db: TestDb;
afterEach(async () => db.close());
const repo = async () => db.data.repos.cardio();
const outbox = () => db.driver.select<{ table_name: string; field: string }>('SELECT table_name, field FROM sync_outbox ORDER BY seq');
const input = (over: Partial<CardioSessionInput> = {}): CardioSessionInput => ({
  kind: 'run', startedAt: '2026-11-13T17:00:00.000Z', durationSec: 2700, distanceM: 7500, avgHr: 152, rpe: 7, notes: 'Footing ; « parc »', source: 'manual', ...over,
});
const pts: TrackPoint[] = [0, 1, 2].map((i) => ({ lat: i * 0.001, lon: 0, at: 1_800_000_000_000 + i * 30_000, accuracyM: 5 }));

describe('CardioRepository', () => {
  it('add : séance publiée en ligne entière, relue la plus récente d’abord ; aucune donnée locale en file', async () => {
    db = await openBaseDb(DEVICE, NOW);
    const r = await repo();
    const first = await r.add(input({ startedAt: '2026-11-12T07:00:00.000Z', kind: 'bike', distanceM: null, avgHr: null }));
    db.clock.advance(1_000);
    const second = await r.add(input());
    const list = await r.list();
    expect(list.map((s) => s.id)).toEqual([second, first]);
    expect(list[0]).toMatchObject({ kind: 'run', startedAt: '2026-11-13T17:00:00.000Z', durationSec: 2700, distanceM: 7500, avgHr: 152, rpe: 7, notes: 'Footing ; « parc »', source: 'manual', hasTrack: false });
    expect(list[1]).toMatchObject({ kind: 'bike', distanceM: null, avgHr: null });
    expect(await outbox()).toEqual([{ table_name: 'cardio_session', field: '*' }, { table_name: 'cardio_session', field: '*' }]);
  });

  it('add invalide : RepositoryError « invalid », rien d’écrit', async () => {
    db = await openBaseDb(DEVICE, NOW);
    const r = await repo();
    for (const bad of [input({ rpe: 0 }), input({ durationSec: 0 }), input({ startedAt: '2026-11-14T08:00:00.000Z' }), input({ kind: 'swim' as never })]) {
      await expect(r.add(bad)).rejects.toMatchObject({ code: 'invalid' });
    }
    expect(await r.list()).toEqual([]);
    expect(await outbox()).toEqual([]);
  });

  it('tracé GPS : gardé dans la table locale, relu tel quel ; JAMAIS en file de synchro', async () => {
    db = await openBaseDb(DEVICE, NOW);
    const r = await repo();
    const id = await r.add(input({ source: 'gps', distanceM: 222 }), pts);
    expect((await r.list())[0]).toMatchObject({ id, source: 'gps', hasTrack: true });
    expect((await r.track(id))?.map((p) => [p.lat, p.lon, p.at])).toEqual(pts.map((p) => [p.lat, p.lon, p.at]));
    expect((await outbox()).every((o) => o.table_name === 'cardio_session')).toBe(true);
    expect(await db.driver.select("SELECT 1 FROM sync_outbox WHERE table_name = 'cardio_track'")).toEqual([]);
    expect(await r.track('30000000-0000-4000-8000-0000000000ff')).toBeNull();
  });

  it('update : champs modifiés publiés ; invalide refusé ; séance absente ou supprimée : « not-found »', async () => {
    db = await openBaseDb(DEVICE, NOW);
    const r = await repo();
    const id = await r.add(input());
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    await r.update(id, input({ rpe: 8, notes: 'plus dur' }));
    expect((await outbox()).map((o) => o.field).sort()).toEqual(['notes', 'rpe']);
    expect((await r.get(id))?.rpe).toBe(8);
    await expect(r.update(id, input({ rpe: 11 }))).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.update('30000000-0000-4000-8000-0000000000ff', input())).rejects.toMatchObject({ code: 'not-found' });
  });

  it('remove : suppression logique publiée, absente de la liste ; le tracé local est effacé avec elle', async () => {
    db = await openBaseDb(DEVICE, NOW);
    const r = await repo();
    const id = await r.add(input({ source: 'gps' }), pts);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    await r.remove(id);
    expect(await r.list()).toEqual([]);
    expect(await r.get(id)).toBeNull();
    expect(await outbox()).toEqual([{ table_name: 'cardio_session', field: 'deleted_at' }]);
    expect(await db.driver.select('SELECT 1 FROM cardio_track')).toEqual([]);
    await r.remove(id);
    expect(await outbox()).toEqual([{ table_name: 'cardio_session', field: 'deleted_at' }]);
  });

  it('listSince : séances vivantes commencées depuis l’instant donné (moteur de récupération)', async () => {
    db = await openBaseDb(DEVICE, NOW);
    const r = await repo();
    await r.add(input({ startedAt: '2026-10-01T07:00:00.000Z' }));
    await r.add(input({ startedAt: '2026-11-10T07:00:00.000Z', durationSec: 1800, rpe: 5 }));
    expect(await r.listSince('2026-11-01T00:00:00.000Z')).toEqual([{ startedAt: '2026-11-10T07:00:00.000Z', durationSec: 1800, rpe: 5 }]);
  });

  it('ligne au type inconnu (version plus récente) : lue « autre », jamais effacée', async () => {
    db = await openBaseDb(DEVICE, NOW);
    const r = await repo();
    const id = await r.add(input());
    await db.driver.execute("UPDATE cardio_session SET kind = 'swim' WHERE id = ?", [id]);
    expect((await r.list())[0]).toMatchObject({ id, kind: 'other' });
  });
});
