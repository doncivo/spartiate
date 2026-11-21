import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidGenerator } from '../../../domain/id';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tImport } from '../../../i18n/programImportText';
import { readTrainingData } from '../trainingState';
import { ProgramImportView } from './ProgramImportView';

/**
 * Revue à froid d'IMPORT-029 : la routine écrite, l'ouverture de l'éditeur échoue (relecture de la liste) : « Créer la routine » reste
 * désactivé, jamais une deuxième routine ; un bloc JSON hostile dit son refus au lieu de ne rien faire. Programme inventé.
 */
const DEVICE = '60000000-0000-4000-8000-0000000029b9' as DeviceId;
let db: TestDb;
afterEach(async () => {
  cleanup();
  await db.close();
});
const routineCount = async (): Promise<number> => (await db.driver.select<{ n: number }>('SELECT COUNT(*) AS n FROM routine WHERE deleted_at IS NULL'))[0]?.n ?? -1;

async function view(onCreated: () => Promise<void>): Promise<void> {
  db = await openBaseDb(DEVICE, '2026-11-21T09:00:00.000Z');
  const data = await readTrainingData(db.data);
  render(<ProgramImportView data={data} access={db.data} ids={uuidGenerator} onClose={() => undefined} onCreated={onCreated} />);
}

describe('IMPORT-029 revue : vue d’import', () => {
  it('routine écrite puis ouverture en échec : création désactivée, une seule routine', async () => {
    await view(() => Promise.reject(new Error('lecture impossible')));
    fireEvent.change(screen.getByLabelText(tImport('textLabel')), { target: { value: 'Jour A\nSquat à la barre 4x6' } });
    fireEvent.click(screen.getByRole('button', { name: tImport('analyze') }));
    const create = await screen.findByRole('button', { name: tImport('create') });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(create);
    await screen.findByText(tImport('created', { name: tImport('defaultName') }));
    expect((screen.getByRole('button', { name: tImport('create') }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: tImport('create') }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await routineCount()).toBe(1);
  });

  it('bloc JSON très profond : l’aperçu montre la ligne refusée, aucune exception perdue', async () => {
    const onCreated = vi.fn(() => Promise.resolve());
    await view(onCreated);
    const deep = `{"sessions":[${'['.repeat(100_000)}${']'.repeat(100_000)}]}`;
    fireEvent.change(screen.getByLabelText(tImport('textLabel')), { target: { value: deep } });
    fireEvent.click(screen.getByRole('button', { name: tImport('analyze') }));
    expect(await screen.findByText(tImport('reason_json-field'), { exact: false })).toBeTruthy();
  });
});
