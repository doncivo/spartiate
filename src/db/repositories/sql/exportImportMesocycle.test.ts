import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, parseExportArchive, TRAINING_EXPORT_TABLES, type ExportData } from '../../../domain/exportImport/archive';
import { planImport } from '../../../domain/exportImport/plan';
import { DEFAULT_GENERATION_CONFIG as CONFIG } from '../../../domain/training/config';
import { createMesocycleSpec } from '../../../domain/training/mesocycle';
import { pauseProgram } from '../../../domain/training/programPause';
import type { DeviceId } from '../../../domain/types';
import { day, ROUTINE_ID, START } from '../../../../tests/fixtures/training/mesocycle';
import { openBaseDb, type TestDb } from './testSetup';

/** I3-02 : l'export / import (D-57) porte le cycle d'entraînement ; une archive de schéma 6 (sans cycle) reste importable. */

const A = '60000000-0000-4000-8000-0000000000a9' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000b9' as DeviceId;
const M = '6f5e4d3c-0000-4000-8000-000000000001';

const opened: TestDb[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.close()));
});
const open = async (device: DeviceId): Promise<TestDb> => {
  const db = await openBaseDb(device);
  opened.push(db);
  return db;
};
const read = async (db: TestDb): Promise<ExportData> => (await db.data.repos.exportImport()).readExportData();

describe('export / import du mésocycle (I3-02)', () => {
  it('table exportée avant les quatre tables de nutrition (I4-02), les trois de I4-07 et les deux de I5-01 ; schéma 7 puis suivants', () => {
    expect(TRAINING_EXPORT_TABLES.at(-16)).toBe('mesocycle'); // FIX-0181 puis I6-05 : food_favorite, supplement, supplement_intake en dernier.
    expect(EXPORT_SV).toBe(16); // I6-05 : schéma 16 (compléments publiés).
  });

  it('aller-retour : cycle en pause identique (hash canonique), publié comme toute écriture', async () => {
    const db = await open(A);
    const spec = createMesocycleSpec({ routineId: ROUTINE_ID, startDate: START, weeks: 6 }, CONFIG);
    const paused = spec === null ? null : pauseProgram(spec, day(9));
    if (paused === null) throw new Error('spec');
    await db.data.transaction(async (repos) => (await repos.mesocycles()).start(paused, { id: M }));
    const source = await read(db);
    expect(source.training?.mesocycle?.map((r) => [r.id, r.values['weeks'], r.values['pauses']])).toEqual([[M, 6, JSON.stringify(paused.pauses)]]);
    const archive = await buildExportArchive(source, { date: '2026-11-08T10:00:00.000Z', sv: 7 });
    const parsed = await parseExportArchive(archive.bytes, { currentSv: 7, currentYear: 2026 });
    const target = await open(B);
    await target.data.transaction(async (repos) => {
      const repo = await repos.exportImport();
      await repo.applyImport(planImport(await repo.readExportData(), parsed.data, 'merge'), 2026);
    });
    expect(await canonicalHash(await read(target))).toBe(await canonicalHash(source));
    expect(await (await target.data.repos.mesocycles()).current()).toMatchObject({ id: M, weeks: 6, pauses: paused.pauses });
    expect(await target.driver.select("SELECT row_id FROM sync_outbox WHERE table_name = 'mesocycle' AND field = '*'")).toEqual([{ row_id: M }]);
  });

  it('archive de schéma 6 (sans cycle) : importée, aucun cycle', async () => {
    const db = await open(A);
    const source = await read(db);
    const archive = await buildExportArchive({ ...source, training: {} }, { date: '2026-11-08T10:00:00.000Z', sv: 6 });
    const parsed = await parseExportArchive(archive.bytes, { currentSv: 7, currentYear: 2026 });
    expect(parsed.data.training?.mesocycle).toBeUndefined();
  });
});
