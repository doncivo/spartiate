import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I4-07 (D-81) : `DayCompletenessRepository` (table `day_completeness`, migration 0009). Une ligne par date locale, identifiant naturel
 * `day|AAAA-MM-JJ` ; « non déclarée » = aucune ligne ou ligne supprimée logiquement. Fixtures synthétiques.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000f9' as DeviceId;
const D = (day: number): LocalDate => `2026-11-${String(day).padStart(2, '0')}` as LocalDate;
let db: TestDb;
afterEach(async () => db.close());
const repo = async () => db.data.repos.dayCompleteness();
const outbox = () => db.driver.select<{ row_id: string; field: string }>("SELECT row_id, field FROM sync_outbox WHERE table_name = 'day_completeness' ORDER BY seq");

describe('DayCompletenessRepository', () => {
  it('declare : une ligne `day|date`, relue telle quelle, mise en file en ligne entière', async () => {
    db = await openBaseDb(DEVICE);
    const r = await (await repo()).declare(D(9), 'complete');
    expect(r).toMatchObject({ id: 'day|2026-11-09', date: D(9), state: 'complete', deletedAt: null, deviceId: DEVICE });
    expect(await (await repo()).get(D(9))).toEqual(r);
    expect(await outbox()).toEqual([{ row_id: 'day|2026-11-09', field: '*' }]);
  });

  it('declare : un jour sans déclaration est lu null (jamais « incomplète » par défaut)', async () => {
    db = await openBaseDb(DEVICE);
    expect(await (await repo()).get(D(9))).toBeNull();
    expect((await (await repo()).listBetween(D(1), D(30))).size).toBe(0);
  });

  it('declare deux fois le même jour : une seule ligne, la déclaration change (champ `state` seul mis en file)', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).declare(D(9), 'complete');
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const r = await (await repo()).declare(D(9), 'incomplete');
    expect(r.state).toBe('incomplete');
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM day_completeness')).toEqual([{ n: 1 }]);
    expect((await outbox()).map((o) => o.field)).toEqual(['state']);
  });

  it('declare la même valeur : aucune écriture, aucun nouvel horodatage', async () => {
    db = await openBaseDb(DEVICE);
    const first = await (await repo()).declare(D(9), 'complete');
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const again = await (await repo()).declare(D(9), 'complete');
    expect(again).toEqual(first);
    expect(await outbox()).toEqual([]);
  });

  it('clear : suppression logique (la ligne reste, lue null) ; idempotent ; redéclarer la rétablit (« + »)', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).declare(D(9), 'complete');
    db.clock.advance(1_000);
    await (await repo()).clear(D(9));
    expect(await (await repo()).get(D(9))).toBeNull();
    expect(await db.driver.select('SELECT deleted_at IS NOT NULL AS gone FROM day_completeness')).toEqual([{ gone: 1 }]);
    await (await repo()).clear(D(9)); // déjà effacée : sans effet
    await (await repo()).clear(D(20)); // jamais déclarée : sans effet
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    await (await repo()).declare(D(9), 'incomplete');
    expect(await (await repo()).get(D(9))).toMatchObject({ state: 'incomplete', deletedAt: null });
    expect((await outbox()).map((o) => o.field).sort()).toEqual(['+', 'deleted_at', 'state']);
  });

  it('listBetween : bornes incluses, déclarations vivantes seulement, par date', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await r.declare(D(8), 'complete');
    await r.declare(D(10), 'incomplete');
    await r.declare(D(12), 'complete');
    await r.declare(D(15), 'complete');
    await r.clear(D(12));
    const map = await r.listBetween(D(8), D(14));
    expect([...map.entries()]).toEqual([
      [D(8), 'complete'],
      [D(10), 'incomplete'],
    ]);
  });

  it('date ou état invalides : refusés sans rien écrire', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await expect(r.declare('2026-13-40' as LocalDate, 'complete')).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.declare('lundi' as LocalDate, 'complete')).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.declare(D(9), 'partial' as never)).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT * FROM day_completeness')).toEqual([]);
  });

  it('lève le signal de synchro après chaque écriture (declare, clear)', async () => {
    db = await openBaseDb(DEVICE);
    const { onLocalWrite } = await import('../../localWrite');
    let signals = 0;
    const off = onLocalWrite(() => (signals += 1));
    await (await repo()).declare(D(9), 'complete');
    await (await repo()).clear(D(9));
    off();
    expect(signals).toBe(2);
  });
});
