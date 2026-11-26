import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { createSimDevice, pair, setupFirst, syncFolders, warmSimDevices, type SimDevice, selectSimSchema } from '../../../sim/syncDevice';

// CLEAN-03 (D-201) : banc Spartiate (migration réelle, catalogue de production, entrées simulées sur `meal_entry`).
selectSimSchema('i0');

/**
 * DATA-0293 (BL-038) : publication. L'ajout natif au journal a réussi, puis la transaction locale (retrait des entrées de la file, tête, intention) échoue :
 * le `catch` effaçait l'intention d'ajout (`inflight`) alors que l'ajout avait eu lieu ; la reprise ne pouvait plus reconnaître cet enregistrement et la file
 * le republiait. L'intention est gardée tant que le retrait local n'a pas réussi ; le cycle suivant la résout, sans doublon ni conflit. Données synthétiques.
 */
const A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let devices: SimDevice[] = [];
beforeAll(() => warmSimDevices());
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

describe('publication : retrait local en échec après un ajout natif réussi (BL-038)', () => {
  it('l’intention d’ajout est gardée, puis résolue au cycle suivant : un seul exemplaire chez l’autre appareil', async () => {
    const a = await createSimDevice(A_ID, { name: 'PC' });
    const b = await createSimDevice(B_ID, { name: 'iPhone', clock: createManualClock(a.clock.nowMs()) });
    devices = [a, b];
    await setupFirst(a);
    await a.cycle();
    await pair(a, b);
    await b.cycle();
    syncFolders(devices);
    await a.cycle();
    await a.createTask('Une tâche');
    const realAppend = a.platform.appendJournal.bind(a.platform);
    const realTransaction = a.data.transaction.bind(a.data);
    let appended = false;
    let failed = false;
    // Enregistrements ajoutés au dossier journal de A depuis l'écriture de la tâche (BL-038 : une seule fois).
    let records = 0;
    (a.platform as { appendJournal: typeof realAppend }).appendJournal = async (request) => {
      const result = await realAppend(request);
      records += request.records.length;
      appended = true;
      return result;
    };
    (a.data as { transaction: typeof realTransaction }).transaction = ((work: never) => {
      if (appended && !failed) {
        failed = true;
        return Promise.reject(new Error('disque plein'));
      }
      return realTransaction(work);
    }) as typeof realTransaction;
    a.clock.advance(1_000);
    await a.cycle();
    expect(failed).toBe(true);
    (a.data as { transaction: typeof realTransaction }).transaction = realTransaction;
    expect(await a.driver.select("SELECT 1 FROM sync_meta WHERE key = 'inflight'")).toHaveLength(1);
    for (let i = 0; i < 3; i += 1) {
      for (const d of devices) {
        d.clock.advance(1_000);
        await d.cycle();
      }
      syncFolders(devices);
    }
    expect(records).toBe(1);
    expect(await a.driver.select('SELECT 1 FROM sync_outbox')).toEqual([]);
    expect(await a.driver.select("SELECT 1 FROM sync_meta WHERE key = 'inflight' AND value <> 'null'")).toEqual([]);
    expect((await b.driver.select<{ n: number }>("SELECT COUNT(*) AS n FROM meal_entry WHERE food_name = 'Une tâche'"))[0]?.n).toBe(1);
    expect((await b.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM conflict_log'))[0]?.n).toBe(0);
  });
});
