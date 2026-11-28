import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceId } from '../../../domain/types';
import { tImport } from '../../../i18n/programImportText';
import { tTraining } from '../../../i18n/trainingText';
import type { TestDb } from '../../../db/repositories/sql/testSetup';
// Types seulement (effacés à la compilation) : les modules eux-mêmes sont importés après le simulacre.
import type * as TrainingScreenModule from '../TrainingScreen';
import type * as ContextModule from '../../app/AppContainerContext';
import type * as ContainerModule from '../../app/container';
import type * as NavigationModule from '../../app/navigation';
import type * as HlcModule from '../../../domain/hlc';
import type * as SetupModule from '../../../db/repositories/sql/testSetup';

/**
 * Relecture IMPORT-0303 : le bloc à la demande du lecteur PDF est introuvable (mise à jour partielle, fichier manquant). La vue d'import
 * le dit (`pdfLoadFailed`), et le collage comme la photo restent utilisables. Les modules de l'app sont importés APRÈS le simulacre
 * (`vi.doMock` + `vi.resetModules`) pour que la vue reçoive l'import qui échoue, et tous depuis la même génération de modules.
 */
const DEVICE = '60000000-0000-4000-8000-000000030302' as DeviceId;

type Modules = {
  readonly TrainingScreen: typeof TrainingScreenModule.TrainingScreen;
  readonly AppContainerProvider: typeof ContextModule.AppContainerProvider;
  readonly createAppContainer: typeof ContainerModule.createAppContainer;
  readonly navigation: typeof NavigationModule;
  readonly createHlcClock: typeof HlcModule.createHlcClock;
  readonly openBaseDb: typeof SetupModule.openBaseDb;
};
let mods: Modules;
let db: TestDb;

beforeAll(async () => {
  vi.resetModules();
  vi.doMock('./PdfReader', () => {
    throw new Error('bloc PdfReader introuvable');
  });
  const [screenMod, ctx, container, navigation, hlc, setup] = await Promise.all([
    import('../TrainingScreen'),
    import('../../app/AppContainerContext'),
    import('../../app/container'),
    import('../../app/navigation'),
    import('../../../domain/hlc'),
    import('../../../db/repositories/sql/testSetup'),
    import('./ProgramImportView'),
  ]);
  mods = { TrainingScreen: screenMod.TrainingScreen, AppContainerProvider: ctx.AppContainerProvider, createAppContainer: container.createAppContainer, navigation, createHlcClock: hlc.createHlcClock, openBaseDb: setup.openBaseDb };
}, 60_000);
afterAll(() => {
  vi.doUnmock('./PdfReader');
  vi.resetModules();
});
beforeEach(async () => {
  mods.navigation.useNavigationStore.setState(mods.navigation.INITIAL_NAVIGATION);
  db = await mods.openBaseDb(DEVICE, '2026-11-27T09:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('IMPORT-0303 (relecture) : lecteur PDF impossible à charger', () => {
  it('Given le bloc PdfReader introuvable, Then « La lecture des PDF n’a pas pu se charger », texte et photo toujours là', async () => {
    const { TrainingScreen, AppContainerProvider, createAppContainer, navigation, createHlcClock } = mods;
    act(() => navigation.useNavigationStore.getState().navigate({ tab: 'training', screen: 'routines' } as NavigationModule.Route));
    render(
      <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
        <TrainingScreen session={{ os: 'other' }} />
      </AppContainerProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: tTraining('importProgram') }));
    await screen.findByRole('heading', { name: tImport('title') });
    await screen.findByText(tImport('pdfLoadFailed'));
    expect(screen.getByLabelText(tImport('textLabel'))).toBeTruthy();
    // Navigateur sans OCR : la phrase de la photo reste affichée (le composant photo est monté).
    expect(screen.getByText(tImport('photoUnavailable'))).toBeTruthy();
    expect(screen.getByRole('button', { name: tImport('analyze') })).toBeTruthy();
  });
});
