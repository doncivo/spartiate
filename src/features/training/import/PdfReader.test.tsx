import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { tImport } from '../../../i18n/programImportText';
import { tPdfImport } from '../../../i18n/pdfImportText';
import { tTraining } from '../../../i18n/trainingText';
import type { FakePdfHook } from '../../../platform/pdf/testing';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../../app/navigation';
import { TrainingScreen } from '../TrainingScreen';

/**
 * IMPORT-0303 (D-676) : « Lire un PDF » dans l'import de programme. Lecteur chargé à la demande depuis la vue d'import ; façade remplacée
 * par son faux (`__CT_FAKE_PDF__`, comme l'OCR). Le texte lu rejoint la zone de texte et passe par le même analyseur qu'un collage ;
 * chaque refus est dit à l'écran, texte inchangé. Programme inventé.
 */
const DEVICE = '60000000-0000-4000-8000-000000030301' as DeviceId;
const setHook = (hook: FakePdfHook | undefined): void => {
  (globalThis as Record<string, unknown>)['__CT_FAKE_PDF__'] = hook;
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
async function choosePdf(size?: number): Promise<void> {
  const input = await screen.findByLabelText(tPdfImport('pdf'));
  const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])], 'programme.pdf', { type: 'application/pdf' });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeAll(async () => {
  await Promise.all([import('../TrainingScreen'), import('./ProgramImportView'), import('./PdfReader')]);
}, 60_000);
beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-27T09:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  setHook(undefined);
  await db.close();
});

describe('IMPORT-0303 : programme lu dans un PDF', () => {
  it('Given un PDF texte, When il est lu, Then ses lignes remplissent le texte puis le même analyseur donne l’aperçu', async () => {
    const hook: FakePdfHook = { result: { pages: [['Jour A — Haut', 'Squat à la barre 4×8-10 RIR 2'], ['Jour B — Bas', 'Fente bulgare 3×10']] }, calls: [] };
    setHook(hook);
    await openImport();
    await choosePdf();
    await screen.findByText(tPdfImport('pdfDone', { n: 4, pages: 2 }));
    expect(textArea().value).toBe('Jour A — Haut\nSquat à la barre 4×8-10 RIR 2\nJour B — Bas\nFente bulgare 3×10');
    expect(hook.calls).toEqual([{ size: 8 }]);
    fireEvent.click(screen.getByRole('button', { name: tImport('analyze') }));
    await screen.findByRole('heading', { name: tImport('previewTitle') });
    expect(screen.getByRole('heading', { name: 'Jour A — Haut' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Jour B — Bas' })).toBeTruthy();
  });

  it('Given un texte déjà collé, Then les lignes du PDF s’y ajoutent', async () => {
    setHook({ result: { pages: [['Curl marteau 3 x 12', 'Gainage 3×30 s', 'Rowing 4×10']] }, calls: [] });
    await openImport();
    fireEvent.change(textArea(), { target: { value: 'Squat 3x5\n' } });
    await choosePdf();
    await screen.findByText(tPdfImport('pdfDone', { n: 3, pages: 1 }));
    expect(textArea().value).toBe('Squat 3x5\nCurl marteau 3 x 12\nGainage 3×30 s\nRowing 4×10');
  });

  it.each([
    ['encrypted', 'pdf_encrypted'],
    ['too-many-pages', 'pdf_too-many-pages'],
    ['invalid', 'pdf_invalid'],
    ['no-text', 'pdf_no-text'],
    ['unsupported', 'pdf_unsupported'],
    ['too-large', 'pdf_too-large'],
  ] as const)('Given un refus « %s », Then il est dit à l’écran et le texte ne change pas', async (reason, key) => {
    setHook({ result: { reason }, calls: [] });
    await openImport();
    fireEvent.change(textArea(), { target: { value: 'Squat 3x5' } });
    await choosePdf();
    await screen.findByText(tPdfImport(key));
    expect(textArea().value).toBe('Squat 3x5');
  });

  it('Given un PDF scanné, Then la consigne « fais une capture de la page et lis-la comme une photo »', () => {
    expect(tPdfImport('pdf_no-text')).toContain('Fais une capture de la page et lis-la comme une photo');
  });

  it('Given un fichier de plus de 10 Mo, Then refusé avant toute lecture (octets jamais lus)', async () => {
    const hook: FakePdfHook = { result: { pages: [['Squat 4×8']] }, calls: [] };
    setHook(hook);
    await openImport();
    await choosePdf(10 * 1024 * 1024 + 1);
    await screen.findByText(tPdfImport('pdf_too-large'));
    expect(hook.calls).toEqual([]);
    expect(textArea().value).toBe('');
  });

  it('Given le navigateur sans OCR, Then « Lire un PDF » est proposé et l’ancien refus du PDF a disparu', async () => {
    await openImport();
    const input = await screen.findByLabelText(tPdfImport('pdf'));
    expect(input.getAttribute('accept')).toBe('application/pdf,.pdf');
    expect(screen.queryByText(/PDF : pas encore lu/)).toBeNull();
    await waitFor(() => expect(screen.getByText(tPdfImport('pdfPrivacy'))).toBeTruthy());
  });
});
