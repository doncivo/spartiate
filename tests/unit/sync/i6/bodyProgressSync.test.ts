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
 * I6-02 (D-26 ; § 9, § 17.1, § 20.2) : publication de `measurement` (`measurement|AAAA-MM-JJ|kind`) et de `progress_photo` (UUID, MÉTADONNÉES SEULEMENT).
 * Périmètre de non-régression : (a) mesure saisie sur un appareil reçue par l'autre ; (b) même mesure saisie des deux côtés hors ligne : convergence sur
 * l'écriture la plus récente, ligne unique ; (c) suppression et resaisie suivies ; (d) photo : la fiche passe, JAMAIS le fichier (l'autre appareil n'a
 * pas le fichier et le sait) ; suppression de la photo suivie, fichier local retiré ; (e) appareil resté en schéma 11 (ADR 0011 §7.2) : lignes gardées
 * dans `sync_unknown`, réintégrées après la migration 0012 ; (f) aucune donnée corporelle dans le journal technique ; (g) vecteur chiffré.
 */

const PC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IPHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DAY = '2026-11-09' as LocalDate;
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);

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
const measures = async (d: SimDevice) => d.data.repos.measurements();
const photos = async (d: SimDevice) => d.data.repos.progressPhotos();
const rows = (d: SimDevice) => d.driver.select('SELECT id, date, kind, value, deleted_at IS NOT NULL AS gone FROM measurement ORDER BY id');

describe('(a) mensurations : les deux appareils écrivent', () => {
  it('mesure du PC reçue par l’iPhone et inversement, rien d’inconnu ni de parqué', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await measures(pc)).save(DAY, 'waist', 82.5);
    await (await measures(iphone)).save('2026-11-10' as LocalDate, 'arm_left', 36);
    await roundTrip();
    for (const d of [pc, iphone]) {
      expect(await rows(d)).toEqual([
        { id: 'measurement|2026-11-09|waist', date: DAY, kind: 'waist', value: 82.5, gone: 0 },
        { id: 'measurement|2026-11-10|arm_left', date: '2026-11-10', kind: 'arm_left', value: 36, gone: 0 },
      ]);
      expect(await d.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
      expect(await d.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    }
  });
});

describe('(b) même mesure saisie sur deux appareils hors ligne', () => {
  it('convergence sur l’écriture la plus récente, une seule ligne', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await measures(pc)).save(DAY, 'waist', 82);
    iphone.clock.advance(5_000);
    await (await measures(iphone)).save(DAY, 'waist', 81.4);
    await roundTrip();
    const a = await rows(pc);
    expect(a).toEqual(await rows(iphone));
    expect(a).toEqual([{ id: 'measurement|2026-11-09|waist', date: DAY, kind: 'waist', value: 81.4, gone: 0 }]);
  });
});

describe('(c) suppression et resaisie', () => {
  it('suivies sur l’autre appareil', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await measures(pc)).save(DAY, 'hips', 95);
    await roundTrip();
    await (await measures(iphone)).remove(DAY, 'hips');
    await roundTrip();
    expect(await (await measures(pc)).list('hips')).toEqual([]);
    pc.clock.advance(10_000);
    await (await measures(pc)).save(DAY, 'hips', 94);
    await roundTrip();
    expect((await (await measures(iphone)).list('hips')).map((m) => m.value)).toEqual([94]);
  });
});

describe('(d) photo : la fiche passe, jamais le fichier', () => {
  it('l’autre appareil reçoit la fiche sans fichier ; la suppression est suivie et le fichier local retiré', async () => {
    const [pc, iphone] = await pcAndIphone();
    const added = await (await photos(iphone)).add(DAY, BYTES);
    await roundTrip();
    const onPc = await (await photos(pc)).list();
    expect(onPc.map((p) => [p.id, p.day, p.fileName])).toEqual([[added.id, DAY, added.fileName]]);
    expect(await (await photos(pc)).readFile(added.id)).toBeNull();
    expect(await pc.driver.select('SELECT 1 FROM progress_photo_file')).toEqual([]);
    expect(await (await photos(iphone)).readFile(added.id)).toEqual(BYTES);
    // La publication ne porte que la fiche : rien du contenu de l'image dans les enregistrements du dossier partagé.
    const published = JSON.stringify(iphone.logger.entries) + JSON.stringify(pc.logger.entries);
    expect(published).not.toMatch(/\/9j|progress_photo_file/);
    await (await photos(iphone)).remove(added.id);
    await roundTrip();
    expect(await (await photos(pc)).list()).toEqual([]);
    expect(await iphone.driver.select('SELECT 1 FROM progress_photo_file')).toEqual([]);
  });
});

describe('(e) appareil resté en schéma 11 (ADR 0011 §7.2)', () => {
  it('lignes reçues : aucune erreur, gardées dans sync_unknown ; réintégrées après la migration 0012', async () => {
    const [pc, iphone] = await pcAndIphone('v11');
    await (await measures(iphone)).save(DAY, 'chest', 101);
    const photo = await (await photos(iphone)).add(DAY, BYTES);
    await roundTrip();
    expect((await pc.driver.select<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_unknown ORDER BY table_name')).map((r) => r.table_name)).toEqual(['measurement', 'progress_photo']);
    expect(await pc.driver.select("SELECT 1 FROM sqlite_master WHERE name IN ('measurement', 'progress_photo')")).toEqual([]);
    expect(await pc.driver.select('SELECT 1 FROM sync_parked')).toEqual([]);
    await migrate(pc.driver, migrations);
    await reintegrateUnknownFields(pc.driver, { catalogue: SYNC_CATALOGUE, now: new Date(pc.clock.nowMs()).toISOString() as IsoDateTime });
    expect(await pc.driver.select('SELECT 1 FROM sync_unknown')).toEqual([]);
    expect(await rows(pc)).toEqual([{ id: 'measurement|2026-11-09|chest', date: DAY, kind: 'chest', value: 101, gone: 0 }]);
    expect(await pc.driver.select('SELECT id, file_name FROM progress_photo')).toEqual([{ id: photo.id, file_name: photo.fileName }]);
  });
});

describe('(f) aucune donnée corporelle dans le journal technique', () => {
  it('ni valeur ni genre de mensuration dans le journal de la synchro des deux appareils', async () => {
    const [pc, iphone] = await pcAndIphone();
    await (await measures(pc)).save(DAY, 'waist', 87.3);
    await roundTrip();
    for (const d of [pc, iphone]) {
      const text = JSON.stringify(d.logger.entries);
      expect(text).not.toMatch(/87\.3|waist/);
    }
  });
});

describe('(g) vecteurs chiffrés (tests/fixtures/sync/vectors.json)', () => {
  it.each([
    ['journal-ops-measurement', 'measurement', 'measurement|2026-11-09|waist'],
    ['journal-ops-progress-photo', 'progress_photo', '7d3c2e4f-0000-4000-8000-000000000001'],
  ])('%s : opérations valides pour le catalogue, forme canonique stable', (name, tableName, id) => {
    const record = vectors.records.find((r) => r.name === name);
    if (!record || !('json' in record.plaintext)) throw new Error(`vecteur ${name} absent`);
    expect(record.sv).toBe(12);
    const parsed = parseJournalRecord(record.plaintext.json);
    if (!parsed || parsed.k !== 'ops') throw new Error('vecteur illisible');
    expect(parsed.sv).toBe(12);
    expect(parsed.ops.map((op) => [op.t, op.id])).toEqual([[tableName, id]]);
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
