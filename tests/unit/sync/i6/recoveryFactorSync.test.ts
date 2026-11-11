import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { parseJournalRecord, journalRecordToText } from '../../../../src/domain/sync/parse';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { IsoDateTime, LocalDate } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import vectors from '../../../fixtures/sync/vectors.json';
import { createSimDevice, pair, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * I6-01 (D-26 ; § 16.7, § 20.2) : publication de `recovery_factor` (`recovery_factor|AAAA-MM-JJ`), écrite par les DEUX appareils (le PC comme
 * l'iPhone : aucune règle de lecteur). Périmètre de non-régression : (a) saisie du PC reçue par l'iPhone et inversement ; (b) deux appareils
 * saisissent le même jour hors ligne : convergence sur l'écriture la plus récente (HLC), ligne unique ; (c) « rien de particulier » et suppression /
 * restauration suivis ; (d) appareil resté en schéma 10 (ADR 0011 §7.2) : lignes gardées dans `sync_unknown`, réintégrées après la migration 0011 ;
 * (e) aucune habitude de vie dans le journal technique ; (f) vecteur chiffré `journal-ops-recovery-factor` (tests/fixtures/sync/vectors.json).
 */

const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DAY = '2026-11-09' as LocalDate;

let devices: SimDevice[] = [];
afterEach(async () => {
  await Promise.all(devices.map((d) => d.close()));
  devices = [];
});

/** Rend [PC, iPhone] associés et synchronisés (le PC crée le dossier). `schemaPc` : schéma du PC. */
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
const factors = async (d: SimDevice) => d.data.repos.recoveryFactors();
const rows = (d: SimDevice) => d.driver.select('SELECT id, date, factors, none, deleted_at IS NOT NULL AS gone FROM recovery_factor ORDER BY id');

describe('(a) les deux appareils écrivent', () => {
  it('saisie du PC reçue par l’iPhone, saisie de l’iPhone reçue par le PC, rien d’inconnu ni de parqué', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await factors(pc)).save(DAY, { factors: ['alcohol', 'late_meal'], none: false });
    await (await factors(iphone)).save('2026-11-10' as LocalDate, { factors: [], none: true });
    await roundTrip();
    for (const d of [pc, iphone]) {
      expect(await rows(d)).toEqual([
        { id: 'recovery_factor|2026-11-09', date: DAY, factors: '["alcohol","late_meal"]', none: 0, gone: 0 },
        { id: 'recovery_factor|2026-11-10', date: '2026-11-10', factors: '[]', none: 1, gone: 0 },
      ]);
      expect(await d.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
      expect(await d.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    }
    expect((await (await factors(iphone)).get(DAY))?.deviceId).toBe(PC);
  });
});

describe('(b) même jour saisi sur deux appareils hors ligne', () => {
  it('convergence sur l’écriture la plus récente, une seule ligne, dans les deux ordres de réception', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await factors(pc)).save(DAY, { factors: ['alcohol'], none: false });
    iphone.clock.advance(5_000);
    await (await factors(iphone)).save(DAY, { factors: ['stress', 'travel'], none: false });
    await roundTrip();
    const a = await rows(pc);
    expect(a).toEqual(await rows(iphone));
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ factors: '["stress","travel"]', none: 0 });
  });
});

describe('(c) « rien de particulier », suppression et restauration', () => {
  it('suivis sur l’autre appareil, « non renseigné » distinct de « rien de particulier »', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await factors(pc)).save(DAY, { factors: [], none: true });
    await roundTrip();
    expect((await (await factors(iphone)).get(DAY))?.none).toBe(true);
    await (await factors(iphone)).clear(DAY);
    await roundTrip();
    expect(await (await factors(pc)).get(DAY)).toBeNull();
    expect(await rows(pc)).toEqual([{ id: 'recovery_factor|2026-11-09', date: DAY, factors: '[]', none: 1, gone: 1 }]);
    pc.clock.advance(10_000);
    await (await factors(pc)).save(DAY, { factors: ['soreness'], none: false });
    await roundTrip();
    expect((await (await factors(iphone)).get(DAY))?.factors).toEqual(['soreness']);
  });
});

describe('(d) appareil resté en schéma 10 (ADR 0011 §7.2)', () => {
  it('lignes reçues : aucune erreur, gardées dans sync_unknown ; réintégrées après la migration 0011', async () => {
    const [pc, iphone] = await pcAndIphone('v10');
    await (await factors(iphone)).save(DAY, { factors: ['illness'], none: false });
    await roundTrip();
    expect((await pc.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown')).map((r) => r.table_name)).toEqual(['recovery_factor']);
    expect(await pc.driver.select("SELECT 1 FROM sqlite_master WHERE name = 'recovery_factor'")).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    await migrate(pc.driver, migrations);
    await reintegrateUnknownFields(pc.driver, { catalogue: SYNC_CATALOGUE, now: new Date(pc.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await rows(pc)).toEqual([{ id: 'recovery_factor|2026-11-09', date: DAY, factors: '["illness"]', none: 0, gone: 0 }]);
  });
});

describe('(e) aucune habitude de vie dans le journal technique', () => {
  it('ni code de facteur ni date dans le journal de la synchro des deux appareils', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await factors(pc)).save(DAY, { factors: ['alcohol', 'illness'], none: false });
    await roundTrip();
    for (const d of [pc, iphone]) {
      const text = JSON.stringify(d.logger.entries);
      expect(text).not.toMatch(/alcohol|illness|caffeine_late|late_meal/);
    }
  });
});

describe('(f) vecteur chiffré recovery_factor (tests/fixtures/sync/vectors.json)', () => {
  it('enregistrement de journal en schéma 11 : opérations valides pour le catalogue, forme canonique stable', () => {
    const record = vectors.records.find((r) => r.name === 'journal-ops-recovery-factor');
    if (!record || !('json' in record.plaintext)) throw new Error('vecteur journal-ops-recovery-factor absent');
    expect(record.sv).toBe(11);
    const parsed = parseJournalRecord(record.plaintext.json);
    if (!parsed || parsed.k !== 'ops') throw new Error('vecteur illisible');
    expect(parsed.sv).toBe(11);
    expect(parsed.ops.map((op) => [op.t, op.id])).toEqual([['recovery_factor', 'recovery_factor|2026-11-09']]);
    for (const op of parsed.ops) {
      const t = SYNC_CATALOGUE.table(op.t);
      if (!t) throw new Error(op.t);
      expect(SYNC_CATALOGUE.isValidRowId(t, op.id)).toBe(true);
      expect([...op.f.keys()].sort()).toEqual([...publishedColumns(t)].sort());
      for (const [name, [value]] of op.f) {
        const col = SYNC_CATALOGUE.column(op.t, name);
        expect(col && SYNC_CATALOGUE.isValidValue(col, value), `${op.t}.${name}`).toBe(true);
      }
      expect(t.natural?.expected(new Map([...op.f].map(([k, [v]]) => [k, v])))).toBe(op.id);
    }
    expect(journalRecordToText(parsed)).toBe(record.plaintext.json);
  });
});
