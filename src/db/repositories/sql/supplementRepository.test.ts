import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId, LocalDate, LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-05 (§ 15.3, D-210, D-215) : `SupplementRepository` (tables `supplement` et `supplement_intake`). Compléments et prises PUBLIÉS, écrits par les deux
 * appareils ; prise = identifiant naturel `intake|<complément>|<date>|<heure>` (cochée des deux côtés : une ligne).
 */
const DEVICE = '60000000-0000-4000-8000-0000000000fc' as DeviceId;
let db: TestDb;
afterEach(async () => db.close());
const repo = async () => db.data.repos.supplements();
const outbox = () => db.driver.select<{ table_name: string; row_id: string; field: string }>("SELECT table_name, row_id, field FROM sync_outbox WHERE table_name LIKE 'supplement%' ORDER BY seq");
const draft = { name: 'Créatine', dose: 5, unit: 'g', times: ['08:00' as LocalTime], days: 127, active: true };
const D = '2026-11-13' as LocalDate;
const T = '08:00' as LocalTime;

describe('SupplementRepository', () => {
  it('create : ligne publiée, relue avec sa date de création ; list trie par nom, pause comprise', async () => {
    db = await openBaseDb(DEVICE, '2026-11-13T08:00:00.000Z');
    const a = await (await repo()).create({ ...draft, name: 'Zinc', times: ['20:00' as LocalTime, '08:00' as LocalTime] });
    const b = await (await repo()).create({ ...draft, active: false });
    expect(a.times).toEqual(['08:00', '20:00']);
    expect(a.since).toBe('2026-11-13');
    expect((await (await repo()).list()).map((s) => [s.name, s.active])).toEqual([
      ['Créatine', false],
      ['Zinc', true],
    ]);
    expect(await outbox()).toEqual([
      { table_name: 'supplement', row_id: a.id, field: '*' },
      { table_name: 'supplement', row_id: b.id, field: '*' },
    ]);
  });

  it('saisie invalide : refusée, rien d’écrit', async () => {
    db = await openBaseDb(DEVICE, '2026-11-13T08:00:00.000Z');
    await expect((await repo()).create({ ...draft, name: ' ' })).rejects.toThrow();
    await expect((await repo()).create({ ...draft, times: [] })).rejects.toThrow();
    expect(await (await repo()).list()).toEqual([]);
    expect(await outbox()).toEqual([]);
  });

  it('update : champs changés seulement ; remove : suppression logique, prises gardées mais complément absent', async () => {
    db = await openBaseDb(DEVICE, '2026-11-13T08:00:00.000Z');
    const a = await (await repo()).create(draft);
    await (await repo()).setTaken(a.id, D, T, true);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    await (await repo()).update(a.id, { ...draft, active: false, dose: 3 });
    expect((await outbox()).map((r) => r.field)).toEqual(['dose', 'active']);
    db.clock.advance(1_000);
    await (await repo()).remove(a.id);
    expect(await (await repo()).list()).toEqual([]);
    expect(await (await repo()).intakes(D, D)).toEqual([{ supplementId: a.id, date: D, moment: T }]);
    await expect((await repo()).update(a.id, draft)).rejects.toThrow();
  });

  it('setTaken : coche (ligne naturelle), décoche (suppression logique), recoche (rétablie) ; idempotent', async () => {
    db = await openBaseDb(DEVICE, '2026-11-13T08:00:00.000Z');
    const a = await (await repo()).create(draft);
    await db.driver.execute('DELETE FROM sync_outbox');
    const r = await repo();
    await r.setTaken(a.id, D, T, true);
    await r.setTaken(a.id, D, T, true);
    expect(await r.intakes(D, D)).toEqual([{ supplementId: a.id, date: D, moment: T }]);
    db.clock.advance(1_000);
    await r.setTaken(a.id, D, T, false);
    await r.setTaken(a.id, D, T, false);
    expect(await r.intakes(D, D)).toEqual([]);
    db.clock.advance(1_000);
    await r.setTaken(a.id, D, T, true);
    expect(await r.intakes(D, D)).toHaveLength(1);
    expect(await outbox()).toEqual([
      { table_name: 'supplement_intake', row_id: `intake|${a.id}|${D}|${T}`, field: '*' },
      { table_name: 'supplement_intake', row_id: `intake|${a.id}|${D}|${T}`, field: 'taken_at' },
      { table_name: 'supplement_intake', row_id: `intake|${a.id}|${D}|${T}`, field: 'deleted_at' },
      { table_name: 'supplement_intake', row_id: `intake|${a.id}|${D}|${T}`, field: '+' },
    ]);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM supplement_intake')).toEqual([{ n: 1 }]);
  });

  it('setTaken : complément inconnu ou heure invalide refusés', async () => {
    db = await openBaseDb(DEVICE, '2026-11-13T08:00:00.000Z');
    await expect((await repo()).setTaken('30000000-0000-4000-8000-000000000009', D, T, true)).rejects.toThrow();
    const a = await (await repo()).create(draft);
    await expect((await repo()).setTaken(a.id, D, '8h' as LocalTime, true)).rejects.toThrow();
  });

  it('intakes(from, to) : bornes incluses, triées par date puis heure', async () => {
    db = await openBaseDb(DEVICE, '2026-11-13T08:00:00.000Z');
    const a = await (await repo()).create({ ...draft, times: ['08:00' as LocalTime, '20:00' as LocalTime] });
    const r = await repo();
    for (const [day, m] of [['2026-11-14', '08:00'], ['2026-11-12', '20:00'], ['2026-11-13', '20:00'], ['2026-11-13', '08:00']] as const) await r.setTaken(a.id, day as LocalDate, m as LocalTime, true);
    expect((await r.intakes('2026-11-12' as LocalDate, '2026-11-13' as LocalDate)).map((x) => `${x.date} ${x.moment}`)).toEqual(['2026-11-12 20:00', '2026-11-13 08:00', '2026-11-13 20:00']);
  });
});
