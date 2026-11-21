import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tImport } from '../../../i18n/programImportText';
import { tTraining } from '../../../i18n/trainingText';
import { OCR_COLUMNS } from '../../../../tests/fixtures/training/programImport';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * IMPORT-029b (§ 17.4, D-200) : photo ou capture d'un programme lue par la façade OCR existante (`src/platform/ocr` : Vision sur l'iPhone,
 * Windows.Media.Ocr sur le PC), puis le même analyseur de lignes. Moteur remplacé par le faux de la façade (`__CT_FAKE_OCR__`, comme l'e2e) ;
 * image synthétique, jamais enregistrée. Sans moteur (navigateur) : « disponible sur iPhone et sur PC ».
 */
const DEVICE = '60000000-0000-4000-8000-0000000029b1' as DeviceId;
type Hook = { readonly vision?: { readonly lines?: readonly { text: string; confidence?: number }[]; readonly failure?: string; readonly unavailable?: string }; readonly lines?: readonly { text: string }[] };
const setHook = (hook: Hook | undefined): void => {
  (globalThis as Record<string, unknown>)['__CT_FAKE_OCR__'] = hook;
};

let db: TestDb;
const container = () => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
async function openImport(): Promise<void> {
  act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: 'routines' } as Route));
  render(
    <AppContainerProvider container={container()}>
      <TrainingScreen session={{ os: 'other' }} />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: tTraining('importProgram') }));
  await screen.findByRole('heading', { name: tImport('title') });
}
const textArea = (): HTMLTextAreaElement => screen.getByLabelText(tImport('textLabel'));
function choosePhoto(): void {
  const input = screen.getByLabelText(tImport('photo'));
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'programme.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeAll(async () => {
  await Promise.all([import('../TrainingScreen'), import('./ProgramImportView')]);
}, 60_000);
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  // jsdom n'a pas de décodeur d'image : la réduction est sautée (image transmise telle quelle), comme un format illisible par le canevas.
  vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('jsdom')));
  db = await openBaseDb(DEVICE, '2026-11-21T09:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  setHook(undefined);
  vi.unstubAllGlobals();
  await db.close();
});

describe('IMPORT-029b : photo ou capture lue par l’OCR natif', () => {
  it('les lignes lues remplissent le texte (modifiable), puis le même analyseur donne l’aperçu', async () => {
    setHook({ vision: { lines: OCR_COLUMNS.split('\n').map((text) => ({ text, confidence: 90 })) } });
    await openImport();
    choosePhoto();
    await screen.findByText(tImport('photoDone', { n: 9 }));
    expect(textArea().value).toBe(OCR_COLUMNS);
    fireEvent.click(screen.getByRole('button', { name: tImport('analyze') }));
    await screen.findByRole('heading', { name: tImport('previewTitle') });
    expect(screen.getByRole('heading', { name: 'Séance 1' })).toBeTruthy();
    for (const name of ['Squat à la barre', 'Presse à cuisses', 'Fente bulgare']) {
      expect(within(screen.getByRole('group', { name: tImport('exerciseGroup', { name }) })).getByText(tImport('levelSure'))).toBeTruthy();
    }
    // Aucune ligne non reconnue.
    const rejectedPrefix = tImport('rejectedTitle', { n: '' }).trim();
    expect(screen.queryByRole('heading', { name: (name) => name.startsWith(rejectedPrefix) })).toBeNull();
  });

  it('lecture qui échoue : raison dite, texte inchangé', async () => {
    setHook({ vision: { failure: 'timeout' } });
    await openImport();
    fireEvent.change(textArea(), { target: { value: 'Squat 3x5' } });
    choosePhoto();
    await screen.findByText(tImport('photoFailed', { reason: tImport('ocr_timeout') }));
    expect(textArea().value).toBe('Squat 3x5');
  });

  it('image sans texte : dit, texte inchangé', async () => {
    setHook({ vision: { lines: [] } });
    await openImport();
    choosePhoto();
    await screen.findByText(tImport('photoNone'));
    expect(textArea().value).toBe('');
  });

  it('français absent du moteur : dit, rien n’est lu', async () => {
    setHook({ vision: { unavailable: 'language-missing' } });
    await openImport();
    choosePhoto();
    await screen.findByText(tImport('photoLanguage'));
    expect(textArea().value).toBe('');
  });

  it('les lignes lues s’ajoutent à un texte déjà collé', async () => {
    setHook({ vision: { lines: [{ text: 'Curl marteau 3 x 12' }] } });
    await openImport();
    fireEvent.change(textArea(), { target: { value: 'Squat 3x5\n' } });
    choosePhoto();
    await screen.findByText(tImport('photoDoneOne', { n: 1 }));
    expect(textArea().value).toBe('Squat 3x5\nCurl marteau 3 x 12');
  });

  it('sans moteur de lecture (navigateur) : « disponible sur iPhone et sur PC », PDF reporté, collage toujours possible', async () => {
    await openImport();
    await waitFor(() => expect(screen.getByText(tImport('photoUnavailable'))).toBeTruthy());
    expect(screen.queryByLabelText(tImport('photo'))).toBeNull();
    expect(screen.getByText(tImport('pdfLater'))).toBeTruthy();
    expect(screen.getByRole('button', { name: tImport('analyze') })).toBeTruthy();
  });
});
