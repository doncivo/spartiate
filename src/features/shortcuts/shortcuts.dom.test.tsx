import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { createFakeDesktop } from '../../platform/desktop/testing';
import { AppContainerProvider, useAppContainer } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { toKeyInput } from '../app/shortcuts';
import { ShortcutsHelp } from './ShortcutsHelp';
import { ShortcutsSettingsSection } from './ShortcutsSettingsSection';
import { registerEscapeFallback, registerShellShortcuts } from './registerShellShortcuts';

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000d5');
const FIELD_LABEL = 'Champ de saisie';

/** Coquille minimale : Ctrl+/ et Échap branchés comme dans App.tsx. */
function Shell({ children }: { readonly children: React.ReactNode }) {
  const container = useAppContainer();
  useEffect(() => registerEscapeFallback(container), [container]);
  useEffect(() => registerShellShortcuts(container, { help: true }), [container]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (container.shortcuts.handle(toKeyInput(event))) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [container]);
  return (
    <>
      <input aria-label={FIELD_LABEL} />
      {children}
      <ShortcutsHelp />
    </>
  );
}

describe('liste des raccourcis (P-08, D-04)', () => {
  let db: TestDb;
    let container: AppContainer;

  const renderShell = (children: React.ReactNode = null, c: AppContainer = container) =>
    render(
      <AppContainerProvider container={c}>
        <Shell>{children}</Shell>
      </AppContainerProvider>,
    );
  const press = (init: KeyboardEventInit, target: Element | Window = window) => fireEvent.keyDown(target, init);
  const ctrlSlash = (target: Element | Window = window) => press({ key: '/', code: 'Slash', ctrlKey: true }, target);

  beforeEach(async () => {
    db = await openTestDb(DEVICE);
    container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, desktop: createFakeDesktop() });
    useNavigationStore.setState({ ...INITIAL_NAVIGATION });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    useNavigationStore.setState({ ...INITIAL_NAVIGATION });
    await db.close();
  });

  describe('fenêtre « Raccourcis clavier » (P-08)', () => {
    it('Ctrl+/ l’ouvre, même depuis un champ de saisie ; Ctrl+/ de nouveau la ferme et rend le focus (critère 1)', async () => {
      renderShell();
      const field = screen.getByLabelText('Champ de saisie');
      field.focus();
      ctrlSlash(field);
      const dialog = await screen.findByRole('dialog', { name: 'Raccourcis clavier' });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
      ctrlSlash(within(dialog).getByRole('searchbox', { name: 'Filtrer' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(document.activeElement).toBe(field);
    });

    it('Échap et « Fermer » la ferment', async () => {
      renderShell();
      ctrlSlash();
      const dialog = await screen.findByRole('dialog', { name: 'Raccourcis clavier' });
      press({ key: 'Escape', code: 'Escape' }, dialog);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      ctrlSlash();
      fireEvent.click(await screen.findByRole('button', { name: 'Fermer' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('liste les 9 raccourcis du registre, dans un tableau à en-têtes (critères 2 et 9)', async () => {
      renderShell();
      ctrlSlash();
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('table', { name: 'Raccourcis clavier' })).toBeInTheDocument();
      expect(within(dialog).getAllByRole('columnheader').map((h) => h.textContent).slice(0, 2)).toEqual(['Touches', 'Action']);
      expect(within(dialog).getAllByRole('rowgroup').length).toBeGreaterThanOrEqual(1);
      expect(within(dialog).getByText('Application')).toBeInTheDocument();
      expect(dialog.querySelectorAll('[data-shortcut]')).toHaveLength(9);
      const undo = dialog.querySelector('[data-shortcut="app.undo"]');
      expect(undo?.textContent).toContain('Ctrl+Z');
      expect(undo?.textContent).toContain('Contrôle plus Z');
      expect(undo?.textContent).not.toContain('(bientôt)');
    });

    it('le champ « Filtrer » restreint la liste (critère 7)', async () => {
      renderShell();
      ctrlSlash();
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Filtrer' }), { target: { value: 'annuler' } });
      expect(dialog.querySelectorAll('[data-shortcut]')).toHaveLength(1);
      expect(dialog.querySelector('[data-shortcut="app.undo"]')).not.toBeNull();
      fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Filtrer' }), { target: { value: 'zzz' } });
      expect(within(dialog).getByRole('status')).toHaveTextContent('Aucun raccourci ne correspond.');
    });

    it('le focus reste piégé dans la fenêtre (critère 7)', async () => {
      renderShell();
      ctrlSlash();
      const dialog = await screen.findByRole('dialog');
      const close = within(dialog).getByRole('button', { name: 'Fermer' });
      close.focus();
      press({ key: 'Tab', code: 'Tab' }, document.activeElement ?? window);
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  describe('Réglages › CLAVIER', () => {
    it('PC : ligne « Tous les raccourcis » (UI-REFONTE-09) qui ouvre la même fenêtre (P-08 critère 6)', async () => {
      renderShell(<ShortcutsSettingsSection />);
      expect(screen.getByText('CLAVIER')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Afficher les raccourcis clavier' }));
      expect(await screen.findByRole('dialog', { name: 'Raccourcis clavier' })).toBeInTheDocument();
      expect(screen.queryByText('Capture rapide')).not.toBeInTheDocument();
    });
  });

  it('Ctrl+, ouvre Réglages sauf sous une fenêtre modale ; Échap ferme la surcouche du dessus', async () => {
    renderShell();
    act(() => useNavigationStore.getState().navigate({ tab: 'training' }));
    press({ key: ',', code: 'Comma', ctrlKey: true });
    expect(useNavigationStore.getState().route).toMatchObject({ tab: 'more', screen: 'home' });
    ctrlSlash();
    await screen.findByRole('dialog');
    act(() => useNavigationStore.getState().navigate({ tab: 'training' }));
    press({ key: ',', code: 'Comma', ctrlKey: true });
    expect(useNavigationStore.getState().route.tab).toBe('training');
    act(() => useNavigationStore.getState().closeOverlay());
    act(() => useNavigationStore.getState().openOverlay({ kind: 'shortcutsHelp' }));
    press({ key: 'Escape', code: 'Escape' });
    expect(useNavigationStore.getState().overlays).toHaveLength(0);
  });
});
