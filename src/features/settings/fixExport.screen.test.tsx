import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_ZIP_LIMITS } from '../../domain/exportImport/archive';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId } from '../../domain/types';
import { createMemoryFiles, type MemoryFiles } from '../../platform/files';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { ExportImportScreen } from './ExportImportScreen';

vi.mock('../../domain/exportImport/archive', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  buildExportArchive: () => Promise.resolve({ bytes: new Uint8Array(24 * 1024 * 1024 + 1), fileName: 'spartiate-export-2026-10-05.zip', dataSha256: '' }),
}));
vi.mock('../../domain/exportImport/fullExport', () => ({
  buildFullExport: () => Promise.resolve({ bytes: new Uint8Array(24 * 1024 * 1024 + 1), fileName: 'spartiate-export-complet-2026-10-05.zip', files: [] }),
}));

const DEVICE = '60000000-0000-4000-8000-0000000000e6' as DeviceId;

describe('FIX-EXPORT C-136 : une archive qu’on ne saurait pas réimporter n’est pas enregistrée', () => {
  let db: TestDb;
  let files: MemoryFiles;
  beforeEach(async () => {
    db = await openBaseDb(DEVICE, '2026-10-05T08:00:00.000Z');
    files = createMemoryFiles();
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, files });
    render(
      <AppContainerProvider container={container}>
        <ExportImportScreen />
      </AppContainerProvider>,
    );
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });
  it.each(['Exporter mes données', 'Export complet (CSV et JSON)'])('%s : refus clair, rien d’enregistré', async (name) => {
    expect(IMPORT_ZIP_LIMITS.maxBytes).toBe(24 * 1024 * 1024);
    fireEvent.click(await screen.findByRole('button', { name }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/réimport/i);
    await waitFor(() => expect(screen.getByRole('button', { name })).not.toBeDisabled());
    expect(files.saved).toHaveLength(0);
  });
});
