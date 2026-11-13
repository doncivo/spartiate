import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { RESET_TABLES } from '../../../../src/domain/dataReset';
import { SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { IsoDateTime, LocalDate } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import { createDataAccess } from '../../../../src/db/repositories/dataAccess';
import { createSqlRepositoriesFor } from '../../../../src/db/repositories/sql';
import { createHlcClock, createWriteStamper } from '../../../../src/domain/hlc';
import type { DeviceId } from '../../../../src/domain/types';
import { enforceDataReset, resetAllData } from '../../../../src/sync/dataReset';
import { createMemorySyncLogger } from '../../../../src/sync/log';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * RESET-01 (D-26 ; D-180 à D-186 ; ADR 0011 avenant 36) : propagation de « Repartir de zéro » par la synchro. Périmètre de non-régression : (a) l'autre
 * appareil, en ligne, efface aussi ; (b) hors ligne au moment de la remise à zéro : il efface à son retour, ses écritures d'avant (publiées ou non,
 * modifications d'anciennes lignes comprises) ne reviennent nulle part ; ses écritures d'après circulent ; (c) appareil en retard : ses anciens journaux
 * sont écartés ; (d) appareil resté en schéma 15 : ne casse pas, rien d'ancien n'est réappliqué, efface après sa mise à jour ; (e) après la remise à
 * zéro, la synchro reprend normalement dans les deux sens. Horloge simulée seulement (aucune minuterie réelle).
 */
const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TODAY = '2026-11-20' as LocalDate;

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

async function pcAndIphone(schemaPc: SimSchema = 'i0'): Promise<[SimDevice, SimDevice]> {
  const pc = await createSimDevice(PC, { name: 'PC', schema: schemaPc });
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
async function roundTrip(list: readonly SimDevice[] = devices): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    for (const d of list) {
      d.clock.advance(1_000);
      await d.cycle();
    }
    syncFolders(list);
  }
}
const weigh = async (d: SimDevice, date: string, kg: number): Promise<void> => {
  await (await d.data.repos.bodyWeights()).saveManual({ date: date as LocalDate, kg, timezone: 'Europe/Paris' }, TODAY);
};
const weights = (d: SimDevice) => d.driver.select<{ id: string; kg: number }>('SELECT id, kg FROM body_weight WHERE deleted_at IS NULL ORDER BY id');
const count = async (d: SimDevice, table: string): Promise<number> => Number((await d.driver.select<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))[0]?.n ?? 0);
const wipedTables = Object.entries(RESET_TABLES)
  .filter(([, fate]) => fate === 'wiped')
  .map(([name]) => name);
async function expectEmpty(d: SimDevice): Promise<void> {
  for (const table of wipedTables) expect(await count(d, table), table).toBe(0);
}
const reset = async (d: SimDevice) => {
  const outcome = await resetAllData(d.data, SYNC_CATALOGUE, createMemorySyncLogger());
  expect(outcome.kind).toBe('done');
};

describe('(a) l’autre appareil, en ligne, efface aussi', () => {
  it('pesées, favoris et profil des deux appareils effacés partout ; une seule ligne data_reset ; réglages de l’iPhone gardés', async () => {
    const [pc, iphone] = await pcAndIphone();
    await weigh(pc, '2026-11-10', 82.4);
    await weigh(iphone, '2026-11-11', 82.1);
    await (await iphone.data.repos.foodFavorites()).add({ source: 'ciqual', ref: 'ciqual:20' });
    await iphone.data.repos.settings.set('ui.theme', 'light');
    await iphone.data.repos.settings.set('onboarding.completed', true);
    await roundTrip();
    expect(await weights(iphone)).toHaveLength(2);
    pc.clock.advance(5_000);
    await reset(pc);
    await roundTrip();
    for (const d of [pc, iphone]) {
      await expectEmpty(d);
      expect(await count(d, 'data_reset')).toBe(1);
      expect(await d.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
      expect(await d.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    }
    expect(await iphone.data.repos.settings.get('ui.theme')).toBe('light');
    expect(await iphone.data.repos.settings.get('onboarding.completed')).toBe(false);
  });
});

describe('(b) l’autre appareil était hors ligne', () => {
  it('écritures d’avant (non publiées, ou modification hors ligne d’une ancienne ligne) jamais revenues ; écriture d’après reçue partout', async () => {
    const [pc, iphone] = await pcAndIphone();
    await weigh(pc, '2026-11-10', 82.4);
    await roundTrip();
    // iPhone hors ligne : une pesée nouvelle AVANT la remise à zéro, jamais publiée.
    iphone.clock.advance(1_000);
    await weigh(iphone, '2026-11-12', 81.9);
    // Le PC remet à zéro plus tard ; l'iPhone ne le sait pas.
    pc.clock.advance(10_000);
    await reset(pc);
    await pc.cycle();
    // Toujours hors ligne, APRÈS la remise à zéro : il corrige l'ancienne pesée du 10 et en saisit une nouvelle le 14.
    iphone.clock.advance(20_000);
    await weigh(iphone, '2026-11-10', 80.0);
    await weigh(iphone, '2026-11-14', 79.5);
    await iphone.cycle();
    await roundTrip();
    for (const d of [pc, iphone]) expect(await weights(d), d === pc ? 'PC' : 'iPhone').toEqual([{ id: 'weight|2026-11-14|manual', kg: 79.5 }]);
    for (const d of [pc, iphone]) expect(await d.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
  });

  it('écritures de l’iPhone publiées avant la remise à zéro mais jamais lues par le PC (appareil en retard) : écartées, rien ne revient', async () => {
    const [pc, iphone] = await pcAndIphone();
    iphone.clock.advance(1_000);
    await weigh(iphone, '2026-11-12', 81.9);
    await iphone.cycle(); // publié dans son dossier, jamais copié vers le PC
    pc.clock.advance(10_000);
    await reset(pc);
    await pc.cycle();
    await roundTrip();
    for (const d of [pc, iphone]) {
      await expectEmpty(d);
      expect(await d.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    }
  });
});

describe('(c) aucune résurrection ensuite', () => {
  it('cycles répétés, nouvelle remise à zéro absente : les journaux anciens restent écartés', async () => {
    const [pc, iphone] = await pcAndIphone();
    await weigh(pc, '2026-11-10', 82.4);
    await weigh(iphone, '2026-11-11', 82.1);
    await roundTrip();
    pc.clock.advance(5_000);
    await reset(pc);
    await roundTrip();
    await roundTrip();
    for (const d of [pc, iphone]) await expectEmpty(d);
  });

  it('reprise depuis un instantané écrit avant la remise à zéro (fusion) : aucune ligne d’avant ne revient', async () => {
    const [pc, iphone] = await pcAndIphone();
    await weigh(pc, '2026-11-10', 82.4);
    await roundTrip();
    pc.clock.advance(5_000);
    await reset(pc);
    await roundTrip();
    // Reprise complète demandée sur l'iPhone : il repart de l'instantané du PC (écrit à l'ouverture de l'époque, avant la remise à zéro).
    await iphone.data.repos.sync.setMeta('resume', 'true');
    await roundTrip();
    for (const d of [pc, iphone]) await expectEmpty(d);
  });
});

describe('(d) appareil resté en schéma 15', () => {
  it('ne casse pas (ligne gardée dans sync_unknown) ; ses anciennes lignes ne reviennent pas ; après sa mise à jour, il efface', async () => {
    const [pc, iphone] = await pcAndIphone('v15');
    await weigh(pc, '2026-11-10', 82.4);
    await roundTrip();
    iphone.clock.advance(5_000);
    await reset(iphone);
    await roundTrip();
    // Ancienne version : la remise à zéro est gardée pour plus tard, sans erreur, sans rien de parqué.
    expect((await pc.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown')).map((r) => r.table_name)).toEqual(['data_reset']);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    // Il modifie l'ancienne pesée et la republie : l'iPhone ne la reprend pas.
    pc.clock.advance(20_000);
    await weigh(pc, '2026-11-10', 80.0);
    await roundTrip();
    expect(await weights(iphone)).toEqual([]);
    // Mise à jour du PC : migration 0016, réintégration, puis le cycle efface.
    await migrate(pc.driver, migrations);
    await reintegrateUnknownFields(pc.driver, { catalogue: SYNC_CATALOGUE, now: new Date(pc.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await count(pc, 'data_reset')).toBe(1);
    // Premier cycle de la nouvelle version : même base, catalogue de production.
    const data = createDataAccess(pc.driver, createWriteStamper(pc.clock, createHlcClock({ clock: pc.clock, deviceId: PC as DeviceId })), createSqlRepositoriesFor(SYNC_CATALOGUE));
    const touched = await enforceDataReset(data, SYNC_CATALOGUE, createMemorySyncLogger(), pc.clock.nowMs());
    expect(touched?.has('data_reset')).toBe(true);
    await expectEmpty(pc);
    expect(await count(pc, 'data_reset')).toBe(1);
    // Rejouée, elle ne fait plus rien.
    expect(await enforceDataReset(data, SYNC_CATALOGUE, createMemorySyncLogger(), pc.clock.nowMs())).toBeNull();
  });
});

describe('(e) après la remise à zéro, la synchro reprend normalement', () => {
  it('saisies des deux côtés après la remise à zéro : reçues partout', async () => {
    const [pc, iphone] = await pcAndIphone();
    await weigh(pc, '2026-11-10', 82.4);
    await roundTrip();
    pc.clock.advance(5_000);
    await reset(pc);
    await roundTrip();
    for (const d of devices) d.clock.advance(5_000);
    await weigh(pc, '2026-11-18', 78.0);
    await weigh(iphone, '2026-11-19', 77.5);
    await (await iphone.data.repos.foodFavorites()).add({ source: 'ciqual', ref: 'ciqual:30' });
    await roundTrip();
    for (const d of [pc, iphone]) {
      expect(await weights(d)).toEqual([
        { id: 'weight|2026-11-18|manual', kg: 78 },
        { id: 'weight|2026-11-19|manual', kg: 77.5 },
      ]);
      expect(await count(d, 'food_favorite')).toBe(1);
    }
  });
});
