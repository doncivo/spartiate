import { afterEach, describe, expect, it } from 'vitest';
import { declareInjury, markHealed, recordCheckin, type Injury } from '../../../domain/training/injuries';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * SYNC-0291 (BL-120, D-447, D-464) : `InjuryRepository` (table publiée `injury`, migration 0021), identifiant UUID. Une écriture ne touche que les
 * champs changés (une réponse au check-in : `checkins` ; « Guérie » : `status`, `healed_on`). Reprise unique du réglage local `training.injuries` :
 * sans perte, idempotente, jamais au-dessus d'une ligne existante ; un identifiant ancien qui n'est pas un UUID reçoit un UUID neuf.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000fe' as DeviceId;
const U = (n: number): string => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TODAY = '2026-11-22' as LocalDate;
let db: TestDb;
afterEach(async () => db.close());
const repo = async () => db.data.repos.injuries();
const outbox = () => db.driver.select<{ row_id: string; field: string }>("SELECT row_id, field FROM sync_outbox WHERE table_name = 'injury' ORDER BY seq");
const declared = (id: string, over: Partial<{ muscleId: string | null; patterns: Injury['patterns']; note: string | null; startedOn: LocalDate }> = {}): Injury => {
  const r = declareInjury({ v: 1, items: [] }, { id, muscleId: 'chest', patterns: ['push-vertical'], startedOn: '2026-11-01' as LocalDate, note: 'note synthétique', ...over }, TODAY);
  if (!r.ok) throw new Error(r.issue);
  const item = r.value.items[0];
  if (!item) throw new Error('vide');
  return item;
};

describe('InjuryRepository', () => {
  it('save : insertion publiée en ligne entière, relue telle quelle (ordre de déclaration)', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    await (await repo()).save(declared(U(1)));
    db.clock.advance(1_000);
    await (await repo()).save(declared(U(2), { muscleId: null, patterns: ['squat'], note: null }));
    expect((await (await repo()).read()).items).toEqual([declared(U(1)), declared(U(2), { muscleId: null, patterns: ['squat'], note: null })]);
    expect(await outbox()).toEqual([
      { row_id: U(1), field: '*' },
      { row_id: U(2), field: '*' },
    ]);
  });

  it('save d’une gêne existante : seuls les champs changés partent ; inchangée : aucune écriture', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    const first = declared(U(1));
    await (await repo()).save(first);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const answered = recordCheckin({ v: 1, items: [first] }, U(1), 'same', TODAY);
    await (await repo()).save(answered.items[0] as Injury);
    expect(await outbox()).toEqual([{ row_id: U(1), field: 'checkins' }]);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const healed = markHealed(answered, U(1), TODAY);
    await (await repo()).save(healed.items[0] as Injury);
    expect((await outbox()).map((r) => r.field).sort()).toEqual(['healed_on', 'status']);
    await db.driver.execute('DELETE FROM sync_outbox');
    await (await repo()).save(healed.items[0] as Injury);
    expect(await outbox()).toEqual([]);
    expect((await (await repo()).read()).items).toEqual(healed.items);
  });

  it('gêne invalide (aucune cible, identifiant non UUID) : refusée sans écriture ; ligne illisible : non affichée, jamais effacée', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    await expect((await repo()).save({ ...declared(U(1)), muscleId: null, patterns: [] })).rejects.toThrow();
    await expect((await repo()).save(declared('g1'))).rejects.toThrow();
    expect(await db.driver.select('SELECT 1 FROM injury')).toEqual([]);
    await db.driver.execute(
      "INSERT INTO injury (id, muscle_id, patterns, started_on, note, status, healed_on, checkins, created_at, updated_at, device_id, hlc) VALUES (?, NULL, '[\"futur\"]', '2026-11-01', NULL, 'active', NULL, '[]', ?, ?, ?, ?)",
      [U(9), '2026-11-22T08:00:00.000Z', '2026-11-22T08:00:00.000Z', DEVICE, `001795000000000-0000-${DEVICE}`],
    );
    expect((await (await repo()).read()).items).toEqual([]);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM injury')).toEqual([{ n: 1 }]);
  });

  it('importLocal : insère les gênes sans ligne, garde l’ordre, UUID neuf pour un ancien identifiant, idempotent par identifiant', async () => {
    db = await openBaseDb(DEVICE, '2026-11-22T08:00:00.000Z');
    await (await repo()).save(declared(U(1), { note: 'déjà là' }));
    const legacy = [declared(U(1), { note: 'ancienne' }), declared('g1', { note: 'ancienne g1' }), declared(U(3), { muscleId: 'quads', patterns: [], note: null })];
    expect(await (await repo()).importLocal(legacy)).toBe(2);
    const items = (await (await repo()).read()).items;
    expect(items.map((i) => i.note)).toEqual(['déjà là', 'ancienne g1', null]);
    expect(items[1]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await (await repo()).importLocal(legacy)).toBe(0);
  });
});
