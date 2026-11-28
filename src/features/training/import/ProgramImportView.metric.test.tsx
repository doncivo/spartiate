import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, afterEach, describe, expect, it } from 'vitest';
import { uuidGenerator } from '../../../domain/id';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tImport } from '../../../i18n/programImportText';
import { readTrainingData } from '../trainingState';
import { ProgramImportView } from './ProgramImportView';

/** CONTENT-0293 (BL-127) : l'aperçu signale une durée ou des répétitions qui ne vont pas avec la métrique de l'exercice choisi. Programme inventé. */
const DEVICE = '60000000-0000-4000-8000-0000000029c3' as DeviceId;
let db: TestDb;
afterEach(async () => {
  cleanup();
  await db.close();
});

async function preview(text: string): Promise<void> {
  db = await openBaseDb(DEVICE, '2026-11-25T09:00:00.000Z');
  const data = await readTrainingData(db.data);
  render(<ProgramImportView data={data} access={db.data} ids={uuidGenerator} onClose={() => undefined} onCreated={() => Promise.resolve()} />);
  fireEvent.change(screen.getByLabelText(tImport('textLabel')), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: tImport('analyze') }));
  await screen.findByRole('button', { name: tImport('create') });
}

// Relecture IMPORT-0303 (motif FIX-0302b) : la vue importe le lecteur PDF à la demande ; préchauffé ici, jamais à froid pendant une attente.
beforeAll(async () => {
  await import('./PdfReader');
}, 60_000);

describe('CONTENT-0293 : aperçu d’import et métrique de l’exercice choisi', () => {
  it('« Planche 3 x 12 » : exercice chronométré choisi, le texte signale des répétitions enregistrées en secondes', async () => {
    await preview('Jour A\nPlanche 3 x 12');
    expect(screen.getByText(tImport('metric_reps-on-time'))).toBeTruthy();
  });

  it('« Planche 3 x 30 s » : aucune note de métrique', async () => {
    await preview('Jour A\nPlanche 3 x 30 s');
    expect(screen.queryByText(tImport('metric_reps-on-time'))).toBeNull();
    expect(screen.queryByText(tImport('metric_seconds-on-reps'))).toBeNull();
  });

  it('« Marche du fermier 3 x 40 s » : exercice de distance, le texte parle de distance et non de répétitions', async () => {
    await preview('Jour A\nMarche du fermier 3 x 40 s');
    expect(screen.getByText(tImport('metric_seconds-on-distance'))).toBeTruthy();
    expect(screen.queryByText(tImport('metric_seconds-on-reps'))).toBeNull();
  });
});
