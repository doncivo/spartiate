import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tTraining } from '../../i18n/trainingText';
import { PC_MEDIA_QUERY } from '../../ui/useLayout';
import { ExerciseList } from './LibraryView';
import { readTrainingData, type TrainingData } from './trainingState';

/**
 * Revue à froid de COQUILLE-PC : la liste d'exercices sert aussi de sélecteur (routine, séance, remplacement). Son menu contextuel dit
 * l'action réelle : « Ouvrir » dans la bibliothèque, « Choisir » dans un sélecteur (même action que le clic). Données synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000f7' as DeviceId;
let db: TestDb;
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

async function list(mode: 'library' | 'picker', onSelect = vi.fn()): Promise<void> {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === PC_MEDIA_QUERY, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  db = await openBaseDb(DEVICE, '2026-11-21T08:00:00.000Z');
  const data: TrainingData = await readTrainingData(db.data);
  render(<ExerciseList data={data} mode={mode} onSelect={onSelect} />);
  await waitFor(() => expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0));
}

describe('ExerciseList : libellé du menu contextuel selon l’usage', () => {
  it('sélecteur : « Choisir », jamais « Ouvrir »', async () => {
    const onSelect = vi.fn();
    await list('picker', onSelect);
    const row = within(screen.getAllByRole('listitem')[0] as HTMLElement).getByRole('button');
    fireEvent.contextMenu(row);
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual([tTraining('chooseItem')]);
    fireEvent.click(items[0] as HTMLElement);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('bibliothèque : « Ouvrir »', async () => {
    await list('library');
    fireEvent.contextMenu(within(screen.getAllByRole('listitem')[0] as HTMLElement).getByRole('button'));
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([tTraining('openItem')]);
  });
});
