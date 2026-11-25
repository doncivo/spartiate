import { afterEach, describe, expect, it } from 'vitest';
import { parseCorrectedFrom } from '../../parse/correctedFromJson';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * DATA-0293 (migration 0023) : séries ajoutées en séance (BL-135, D-481), valeurs d'avant correction (C-072, Q-13 B) et distance (BL-112).
 * Base SQLite réelle, données synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-000000000293' as DeviceId;
const W = '3c5d7e9f-0000-4000-8000-000000000293';
let db: TestDb;
afterEach(async () => {
  await (db as TestDb | undefined)?.close();
  db = undefined as never;
});

async function openSession(sets = 2) {
  db = await openBaseDb(DEVICE, '2026-11-24T17:00:00.000Z');
  const r = await db.data.repos.workouts();
  await r.start({ source: 'empty', id: W, name: 'Séance' });
  const w = await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets, targetRepsMin: 8, targetRepsMax: 10 });
  return { r, sets: w.sets };
}
const must = <T>(v: T | null | undefined): T => {
  if (v === undefined || v === null) throw new Error('absent');
  return v;
};

describe('parseCorrectedFrom (écrit à la main, ADR 0008)', () => {
  it('lit les quatre valeurs d’avant ; illisible ou hors bornes : null', () => {
    expect(parseCorrectedFrom('{"reps":8,"loadKg":80,"durationSec":null,"rir":2}')).toEqual({ reps: 8, loadKg: 80, durationSec: null, rir: 2 });
    for (const bad of [null, '', 'oups', '[1]', '{"reps":0}', '{"loadKg":-1}', '{"rir":9}']) expect(parseCorrectedFrom(bad)).toBeNull();
  });
});

describe('BL-135 (D-481) : série ajoutée en séance', () => {
  it('addSet marque la série ajoutée ; les séries du programme restent non marquées ; la valeur survit à la clôture', async () => {
    const { r, sets } = await openSession(2);
    expect(sets.map((s) => s.added ?? null)).toEqual([null, null]);
    const extra = await r.addSet(W, 'bench-press-barbell');
    expect(extra.added).toBe(true);
    for (const s of [...sets, extra]) await r.validateSet(s.id, { reps: 8, loadKg: 80 });
    await r.close(W);
    const closed = must(await r.getClosed(W));
    expect(closed.sets.map((s) => s.added ?? null)).toEqual([null, null, true]);
    expect(await db.driver.select("SELECT 1 FROM sync_outbox WHERE table_name = 'workout_set' AND field = '*'")).toHaveLength(3);
  });
});

describe('C-072 (Q-13 B) : valeur d’avant la correction', () => {
  it('« Annuler la validation » garde les valeurs d’avant ; une série jamais validée : rien', async () => {
    const { r, sets } = await openSession(2);
    const [a, b] = sets;
    await r.validateSet(must(a).id, { reps: 8, loadKg: 80, rir: 2 });
    await r.unvalidateSet(must(a).id);
    await r.unvalidateSet(must(b).id);
    const now = must(await r.get(W)).sets;
    expect(now[0]?.correctedFrom).toEqual({ reps: 8, loadKg: 80, durationSec: null, rir: 2 });
    expect(now[1]?.correctedFrom ?? null).toBeNull();
  });

  it('correctSet d’une séance close : valeurs d’avant gardées et publiées (champ corrected_from) ; la dernière correction l’emporte', async () => {
    const { r, sets } = await openSession(1);
    const a = must(sets[0]);
    await r.validateSet(a.id, { reps: 8, loadKg: 80 });
    await r.close(W);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(3_600_000);
    const fixed = await r.correctSet(a.id, { loadKg: 82.5 });
    expect(fixed.correctedFrom).toEqual({ reps: 8, loadKg: 80, durationSec: null, rir: null });
    expect((await db.driver.select<{ field: string }>('SELECT field FROM sync_outbox ORDER BY field')).map((o) => o.field)).toContain('corrected_from');
    db.clock.advance(60_000);
    const again = await r.correctSet(a.id, { loadKg: 85 });
    expect(again.correctedFrom).toEqual({ reps: 8, loadKg: 82.5, durationSec: null, rir: null });
  });
});

describe('BL-112 : distance d’une série', () => {
  it('setDistance écrit et relit la distance (m) d’une série de la séance ouverte ; hors bornes ou séance close : refusé', async () => {
    const { r, sets } = await openSession(1);
    const a = must(sets[0]);
    expect((await r.setDistance(a.id, 1500)).distanceM).toBe(1500);
    expect((await r.setDistance(a.id, null)).distanceM ?? null).toBeNull();
    await expect(r.setDistance(a.id, -1)).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.setDistance(a.id, 200_000)).rejects.toMatchObject({ code: 'invalid' });
    await r.setDistance(a.id, 400);
    await r.validateSet(a.id, { reps: 8, loadKg: 80 });
    await r.close(W);
    expect(must((await r.getClosed(W))?.sets[0]).distanceM).toBe(400);
    await expect(r.setDistance(a.id, 500)).rejects.toMatchObject({ code: 'invalid' });
  });
});
