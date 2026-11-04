import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INITIAL_NAVIGATION, TABS, useNavigationStore } from './navigation';
import { createShortcutRegistry, type KeyInput, type ShortcutRegistry } from './shortcuts';
import { registerTabShortcuts } from './tabShortcuts';

const alt = (digit: number, over: Partial<KeyInput> = {}): KeyInput => ({
  key: String(digit),
  code: `Digit${String(digit)}`,
  ctrlKey: true,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  editable: false,
  ...over,
});

describe('raccourcis d’onglets Ctrl+1 à Ctrl+5 (A-04)', () => {
  let registry: ShortcutRegistry;
  let off: () => void;
  let modal = false;

  beforeEach(() => {
    useNavigationStore.setState(INITIAL_NAVIGATION);
    registry = createShortcutRegistry();
    modal = false;
    off = registerTabShortcuts(registry, () => modal);
  });
  afterEach(() => off());

  const tab = () => useNavigationStore.getState().route.tab;

  it('Ctrl+1 à Ctrl+5 activent les cinq sections dans l’ordre (critère 6)', () => {
    for (const [index, definition] of TABS.entries()) {
      expect(registry.handle(alt(index + 1))).toBe(definition.shortcut);
      expect(tab()).toBe(definition.id);
    }
  });

  it('Ctrl+1 revient à Aujourd’hui depuis une autre section (critère 1)', () => {
    useNavigationStore.getState().navigate({ tab: 'more', screen: 'sync' });
    registry.handle(alt(1));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'today' });
  });

  it('fonctionne dans un champ de saisie et sur clavier AZERTY, où Ctrl+1 produit « & » (critère 2)', () => {
    expect(registry.handle(alt(2, { key: 'é', editable: true }))).toBe('app.tab.training');
    expect(tab()).toBe('training');
    expect(registry.handle(alt(1, { key: '&', editable: true }))).toBe('app.tab.today');
    expect(tab()).toBe('today');
  });

  it('ne réagit pas à Ctrl+Alt (AltGr) ni à Alt seul', () => {
    expect(registry.handle(alt(2, { altKey: true }))).toBeNull();
    expect(registry.handle({ ...alt(2, { ctrlKey: false, altKey: true }), code: 'AltLeft', key: 'Alt' })).toBeNull();
    expect(tab()).toBe('today');
  });

  it('ignoré tant qu’une feuille ou une fenêtre modale est ouverte, pour ne pas perdre une saisie (critère 5)', () => {
    modal = true;
    registry.handle(alt(2));
    expect(tab()).toBe('today');
    modal = false;
    registry.handle(alt(2));
    expect(tab()).toBe('training');
  });

  it('retire les raccourcis à la fin', () => {
    off();
    expect(registry.handle(alt(2))).toBeNull();
    expect(registry.activeIds()).toEqual([]);
  });
});
