import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { renphoDayDraft } from '../../../../src/domain/nutrition/renphoDay';
import type { LocalDate, LocalTime } from '../../../../src/domain/types';
import { createHealthBodyImportService } from '../../../../src/features/settings/healthBodyImport/service';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice } from '../../../sim/syncDevice';

/**
 * I6-04 (D-26 ; D-113) : AUCUNE table ni colonne nouvelle (schéma 13 inchangé) ; les données Renpho voyagent par les tables existantes `body_weight`,
 * `measurement` (genres `health_*`) et `meal_entry` (entrée « Renpho — total du jour »). Périmètre de non-régression : (a) mesure importée sur l'iPhone reçue
 * par le PC ; (b) le journal saisi sur le PC remplace l'entrée Renpho de l'iPhone après synchro ; (c) saisie concurrente du même jour (entrée Renpho
 * sur l'iPhone, repas sur le PC, hors ligne) : l'import suivant de l'iPhone rapproche (entrée Renpho supprimée), le PC la voit supprimée.
 */
const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DAY = '2026-10-05' as LocalDate;
const TOTALS = { kcal: 2300, proteinG: 150, fatG: 70, carbG: 260, fiberG: 28 };

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function pcAndIphone(): Promise<[SimDevice, SimDevice]> {
  const pc = await createSimDevice(PC, { name: 'PC', schema: 'i0' });
  const iphone = await createSimDevice(IPHONE, { name: 'iPhone', schema: 'i0', devicePlatform: 'ios', clock: createManualClock(pc.clock.nowMs()) });
  devices = [pc, iphone];
  await setupFirst(pc);
  await pc.cycle();
  await pair(pc, iphone);
  await iphone.cycle();
  syncFolders(devices);
  await pc.cycle();
  return [pc, iphone];
}
async function roundTrip(): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    for (const d of devices) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(devices);
  }
}
const meals = async (d: SimDevice) => (await d.data.repos.mealEntries()).listByDate(DAY);
const meal = { date: DAY, time: '12:30' as LocalTime, foodId: null, foodName: 'Déjeuner', source: 'manual', grams: null, kcal: 700, proteinG: null, fatG: null, carbG: null, method: 'quickadd', confidence: null } as const;

describe('données Renpho : tables existantes, deux appareils (I6-04)', () => {
  it('(a) mesures `health_*` et entrée du jour de l’iPhone reçues par le PC', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await iphone.data.repos.measurements()).save(DAY, 'health_body_fat_pct', 18.5);
    await (await iphone.data.repos.mealEntries()).create(renphoDayDraft(DAY, TOTALS));
    await roundTrip();
    expect((await (await pc.data.repos.measurements()).list('health_body_fat_pct')).map((m) => m.value)).toEqual([18.5]);
    expect((await meals(pc)).map((e) => e.foodName)).toEqual(['Renpho — total du jour']);
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
  });

  it('(b) un repas saisi sur le PC remplace l’entrée Renpho : la suppression arrive sur l’iPhone', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await iphone.data.repos.mealEntries()).create(renphoDayDraft(DAY, TOTALS));
    await roundTrip();
    await (await pc.data.repos.mealEntries()).create(meal);
    expect((await meals(pc)).map((e) => e.foodName)).toEqual(['Déjeuner']);
    await roundTrip();
    expect((await meals(iphone)).map((e) => e.foodName)).toEqual(['Déjeuner']);
  });

  it('(c) saisie concurrente hors ligne : l’import de l’iPhone rapproche et supprime l’entrée Renpho', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await pc.data.repos.mealEntries()).create(meal);
    await (await iphone.data.repos.mealEntries()).create(renphoDayDraft(DAY, TOTALS));
    await roundTrip();
    expect((await meals(iphone)).map((e) => e.foodName).sort()).toEqual(['Déjeuner', 'Renpho — total du jour']);
    const service = createHealthBodyImportService({
      reader: { kind: 'folder', automatic: true, read: async () => [{ name: 'energie.csv', state: 'ok', text: '2026-10-05T08:00:00+01:00;2300;kcal\n' }] },
      transaction: (work) => iphone.data.transaction(async (repos) => work({ weights: await repos.bodyWeights(), measurements: await repos.measurements(), meals: await repos.mealEntries() })),
      clock: iphone.clock,
      timeZone: 'Europe/Paris',
      log: () => undefined,
    });
    const result = await service.run('manual');
    expect(result.nutrition.superseded).toBe(1);
    await roundTrip();
    expect((await meals(pc)).map((e) => e.foodName)).toEqual(['Déjeuner']);
    expect((await meals(iphone)).map((e) => e.foodName)).toEqual(['Déjeuner']);
  });
});
