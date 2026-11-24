import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** SEANCE-0292 (C-072, § 13.4) : correction d'une série validée en séance active, tracée. Base SQLite réelle, données synthétiques. */
const DEVICE = '60000000-0000-4000-8000-0000000000f2' as DeviceId;
const W = '3c5d7e9f-0000-4000-8000-000000000001';
let db: TestDb;
afterEach(async () => db.close());

describe('C-072 : série validée rouverte puis revalidée', () => {
  it('« Annuler la validation » d’une série validée la marque corrigée (corrected_at), publiée avec la séance close', async () => {
    db = await openBaseDb(DEVICE, '2026-11-20T17:00:00.000Z');
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: W, name: 'Séance' });
    const w = await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 2, targetRepsMin: 8, targetRepsMax: 10 });
    const [a, b] = w.sets;
    if (!a || !b) throw new Error('séries absentes');
    await r.validateSet(a.id, { reps: 8, loadKg: 80 });
    await r.validateSet(b.id, { reps: 8, loadKg: 80 });
    db.clock.advance(60_000);
    await r.unvalidateSet(a.id);
    const again = await r.validateSet(a.id, { reps: 8, loadKg: 85 });
    expect(again.correctedAt).not.toBeNull();
    const untouched = (await r.get(W))?.sets.find((s) => s.id === b.id);
    expect(untouched?.correctedAt ?? null).toBeNull();
  });

  it('une série jamais validée qu’on retire de « à faire » n’est pas marquée (rien à corriger)', async () => {
    db = await openBaseDb(DEVICE, '2026-11-20T17:00:00.000Z');
    const r = await db.data.repos.workouts();
    await r.start({ source: 'empty', id: W, name: 'Séance' });
    const w = await r.addExercise(W, { exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 1, targetRepsMin: 8, targetRepsMax: 10 });
    const [a] = w.sets;
    if (!a) throw new Error('série absente');
    const once = await r.validateSet(a.id, { reps: 8, loadKg: 80 });
    expect(once.correctedAt ?? null).toBeNull();
  });
});
