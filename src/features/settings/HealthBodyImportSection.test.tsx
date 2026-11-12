import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { BODY_FILE_NAMES, type BodyFileName } from '../../domain/health/bodyShortcutFiles';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { ShortcutFolderError, type ShortcutFileRead, type ShortcutFilesReader } from '../../platform/shortcutFiles';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { HealthBodyImportSection } from './HealthBodyImportSection';

vi.mock('../../platform/desktop/log', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), logFailure: vi.fn() }));

/** I6-04 : section « Corps et nutrition depuis Raccourcis » de l'écran Apple Santé : comptes et raisons de refus, jamais une valeur. Fixtures synthétiques. */
const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000a5');
const reads = (texts: Partial<Record<BodyFileName, string>>): ShortcutFileRead[] =>
  BODY_FILE_NAMES.map((name) => (texts[name] === undefined ? { name, state: 'absent' } : { name, state: 'ok', text: texts[name] }) as ShortcutFileRead);
const folder = (plan: () => ShortcutFileRead[] | null): ShortcutFilesReader => ({ kind: 'folder', automatic: true, read: async () => plan() });

describe('Apple Santé : section « Corps et nutrition » (I6-04)', () => {
  let db: TestDb;
  let container: AppContainer;
  const build = (platform: AppContainer['platform']): AppContainer => createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform });
  const renderSection = (reader: ShortcutFilesReader, fallback?: ShortcutFilesReader) =>
    render(
      <AppContainerProvider container={container}>
        <HealthBodyImportSection reader={reader} {...(fallback ? { fallback } : {})} />
      </AppContainerProvider>,
    );

  beforeEach(async () => {
    db = await openBaseDb(DEVICE, '2026-11-08T10:00:00.000Z');
    container = build({ runtime: 'tauri', os: 'ios' });
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it('jamais importé : dix lignes « Jamais importé. », la règle nutrition, les deux boutons, le guide', async () => {
    renderSection(folder(() => null));
    expect(await screen.findAllByText('Jamais importé.')).toHaveLength(10);
    expect(screen.getByText(/une seule ligne « Renpho — total du jour »/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importer maintenant' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Choisir les fichiers' })).toBeEnabled();
    expect(screen.getByText(/guide-raccourcis-sante\.md \(partie C\)/)).toBeInTheDocument();
  });

  it('importé : comptes par fichier, refus PAR RAISON, nutrition résumée, aucune valeur affichée, résumé gardé', async () => {
    const text = { 'poids.csv': '2026-11-08T06:50:12+01:00;81,4;kg\n2026-11-08T06:51:12;82;kg\n', 'energie.csv': '2026-11-08T08:00:00+01:00;2300;kcal\n' };
    renderSection(folder(() => reads(text)));
    fireEvent.click(await screen.findByRole('button', { name: 'Importer maintenant' }));
    expect(await screen.findByText(/1 jours lus · 1 ajoutés · 0 mis à jour · 0 inchangés · 1 refusés\./)).toBeInTheDocument();
    expect(screen.getByText('date sans fuseau horaire : 1')).toBeInTheDocument();
    expect(screen.getByText(/1 jours créés · 0 mis à jour/)).toBeInTheDocument();
    expect(screen.getByText('2 fichiers lus.')).toBeInTheDocument();
    expect(screen.getAllByText('Fichier absent : rien n’a été lu pour ce type.')).toHaveLength(8);
    expect(document.body.textContent).not.toMatch(/81[,.]4|2300/);
    expect(await container.data.repos.settings.get('healthBody.lastImport')).toMatchObject({ files: expect.any(Array) });
  });

  it('dossier non lié : phrase dite, rien d’écrit ; secours « Choisir les fichiers » : sélecteur annulé dit', async () => {
    renderSection(
      folder(() => {
        throw new ShortcutFolderError('not-configured');
      }),
      folder(() => null),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Importer maintenant' }));
    expect(await screen.findByText(/Le dossier iCloud Drive › Spartiate n’a pas pu être lu/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choisir les fichiers' }));
    expect(await screen.findByText('Aucun fichier choisi.')).toBeInTheDocument();
  });

  it('PC : une phrase, aucun bouton', async () => {
    container = build({ runtime: 'tauri', os: 'windows' });
    renderSection(folder(() => null));
    const region = within(await screen.findByRole('region', { name: 'Corps et nutrition depuis Raccourcis' }));
    expect(region.getByText(/sont lus sur l’iPhone/)).toBeInTheDocument();
    expect(region.queryByRole('button')).toBeNull();
  });

  it('échec d’écriture gardé : le dernier import « a échoué » est dit à la réouverture, effacé par le prochain succès', async () => {
    await container.data.repos.settings.set('healthBody.lastImport', { at: '2026-11-08T09:00:00.000Z', failed: true, files: [], nutrition: { created: 0, updated: 0, unchanged: 0, superseded: 0, skippedJournal: 0, skippedDeleted: 0, skippedNoEnergy: 0 } });
    renderSection(folder(() => reads({})));
    expect(await screen.findByText(/Le dernier import a échoué/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Importer maintenant' }));
    expect(await screen.findByText(/Aucun des dix fichiers n’a été trouvé/)).toBeInTheDocument();
  });
});
