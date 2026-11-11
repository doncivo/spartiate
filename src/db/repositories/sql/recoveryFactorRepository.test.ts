import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-01 point B (§ 16.7) : `RecoveryFactorRepository` (table `recovery_factor`, migration 0011). Une ligne par date locale (la journée de la veille du
 * matin de saisie), identifiant naturel `recovery_factor|AAAA-MM-JJ` ; écrit par les DEUX appareils. « Rien de particulier » (`none`) est distinct
 * de « non renseigné » (aucune ligne, ou ligne supprimée logiquement). Fixtures synthétiques.
 */

const DEVICE = '60000000-0000-4000-8000-0000000000fa' as DeviceId;
const D = (day: number): LocalDate => `2026-11-${String(day).padStart(2, '0')}` as LocalDate;
let db: TestDb;
afterEach(async () => db.close());
const repo = async () => db.data.repos.recoveryFactors();
const outbox = () => db.driver.select<{ row_id: string; field: string }>("SELECT row_id, field FROM sync_outbox WHERE table_name = 'recovery_factor' ORDER BY seq");

describe('RecoveryFactorRepository', () => {
  it('save : une ligne `recovery_factor|date`, relue telle quelle, mise en file en ligne entière, codes dans l’ordre fixe', async () => {
    db = await openBaseDb(DEVICE);
    const r = await (await repo()).save(D(9), { factors: ['stress', 'alcohol'], none: false });
    expect(r).toMatchObject({ id: 'recovery_factor|2026-11-09', day: D(9), factors: ['alcohol', 'stress'], none: false, deletedAt: null, deviceId: DEVICE });
    expect(await (await repo()).get(D(9))).toEqual(r);
    expect(await outbox()).toEqual([{ row_id: 'recovery_factor|2026-11-09', field: '*' }]);
  });

  it('« rien de particulier » : none vrai, aucun facteur ; distinct d’un jour non renseigné (get rend null)', async () => {
    db = await openBaseDb(DEVICE);
    expect(await (await repo()).get(D(9))).toBeNull();
    const r = await (await repo()).save(D(9), { factors: [], none: true });
    expect(r).toMatchObject({ factors: [], none: true });
    expect((await (await repo()).get(D(9)))?.none).toBe(true);
  });

  it('modifiable dans la journée : une seule ligne, seuls les champs modifiés mis en file', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).save(D(9), { factors: ['alcohol'], none: false });
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    const r = await (await repo()).save(D(9), { factors: ['alcohol', 'travel'], none: false });
    expect(r.factors).toEqual(['alcohol', 'travel']);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recovery_factor')).toEqual([{ n: 1 }]);
    expect((await outbox()).map((o) => o.field)).toEqual(['factors']);
  });

  it('même valeur : aucune écriture, aucun nouvel horodatage', async () => {
    db = await openBaseDb(DEVICE);
    const first = await (await repo()).save(D(9), { factors: ['stress'], none: false });
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    expect(await (await repo()).save(D(9), { factors: ['stress'], none: false })).toEqual(first);
    expect(await outbox()).toEqual([]);
  });

  it('clear : suppression logique (non renseigné) ; une nouvelle saisie rétablit la ligne', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).save(D(9), { factors: ['stress'], none: false });
    await (await repo()).clear(D(9));
    expect(await (await repo()).get(D(9))).toBeNull();
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recovery_factor WHERE deleted_at IS NOT NULL')).toEqual([{ n: 1 }]);
    db.clock.advance(1_000);
    await (await repo()).save(D(9), { factors: ['illness'], none: false });
    expect((await (await repo()).get(D(9)))?.factors).toEqual(['illness']);
    await (await repo()).clear(D(20)); // jour sans ligne : sans effet
  });

  it('list : jours vivants de la plage, du plus ancien au plus récent', async () => {
    db = await openBaseDb(DEVICE);
    await (await repo()).save(D(12), { factors: [], none: true });
    await (await repo()).save(D(9), { factors: ['travel'], none: false });
    await (await repo()).save(D(10), { factors: ['soreness'], none: false });
    await (await repo()).clear(D(10));
    expect((await (await repo()).list(D(1), D(30))).map((r) => r.day)).toEqual([D(9), D(12)]);
    expect((await (await repo()).list(D(10), D(11))).length).toBe(0);
  });

  it('entrée invalide : refusée, rien n’est écrit (date, code inconnu, « rien » avec des facteurs, ni facteur ni « rien »)', async () => {
    db = await openBaseDb(DEVICE);
    const r = await repo();
    await expect(r.save('2026-13-40' as LocalDate, { factors: [], none: true })).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.save(D(9), { factors: ['bogus' as never], none: false })).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.save(D(9), { factors: ['stress'], none: true })).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.save(D(9), { factors: [], none: false })).rejects.toMatchObject({ code: 'invalid' });
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM recovery_factor')).toEqual([{ n: 0 }]);
  });

  it('un code inconnu écrit par un appareil plus récent est ignoré à la lecture, la ligne reste lisible', async () => {
    db = await openBaseDb(DEVICE);
    await db.driver.execute(
      `INSERT INTO recovery_factor (id, date, factors, none, created_at, updated_at, device_id, hlc) VALUES ('recovery_factor|2026-11-09', '2026-11-09', '["alcohol","future_code"]', 0,
       '2026-11-10T07:00:00.000Z', '2026-11-10T07:00:00.000Z', ?, ?)`,
      [DEVICE, `${String(Date.UTC(2026, 10, 10)).padStart(15, '0')}-0000-${DEVICE}`],
    );
    expect((await (await repo()).get(D(9)))?.factors).toEqual(['alcohol']);
  });
});
