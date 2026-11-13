import { afterEach, describe, expect, it } from 'vitest';
import { createManualClock } from '../../../../src/domain/clock';
import { SYNC_TABLE_ORDER } from '../../../../src/domain/sync/format';
import { expectedIntakeId, intakeId, isIntakeId } from '../../../../src/domain/sync/naturalIds';
import { parseJournalRecord, journalRecordToText } from '../../../../src/domain/sync/parse';
import { publishedColumns, SYNC_CATALOGUE } from '../../../../src/domain/sync/syncTables';
import type { IsoDateTime, LocalDate, LocalTime } from '../../../../src/domain/types';
import { migrate } from '../../../../src/db/migrator';
import { migrations } from '../../../../src/db/migrations';
import { CAPTURE_TABLES_V17 } from '../../../../src/db/migrations/0017_supplement';
import { reintegrateUnknownFields } from '../../../../src/db/repositories';
import { carryKindText } from '../../../../src/features/sync/carryReportText';
import { failureKinds } from '../../../../src/features/sync/syncText';
import { syncFieldFr } from '../../../../src/i18n/fr.syncField';
import vectors from '../../../fixtures/sync/vectors.json';
import { createSimDevice, pair, PRE_SUPPLEMENT_SCHEMA, setupFirst, syncFolders, type SimDevice, type SimSchema } from '../../../sim/syncDevice';

/**
 * I6-05 (D-26 ; D-210) : publication de `supplement` (UUID) et `supplement_intake` (`intake|<complément>|<date>|<heure>`), écrites par les DEUX
 * appareils. Périmètre de non-régression : (a) catalogue, copie figée, identifiants, journal des conflits, libellés ; (b) complément créé sur un
 * appareil reçu par l'autre ; (c) conflits : même prise cochée des deux côtés hors ligne → une ligne ; décochée d'un côté, recochée plus tard de
 * l'autre → cochée ; complément modifié des deux côtés → fusion champ par champ ; (d) appareil resté au schéma précédent (ADR 0011 §7.2) ;
 * (e) vecteur chiffré.
 */
const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUP = '30000000-0000-4000-8000-000000000001';
const D = '2026-11-13' as LocalDate;
const T = '08:00' as LocalTime;
const draft = { name: 'Créatine', dose: 5, unit: 'g', times: [T], days: 127, active: true };

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
const supplements = async (d: SimDevice) => d.data.repos.supplements();
const intakeRows = (d: SimDevice) => d.driver.select('SELECT id, deleted_at IS NOT NULL AS gone FROM supplement_intake ORDER BY id');

describe('(a) catalogue : supplement et supplement_intake', () => {
  it('dernières de l’ordre, sans parent publié ni colonne locale', () => {
    expect(SYNC_TABLE_ORDER.slice(-3, -1)).toEqual(['supplement', 'supplement_intake']); // I6-06 : cardio_session ensuite.
    expect(SYNC_CATALOGUE.tables.map((t) => t.name).slice(-3, -1)).toEqual(['supplement', 'supplement_intake']);
    for (const name of ['supplement', 'supplement_intake']) {
      const t = SYNC_CATALOGUE.table(name);
      expect(t?.parents).toEqual([]);
      expect(t?.local).toEqual([]);
      expect(t?.publishWhen).toBeUndefined();
    }
    expect(SYNC_CATALOGUE.table('supplement')?.idKind).toBe('uuid');
    expect(SYNC_CATALOGUE.table('supplement_intake')?.idKind).toBe('natural');
  });

  it('copie figée de la migration = catalogue vivant', () => {
    expect(CAPTURE_TABLES_V17.map(([name]) => name)).toEqual(['supplement', 'supplement_intake']);
    for (const [name, columns] of CAPTURE_TABLES_V17) {
      const t = SYNC_CATALOGUE.table(name);
      if (!t) throw new Error(name);
      expect([...publishedColumns(t)]).toEqual([...columns]);
    }
  });

  it('identifiant naturel de la prise ; aucun repli UUID', () => {
    const t = SYNC_CATALOGUE.table('supplement_intake');
    if (!t) throw new Error('supplement_intake');
    const ok = intakeId(SUP, D, T);
    expect(ok).toBe(`intake|${SUP}|2026-11-13|08:00`);
    expect(isIntakeId(ok)).toBe(true);
    expect(SYNC_CATALOGUE.isValidRowId(t, ok)).toBe(true);
    for (const bad of [SUP, `intake|${SUP}|2026-11-13`, `intake|${SUP}|2026-13-01|08:00`, `intake|${SUP}|2026-11-13|8:00`, `intake|x|2026-11-13|08:00`, `${ok}|x`]) {
      expect(isIntakeId(bad), bad).toBe(false);
      expect(SYNC_CATALOGUE.isValidRowId(t, bad), bad).toBe(false);
    }
    expect(expectedIntakeId(new Map<string, unknown>([['supplement_id', SUP], ['date', D], ['moment', T]]))).toBe(ok);
    expect(expectedIntakeId(new Map<string, unknown>([['supplement_id', SUP], ['date', D]]))).toBeNull();
  });

  it('types et journal des conflits : nom, actif et suppression visibles ; prise : suppression seulement', () => {
    const col = (t: string, c: string) => {
      const found = SYNC_CATALOGUE.column(t, c);
      if (!found) throw new Error(`${t}.${c}`);
      return found;
    };
    expect(SYNC_CATALOGUE.isValidValue(col('supplement', 'name'), 'x'.repeat(81))).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(col('supplement', 'days'), 127)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('supplement', 'days'), 0)).toBe(false);
    expect(SYNC_CATALOGUE.isValidValue(col('supplement', 'dose'), null)).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('supplement_intake', 'moment'), '08:00')).toBe(true);
    expect(SYNC_CATALOGUE.isValidValue(col('supplement_intake', 'moment'), '8h')).toBe(false);
    expect(SYNC_CATALOGUE.table('supplement')?.columns.filter((c) => c.conflictVisible).map((c) => c.name)).toEqual(['name', 'active', 'deleted_at']);
    expect(SYNC_CATALOGUE.table('supplement_intake')?.columns.filter((c) => c.conflictVisible).map((c) => c.name)).toEqual(['deleted_at']);
  });

  it('libellés de synchro', () => {
    expect(carryKindText('supplement')).toBe('Complément');
    expect(carryKindText('supplement_intake')).toBe('Prise de complément');
    expect(failureKinds(['supplement', 'supplement_intake'])).toBe('compléments, prises de compléments');
    expect(syncFieldFr.supplement).toEqual({ name: 'nom', active: 'actif', deleted_at: 'suppression' });
    expect(syncFieldFr.supplement_intake).toEqual({ deleted_at: 'suppression' });
  });
});

describe('(b) les deux appareils écrivent', () => {
  it('complément du PC et prise de l’iPhone reçus partout, rien d’inconnu ni de parqué', async () => {
    const [pc, iphone] = await pcAndIphone();
    const s = await (await supplements(pc)).create(draft);
    await roundTrip();
    await (await supplements(iphone)).setTaken(s.id, D, T, true);
    await roundTrip();
    for (const d of [pc, iphone]) {
      expect((await (await supplements(d)).list()).map((x) => x.name)).toEqual(['Créatine']);
      expect(await (await supplements(d)).intakes(D, D)).toEqual([{ supplementId: s.id, date: D, moment: T }]);
      expect(await d.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
      expect(await d.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    }
  });
});

describe('(c) conflits', () => {
  it('même prise cochée sur les deux appareils hors ligne : une seule ligne, cochée partout', async () => {
    const [pc, iphone] = await pcAndIphone();
    const s = await (await supplements(pc)).create(draft);
    await roundTrip();
    await (await supplements(pc)).setTaken(s.id, D, T, true);
    iphone.clock.advance(3_000);
    await (await supplements(iphone)).setTaken(s.id, D, T, true);
    await roundTrip();
    expect(await intakeRows(pc)).toEqual(await intakeRows(iphone));
    expect(await intakeRows(pc)).toEqual([{ id: intakeId(s.id, D, T), gone: 0 }]);
  });

  it('décochée sur le PC, recochée PLUS TARD sur l’iPhone hors ligne : cochée partout (dernière écriture gagne)', async () => {
    const [pc, iphone] = await pcAndIphone();
    const s = await (await supplements(pc)).create(draft);
    await (await supplements(pc)).setTaken(s.id, D, T, true);
    await roundTrip();
    await (await supplements(iphone)).setTaken(s.id, D, T, false);
    pc.clock.advance(1_000);
    await (await supplements(pc)).setTaken(s.id, D, T, false);
    iphone.clock.advance(5_000);
    await (await supplements(iphone)).setTaken(s.id, D, T, true);
    await roundTrip();
    for (const d of [pc, iphone]) expect(await (await supplements(d)).intakes(D, D)).toHaveLength(1);
    expect(await intakeRows(pc)).toEqual(await intakeRows(iphone));
  });

  it('complément modifié des deux côtés hors ligne : champs différents tous gardés, convergence', async () => {
    const [pc, iphone] = await pcAndIphone();
    const s = await (await supplements(pc)).create(draft);
    await roundTrip();
    await (await supplements(pc)).update(s.id, { ...draft, dose: 3 });
    iphone.clock.advance(2_000);
    await (await supplements(iphone)).update(s.id, { ...draft, active: false });
    await roundTrip();
    for (const d of [pc, iphone]) expect((await (await supplements(d)).list()).map((x) => [x.dose, x.active])).toEqual([[3, false]]);
  });
});

describe('(d) appareil resté au schéma précédent (ADR 0011 §7.2)', () => {
  it('lignes reçues gardées dans sync_unknown sans erreur, réintégrées après la migration', async () => {
    const [pc, iphone] = await pcAndIphone(PRE_SUPPLEMENT_SCHEMA);
    const s = await (await supplements(iphone)).create(draft);
    await (await supplements(iphone)).setTaken(s.id, D, T, true);
    await roundTrip();
    expect((await pc.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name')).map((r) => r.table_name)).toEqual(['supplement', 'supplement_intake']);
    expect(await pc.driver.select("SELECT 1 FROM sqlite_master WHERE name = 'supplement'")).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    await migrate(pc.driver, migrations);
    await reintegrateUnknownFields(pc.driver, { catalogue: SYNC_CATALOGUE, now: new Date(pc.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await pc.driver.select('SELECT id, name FROM supplement')).toEqual([{ id: s.id, name: 'Créatine' }]);
    expect(await intakeRows(pc)).toEqual([{ id: intakeId(s.id, D, T), gone: 0 }]);
  });
});

describe('(e) vecteur chiffré (tests/fixtures/sync/vectors.json)', () => {
  it('journal-ops-supplement : opérations valides pour le catalogue, forme canonique stable', () => {
    const record = vectors.records.find((r) => r.name === 'journal-ops-supplement');
    if (!record || !('json' in record.plaintext)) throw new Error('vecteur journal-ops-supplement absent');
    const parsed = parseJournalRecord(record.plaintext.json);
    if (!parsed || parsed.k !== 'ops') throw new Error('vecteur illisible');
    // I6-06 : le vecteur est écrit par un appareil au schéma des compléments (0017), qui n'est plus le dernier (0018, cardio).
    expect(parsed.sv).toBe(migrations.findIndex((m) => m.name === 'supplement') + 1);
    expect(parsed.ops.map((op) => [op.t, op.id])).toEqual([
      ['supplement', SUP],
      ['supplement_intake', intakeId(SUP, D, T)],
    ]);
    for (const op of parsed.ops) {
      const t = SYNC_CATALOGUE.table(op.t);
      if (!t) throw new Error(op.t);
      expect(SYNC_CATALOGUE.isValidRowId(t, op.id)).toBe(true);
      expect([...op.f.keys()].sort()).toEqual([...publishedColumns(t)].sort());
      for (const [col, [value]] of op.f) {
        const c = SYNC_CATALOGUE.column(op.t, col);
        expect(c && SYNC_CATALOGUE.isValidValue(c, value), `${op.t}.${col}`).toBe(true);
      }
    }
    expect(journalRecordToText(parsed)).toBe(record.plaintext.json);
  });
});
