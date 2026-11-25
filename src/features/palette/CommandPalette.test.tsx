import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { SHORTCUTS, toKeyInput } from '../app/shortcuts';
import { registerShellShortcuts } from '../shortcuts/registerShellShortcuts';
import { CommandPalette } from './CommandPalette';

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000d6');

describe('palette de commandes Ctrl+K (C-135, D-480)', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await openTestDb(DEVICE);
    useNavigationStore.setState({ ...INITIAL_NAVIGATION });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    useNavigationStore.setState({ ...INITIAL_NAVIGATION });
    await db.close();
  });

  it('le registre déclare Ctrl+K', () => {
    expect(SHORTCUTS['app.palette'].keys).toBe('Ctrl+K');
  });

  function mount() {
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
    const off = registerShellShortcuts(container, { help: true });
    const onKey = (event: KeyboardEvent): void => {
      if (container.shortcuts.handle(toKeyInput(event))) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    const view = render(
      <AppContainerProvider container={container}>
        <CommandPalette />
      </AppContainerProvider>,
    );
    return () => {
      window.removeEventListener('keydown', onKey);
      off();
      view.unmount();
    };
  }

  it('Ctrl+K ouvre la palette puis la ferme', async () => {
    const stop = mount();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: 'Palette de commandes' })).toBeInTheDocument();
    expect(useNavigationStore.getState().overlays.at(-1)?.kind).toBe('commandPalette');
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
    expect(useNavigationStore.getState().overlays).toEqual([]);
    stop();
  });

  it('« repas » puis Entrée ouvre l’ajout d’un repas et ferme la palette', async () => {
    const stop = mount();
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
    const input = await screen.findByRole('combobox', { name: 'Chercher une commande' });
    fireEvent.change(input, { target: { value: 'repas' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useNavigationStore.getState().route).toEqual({ tab: 'nutrition', screen: 'journal', meals: true });
    expect(useNavigationStore.getState().overlays).toEqual([]);
    stop();
  });

  it('un clic sur « Démarrer la séance du jour » ouvre l’écran de séance ; Échap ferme sans naviguer', async () => {
    const stop = mount();
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
    fireEvent.click(await screen.findByRole('option', { name: 'Démarrer la séance du jour' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training', screen: 'session' });
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
    const input = await screen.findByRole('combobox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(useNavigationStore.getState().overlays).toEqual([]);
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training', screen: 'session' });
    stop();
  });

  it('flèche bas puis Entrée choisit la deuxième commande ; aucun résultat : message', async () => {
    const stop = mount();
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
    const input = await screen.findByRole('combobox');
    fireEvent.change(input, { target: { value: 'zzzz' } });
    expect(screen.getByRole('status')).toHaveTextContent('Aucune commande ne correspond.');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training' });
    stop();
  });
});
