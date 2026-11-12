import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { IMPORT_ZIP_LIMITS } from '../../domain/exportImport/archive';
import { readZip } from '../../domain/exportImport/zip';
import type { DeviceId, LocalDate } from '../../domain/types';
import { createMemoryFiles, type MemoryFiles } from '../../platform/files';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { ExportImportScreen } from './ExportImportScreen';

/**
 * I6-03 : « Export complet (CSV et JSON) » dans Plus › Export et import, à côté de l'export habituel (inchangé) : archive zip enregistrée par le service
 * de fichiers, annoncée en texte ; une erreur d'écriture est une alerte.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e7' as DeviceId;
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
beforeEach(async () => {
  db = await openBaseDb(DEVICE, '2026-10-05T08:00:00.000Z');
  files = createMemoryFiles();
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Plus › Export complet', () => {
  it('enregistre spartiate-export-complet-<date>.zip (CSV sous csv/, contenu.json, data.json) et confirme ; l’export habituel reste proposé', async () => {
    await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-10-05' as LocalDate, kg: 82.1, timezone: 'Europe/Paris' }, '2026-10-05' as LocalDate);
    open();
    expect(await screen.findByRole('button', { name: 'Exporter mes données' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Export complet (CSV et JSON)' }));
    await waitFor(() => expect(files.saved).toHaveLength(1));
    expect(files.saved[0]).toMatchObject({ suggestedName: 'spartiate-export-complet-2026-10-05.zip', mime: 'application/zip' });
    const names = readZip(files.saved[0]?.data as Uint8Array, IMPORT_ZIP_LIMITS).map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['manifest.json', 'contenu.json', 'data.json', 'csv/body_weight.csv', 'csv/workout_set.csv', 'csv/measurement.csv']));
    expect(names.some((n) => /photo_file|\.jpe?g$/i.test(n))).toBe(false);
    expect(await screen.findByRole('status')).toHaveTextContent('Archive complète enregistrée');
  });

  it('une erreur d’écriture est visible (alerte), rien n’est annoncé comme enregistré', async () => {
    files.failNext('write-failed');
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Export complet (CSV et JSON)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('n’a pas pu être enregistrée');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
