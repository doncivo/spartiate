import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildExportArchive, type ExportData } from '../../domain/exportImport/archive';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { createMemoryFiles, type MemoryFiles } from '../../platform/files';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { ExportImportScreen } from './ExportImportScreen';

const DEVICE = '60000000-0000-4000-8000-0000000000e5' as DeviceId;
const DATA: ExportData = {
  profile: { id: 'profile|singleton', sex: 'male', birthYear: 1990, heightCm: 181, goal: null, experience: null, units: 'metric' },
  weights: [
    { id: 'weight|2026-10-04|manual', date: '2026-10-04', kg: 82.4, source: 'manual', timezone: 'Europe/Paris', healthUuid: null, measuredAt: null },
    { id: 'weight|2026-10-05|manual', date: '2026-10-05', kg: 82.1, source: 'manual', timezone: 'Europe/Paris', healthUuid: null, measuredAt: null },
  ],
  settings: { 'ui.theme': 'light' },
};

describe('Plus › Export et import', () => {
  let db: TestDb;
  let files: MemoryFiles;
  const open = () => {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, files });
    return render(
      <AppContainerProvider container={container}>
        <ExportImportScreen />
      </AppContainerProvider>,
    );
  };
  const archive = async (data: ExportData = DATA): Promise<Uint8Array> => (await buildExportArchive(data, { date: '2026-10-05T08:00:00.000Z', sv: 1 })).bytes;

  beforeEach(async () => {
    db = await openBaseDb(DEVICE, '2026-10-05T08:00:00.000Z');
    files = createMemoryFiles();
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it('exporter : enregistre spartiate-export-<date>.zip avec les données locales et confirme', async () => {
    await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-10-05' as LocalDate, kg: 82.1, timezone: 'Europe/Paris' }, '2026-10-05' as LocalDate);
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Exporter mes données' }));
    await waitFor(() => expect(files.saved).toHaveLength(1));
    expect(files.saved[0]).toMatchObject({ suggestedName: 'spartiate-export-2026-10-05.zip', mime: 'application/zip' });
    expect(await screen.findByRole('status')).toHaveTextContent('Archive enregistrée');
  });

  it('exporter : une erreur d’écriture est visible (alerte) et rien n’est annoncé comme enregistré', async () => {
    files.failNext('write-failed');
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Exporter mes données' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('L’archive n’a pas pu être enregistrée');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('importer : l’aperçu décrit ajouts, modifications et suppressions AVANT toute écriture', async () => {
    files.setPickBytes({ name: 'spartiate-export.zip', bytes: await archive() });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir une archive…' }));
    const preview = await screen.findByRole('region', { name: 'Aperçu de l’import' });
    expect(within(preview).getByText('Ajouts : 4')).toBeInTheDocument();
    expect(within(preview).getByText('Modifications : 0')).toBeInTheDocument();
    expect(within(preview).getByText('Suppressions : 0')).toBeInTheDocument();
    expect(await db.driver.select('SELECT 1 FROM body_weight')).toEqual([]);
    expect(await db.driver.select('SELECT 1 FROM profile')).toEqual([]);
  });

  it('importer en fusion : écrit profil, pesées et thème, puis annonce le résultat', async () => {
    files.setPickBytes({ name: 'spartiate-export.zip', bytes: await archive() });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir une archive…' }));
    await screen.findByRole('region', { name: 'Aperçu de l’import' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’import' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Import terminé');
    expect(await db.driver.select('SELECT id FROM body_weight ORDER BY id')).toHaveLength(2);
    expect(await db.driver.select('SELECT birth_year FROM profile')).toEqual([{ birth_year: 1990 }]);
    expect(await db.data.repos.settings.get('ui.theme')).toBe('light');
    expect(screen.queryByRole('region', { name: 'Aperçu de l’import' })).toBeNull();
  });

  it('remplacer : l’aperçu annonce les suppressions des lignes locales absentes de l’archive', async () => {
    await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-09-01' as LocalDate, kg: 90, timezone: 'Europe/Paris' }, '2026-10-05' as LocalDate);
    files.setPickBytes({ name: 'spartiate-export.zip', bytes: await archive() });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir une archive…' }));
    const preview = await screen.findByRole('region', { name: 'Aperçu de l’import' });
    expect(within(preview).getByText('Suppressions : 0')).toBeInTheDocument();
    fireEvent.click(within(preview).getByRole('radio', { name: 'Remplacer' }));
    expect(within(preview).getByText('Suppressions : 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’import' }));
    await screen.findByRole('status');
    expect(await db.driver.select("SELECT deleted_at IS NOT NULL AS d FROM body_weight WHERE id = 'weight|2026-09-01|manual'")).toEqual([{ d: 1 }]);
  });

  it('archive corrompue ou d’une version future : refus visible en français, base intacte', async () => {
    const bad = (await archive()).slice();
    bad[bad.indexOf(0x7b) + 2] = (bad[bad.indexOf(0x7b) + 2] ?? 0) ^ 0x55;
    files.setPickBytes({ name: 'x.zip', bytes: bad });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir une archive…' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Archive refusée');
    expect(screen.queryByRole('region', { name: 'Aperçu de l’import' })).toBeNull();
    expect(await db.driver.select('SELECT 1 FROM body_weight')).toEqual([]);
  });

  it('RESET-01 (D-187) : archive faite avant « Repartir de zéro » : refusée avant l’aperçu, rien n’est réécrit ; une archive d’après s’importe', async () => {
    db.clock.advance(60_000);
    const { resetAllData } = await import('../../sync/dataReset');
    const { SYNC_CATALOGUE } = await import('../../domain/sync/syncTables');
    const { createMemorySyncLogger } = await import('../../sync/log');
    expect((await resetAllData(db.data, SYNC_CATALOGUE, createMemorySyncLogger())).kind).toBe('done');
    files.setPickBytes({ name: 'spartiate-export.zip', bytes: await archive() }); // datée du 5 octobre, avant la remise à zéro
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir une archive…' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Archive refusée : elle date d’avant « Repartir de zéro ».');
    expect(screen.queryByRole('region', { name: 'Aperçu de l’import' })).toBeNull();
    expect(await db.driver.select('SELECT 1 FROM body_weight')).toEqual([]);
    cleanup();
    db.clock.advance(60_000);
    const later = (await buildExportArchive(DATA, { date: new Date(db.clock.nowMs()).toISOString(), sv: 1 })).bytes;
    files.setPickBytes({ name: 'spartiate-export.zip', bytes: later });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir une archive…' }));
    expect(await screen.findByRole('region', { name: 'Aperçu de l’import' })).toBeTruthy();
  });

  it('annuler la boîte de choix ne change rien', async () => {
    files.setPick(null);
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir une archive…' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.queryByRole('region', { name: 'Aperçu de l’import' })).toBeNull();
  });
});
