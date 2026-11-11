import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import type { HealthKit } from '../../platform/healthkit';
import { ShortcutFolderError, type ShortcutFileRead, type ShortcutFilesReader } from '../../platform/shortcutFiles';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { AppleHealthScreen } from './AppleHealthScreen';

vi.mock('../../platform/desktop/log', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), logFailure: vi.fn() }));

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-000000000012');
const healthKit: HealthKit = {
  availability: vi.fn(async () => 'available' as const),
  requestAuthorization: vi.fn(async () => 'unknown' as const),
  bodyMassToday: vi.fn(async () => ({ state: 'empty' as const })),
  stepCountToday: vi.fn(async () => ({ state: 'empty' as const })),
  diagnostic: vi.fn(async () => ({ available: true, usageDescription: true, error: null })),
};

const HRV = '2026-10-01T03:12:00+01:00;48,5;ms\n2026-10-01T03:20:00;50\nabc;1\n';
const reads = (hrv: ShortcutFileRead): ShortcutFileRead[] => [
  hrv,
  { name: 'fc-repos.csv', state: 'absent' },
  { name: 'sommeil.csv', state: 'absent' },
  { name: 'pas.csv', state: 'absent' },
];
const pickerReader = (plan: () => ShortcutFileRead[] | null): ShortcutFilesReader => ({ kind: 'picker', automatic: false, read: async () => plan() });
const folderReader = (plan: () => ShortcutFileRead[] | null): ShortcutFilesReader => ({ kind: 'folder', automatic: true, read: async () => plan() });

describe('Apple Santé : section « Raccourcis » (I5-01 point 1.7)', () => {
  let db: TestDb;
  let container: AppContainer;
  const build = (platform: AppContainer['platform']): AppContainer =>
    createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform });
  const renderScreen = (reader: ShortcutFilesReader, fallback?: ShortcutFilesReader) =>
    render(
      <AppContainerProvider container={container}>
        <AppleHealthScreen healthKit={healthKit} shortcutReader={reader} {...(fallback ? { shortcutFallback: fallback } : {})} />
      </AppContainerProvider>,
    );

  beforeEach(async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    db = await openBaseDb(DEVICE, '2026-10-01T10:00:00.000Z');
    container = build({ runtime: 'tauri', os: 'ios' });
  });
  afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    useNavigationStore.setState(INITIAL_NAVIGATION);
    await db.close();
  });

  const section = async () => within(await screen.findByRole('region', { name: 'Récupération depuis Raccourcis' }));

  it('jamais importé : chaque type l’annonce, boutons « Importer maintenant » et « Choisir les fichiers », chemin iCloud Drive › Spartiate › sante', async () => {
    renderScreen(folderReader(() => null), pickerReader(() => null));
    const s = await section();
    expect(await s.findAllByText('Jamais importé.')).toHaveLength(4);
    expect(s.getByRole('button', { name: 'Importer maintenant' })).toBeEnabled();
    expect(s.getByRole('button', { name: 'Choisir les fichiers' })).toBeEnabled();
    expect(s.getByText(/iCloud Drive › Spartiate › sante/)).toBeInTheDocument();
    expect(screen.queryByText(/Spartiate-sante/)).toBeNull();
    expect(s.getByText(/docs\/guide-raccourcis-sante\.md/)).toBeInTheDocument();
  });

  it('importé : date du dernier import par type, comptes et rejets PAR RAISON sans aucune valeur ; absent clairement dit', async () => {
    renderScreen(folderReader(() => reads({ name: 'hrv.csv', state: 'ok', text: HRV })), pickerReader(() => null));
    const s = await section();
    fireEvent.click(await s.findByRole('button', { name: 'Importer maintenant' }));
    await waitFor(() => expect(s.getByText(/Dernier import : 01\/10\/2026 à 1\d:00\./)).toBeInTheDocument());
    expect(s.getByText('1 ajoutées · 0 déjà connues · 2 refusées.')).toBeInTheDocument();
    expect(s.getByText('date sans fuseau horaire : 1')).toBeInTheDocument();
    expect(s.getByText('date illisible : 1')).toBeInTheDocument();
    expect(s.getAllByText('Fichier absent : rien n’a été lu pour ce type.')).toHaveLength(3);
    expect(screen.queryByText(/48/)).toBeNull();
  });

  it('I5-05 point 4 : après un import par le sélecteur, une lecture automatique sans fichier ne contredit pas les comptes : « non trouvé à la lecture automatique de HH:MM »', async () => {
    renderScreen(folderReader(() => reads({ name: 'hrv.csv', state: 'absent' })), pickerReader(() => reads({ name: 'hrv.csv', state: 'ok', text: HRV })));
    const s = await section();
    fireEvent.click(await s.findByRole('button', { name: 'Choisir les fichiers' }));
    await waitFor(() => expect(s.getByText('1 ajoutées · 0 déjà connues · 2 refusées.')).toBeInTheDocument());
    // Le sélecteur n'a pas fourni les trois autres types : dit pour ce qu'il est, pas « fichier absent ».
    expect(s.getAllByText(/Absent des fichiers choisis à \d{2}:\d{2}\./)).toHaveLength(3);
    fireEvent.click(await s.findByRole('button', { name: 'Importer maintenant' }));
    await waitFor(() => expect(s.getByText(/Non trouvé à la lecture du dossier de \d{2}:\d{2}\./)).toBeInTheDocument());
    // Jamais « Fichier absent » au-dessus de comptes d'un import réussi ; les types sans import précédent gardent la phrase d'origine.
    expect(s.getAllByText('Fichier absent : rien n’a été lu pour ce type.')).toHaveLength(3);
    expect(s.getByText('1 ajoutées · 0 déjà connues · 2 refusées.')).toBeInTheDocument();
  });

  it('I5-05 point 4 : une lecture qui a abouti pour ce type efface toute phrase d’absence', async () => {
    let ok = false;
    renderScreen(
      folderReader(() => reads(ok ? { name: 'hrv.csv', state: 'ok', text: HRV } : { name: 'hrv.csv', state: 'absent' })),
      pickerReader(() => null),
    );
    const s = await section();
    fireEvent.click(await s.findByRole('button', { name: 'Importer maintenant' }));
    await waitFor(() => expect(s.getAllByText('Fichier absent : rien n’a été lu pour ce type.')).toHaveLength(4));
    ok = true;
    fireEvent.click(await s.findByRole('button', { name: 'Importer maintenant' }));
    await waitFor(() => expect(s.getByText('1 ajoutées · 0 déjà connues · 2 refusées.')).toBeInTheDocument());
    expect(s.getAllByText('Fichier absent : rien n’a été lu pour ce type.')).toHaveLength(3);
  });

  it('secours : « Choisir les fichiers » ouvre le sélecteur, jamais le dossier ; annulé : message sobre, rien d’importé', async () => {
    const folder = folderReader(() => reads({ name: 'hrv.csv', state: 'ok', text: HRV }));
    const readFolder = vi.spyOn(folder, 'read');
    renderScreen(folder, pickerReader(() => null));
    const s = await section();
    fireEvent.click(await s.findByRole('button', { name: 'Choisir les fichiers' }));
    expect(await s.findByText('Aucun fichier choisi.')).toBeInTheDocument();
    expect(s.getAllByText('Jamais importé.')).toHaveLength(4);
    expect(readFolder).not.toHaveBeenCalled();
  });

  it('dossier de synchro non lié : phrase claire (lier le dossier ou choisir les fichiers), pas de faux « importé »', async () => {
    const folder: ShortcutFilesReader = {
      kind: 'folder',
      automatic: true,
      read: async () => {
        throw new ShortcutFolderError('not-configured');
      },
    };
    renderScreen(folder, pickerReader(() => null));
    const s = await section();
    fireEvent.click(await s.findByRole('button', { name: 'Importer maintenant' }));
    expect(await s.findByText(/Plus › Appareils et synchro/)).toBeInTheDocument();
    expect(s.getAllByText('Jamais importé.')).toHaveLength(4);
  });

  it('dossier lu mais vide : chaque type « fichier absent », la consigne dit où le raccourci doit écrire', async () => {
    renderScreen(folderReader(() => reads({ name: 'hrv.csv', state: 'absent' })), pickerReader(() => null));
    const s = await section();
    fireEvent.click(await s.findByRole('button', { name: 'Importer maintenant' }));
    await waitFor(() => expect(s.getAllByText('Fichier absent : rien n’a été lu pour ce type.')).toHaveLength(4));
  });

  it('I5-04 : dossier lu, aucun fichier trouvé : l’appui le dit près du bouton, à chaque appui', async () => {
    renderScreen(folderReader(() => reads({ name: 'hrv.csv', state: 'absent' })), pickerReader(() => null));
    const s = await section();
    const button = await s.findByRole('button', { name: 'Importer maintenant' });
    fireEvent.click(button);
    expect(await s.findByText(/Aucun des quatre fichiers n’a été trouvé dans iCloud Drive › Spartiate › sante/)).toBeInTheDocument();
    fireEvent.click(button);
    expect(await s.findByRole('status')).toHaveTextContent(/Aucun des quatre fichiers/);
  });

  it('I5-04 : lecteur non pris en charge sur l’iPhone : phrase « unsupported » au lieu du silence', async () => {
    renderScreen({ kind: 'unsupported', automatic: false, read: async () => null });
    const s = await section();
    fireEvent.click(await s.findByRole('button', { name: 'Importer maintenant' }));
    expect(await s.findByRole('status')).toHaveTextContent(/iPhone/);
  });

  it('I5-04 : un import réussi annonce les fichiers lus et les lignes ajoutées', async () => {
    renderScreen(folderReader(() => reads({ name: 'hrv.csv', state: 'ok', text: HRV })), pickerReader(() => null));
    const s = await section();
    fireEvent.click(await s.findByRole('button', { name: 'Importer maintenant' }));
    expect(await s.findByRole('status')).toHaveTextContent(/1 fichier lu/);
  });

  it('I5-04 : « Importer maintenant » n’est jamais soumis à l’intervalle de 30 minutes', async () => {
    const folder = folderReader(() => reads({ name: 'hrv.csv', state: 'ok', text: HRV }));
    const read = vi.spyOn(folder, 'read');
    renderScreen(folder, pickerReader(() => null));
    const s = await section();
    const button = await s.findByRole('button', { name: 'Importer maintenant' });
    fireEvent.click(button);
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  });

  it('PC : seule la phrase « lus sur l’iPhone », aucun bouton', async () => {
    container = build({ runtime: 'tauri', os: 'windows' });
    renderScreen({ kind: 'unsupported', automatic: false, read: async () => null });
    const s = await section();
    expect(s.getByText('Les fichiers Raccourcis sont lus sur l’iPhone ; le PC reçoit les résumés par la synchro.')).toBeInTheDocument();
    expect(s.queryByRole('button')).toBeNull();
  });
});
