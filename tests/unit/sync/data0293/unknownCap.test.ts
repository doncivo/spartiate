import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { createSimDevice, pair, setupFirst, syncFolders, warmSimDevices, type SimDevice } from '../../../sim/syncDevice';

/**
 * DATA-0293 (BL-040) : un champ gardé pour un schéma plus récent (`sync_unknown`) abandonné au plafond n'était signalé qu'au journal technique ;
 * comme une opération mise de côté (TRI-04), il lève « received-unapplied » (compteur persistant). Plafond d'octets (16 Mio) atteint avec trois valeurs
 * de 6 Mo, la plus ancienne (hlc) part. Valeurs synthétiques.
 */
const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let a: SimDevice | undefined;
let b: SimDevice | undefined;
beforeAll(() => warmSimDevices());
afterEach(async () => {
  await a?.close();
  await b?.close();
  a = undefined;
  b = undefined;
});
const hlc = (n: number): string => `${String(1_791_187_200_000 + n).padStart(15, '0')}-0000-${'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}`;

async function twoDevices(): Promise<void> {
  a = await createSimDevice(A_ID, { name: 'PC' });
  b = await createSimDevice(B_ID, { name: 'iPhone', clock: createManualClock(a.clock.nowMs()) });
  await setupFirst(a);
  await a!.cycle();
  await pair(a, b);
  await b.cycle();
  syncFolders([a, b]);
  await a!.cycle();
}

describe('plafond des champs gardés : abandon signalé (BL-040)', () => {
  it('au-delà de 16 Mio : le plus ancien est abandonné, journalisé ET « received-unapplied » levé, qui survit au redémarrage', async () => {
    await twoDevices();
    for (const n of [1, 2, 3]) {
      await a!.driver.execute(
        "INSERT INTO sync_unknown (table_name, row_id, field, value, hlc, base_hlc, sv) VALUES ('workout_set', ?, 'added', replace(hex(zeroblob(6000000)), '00', 'x'), ?, NULL, 99)",
        [`7a1b0c2d-0000-4000-8000-00000000000${String(n)}`, hlc(n)],
      );
    }
    const status = await a!.cycle();
    expect(a!.logger.entries.filter((e) => e.event === 'cap-dropped')).toHaveLength(1);
    expect(await a!.driver.select('SELECT COUNT(*) AS n FROM sync_unknown')).toEqual([{ n: 2 }]);
    expect(status.warnings ?? []).toContain('received-unapplied');
    await a!.restart();
    expect((await a!.cycle()).warnings ?? []).toContain('received-unapplied');
  });

  it('garde-fou : sous le plafond, rien n’est levé', async () => {
    await twoDevices();
    await a!.driver.execute("INSERT INTO sync_unknown (table_name, row_id, field, value, hlc, base_hlc, sv) VALUES ('workout_set', '7a1b0c2d-0000-4000-8000-000000000001', 'added', '1', ?, NULL, 99)", [hlc(1)]);
    expect((await a!.cycle()).warnings ?? []).not.toContain('received-unapplied');
  });
});
