import { describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { SHORTCUTS, createShortcutRegistry, matchesChord, parseChord, toKeyInput, type KeyInput } from './shortcuts';

const key = (partial: Partial<KeyInput> & Pick<KeyInput, 'key'>): KeyInput => ({
  code: '',
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  editable: false,
  ...partial,
});

describe('combinaisons', () => {
  it('lit la notation', () => {
    expect(parseChord('Ctrl+Shift+D')).toEqual({ key: 'D', ctrl: true, alt: false, shift: true });
    expect(() => parseChord('Cmd+K')).toThrow(SyntaxError);
    expect(() => parseChord('Ctrl+')).toThrow(SyntaxError);
  });

  it('reconnaît Alt+1 sur un clavier AZERTY (touche « & »)', () => {
    expect(matchesChord(parseChord('Alt+1'), key({ key: '&', code: 'Digit1', altKey: true }))).toBe(true);
    expect(matchesChord(parseChord('Alt+1'), key({ key: '1', code: 'Numpad1', altKey: true }))).toBe(true);
    // AltGr (Ctrl+Alt) ne déclenche pas Alt+1.
    expect(matchesChord(parseChord('Alt+1'), key({ key: '~', code: 'Digit2', altKey: true, ctrlKey: true }))).toBe(false);
  });

  it('compare lettres, symboles et touches nommées', () => {
    expect(matchesChord(parseChord('Ctrl+Z'), key({ key: 'z', ctrlKey: true }))).toBe(true);
    expect(matchesChord(parseChord('Ctrl+Shift+D'), key({ key: 'D', ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(matchesChord(parseChord('Ctrl+D'), key({ key: 'D', ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(matchesChord(parseChord('Ctrl+/'), key({ key: '/', ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(matchesChord(parseChord('Space'), key({ key: ' ' }))).toBe(true);
    expect(matchesChord(parseChord('Ctrl+ArrowLeft'), key({ key: 'ArrowLeft', ctrlKey: true }))).toBe(true);
    expect(matchesChord(parseChord('Ctrl+K'), key({ key: 'k', metaKey: true, ctrlKey: true }))).toBe(false);
  });

  it('chaque raccourci a une description traduite', () => {
    for (const def of Object.values(SHORTCUTS)) expect(t(def.descriptionKey)).not.toBe(def.descriptionKey);
  });
});

describe('registre', () => {
  it('appelle le dernier gestionnaire enregistré, puis le précédent', () => {
    const registry = createShortcutRegistry();
    const today = vi.fn();
    const later = vi.fn();
    const alt1 = key({ key: '&', code: 'Digit1', ctrlKey: true });
    registry.register('app.tab.today', today);
    const off = registry.register('app.tab.today', later);
    expect(registry.handle(alt1)).toBe('app.tab.today');
    expect(later).toHaveBeenCalledOnce();
    expect(today).not.toHaveBeenCalled();
    off();
    registry.handle(alt1);
    expect(today).toHaveBeenCalledOnce();
    expect(registry.activeIds()).toEqual(['app.tab.today']);
  });

  it('ignore les raccourcis non éditables (Ctrl+Z) dans un champ de saisie, garde ceux de l’app', () => {
    const registry = createShortcutRegistry();
    const undo = vi.fn();
    const tab = vi.fn();
    registry.register('app.undo', undo);
    registry.register('app.tab.today', tab);
    expect(registry.handle(key({ key: 'z', ctrlKey: true, editable: true }))).toBeNull();
    expect(registry.handle(key({ key: '&', code: 'Digit1', ctrlKey: true, editable: true }))).toBe('app.tab.today');
    expect(undo).not.toHaveBeenCalled();
    expect(tab).toHaveBeenCalledOnce();
  });

  it('ne gère pas une touche sans gestionnaire, et un gestionnaire retiré disparaît des actifs', () => {
    const registry = createShortcutRegistry();
    expect(registry.handle(key({ key: ' ', ctrlKey: true, altKey: true }))).toBeNull();
    expect(registry.handle(key({ key: 'k', ctrlKey: true }))).toBeNull();
    const off = registry.register('app.settings', vi.fn());
    expect(registry.activeIds()).toEqual(['app.settings']);
    off();
    expect(registry.activeIds()).toEqual([]);
    expect(registry.handle(key({ key: ',', ctrlKey: true }))).toBeNull();
  });

  it('AltGr n’est jamais pris pour Ctrl+Alt ni pour Alt (D-04 critère 3, clavier AZERTY)', () => {
    const registry = createShortcutRegistry();
    const tab = vi.fn();
    const help = vi.fn();
    registry.register('app.tab.today', tab);
    registry.register('app.shortcutsHelp', help);
    // AltGr + & = « ~ » en AZERTY : Windows rapporte Ctrl+Alt, le navigateur AltGraph.
    expect(registry.handle(key({ key: '~', code: 'Digit2', ctrlKey: true, altKey: true, altGraph: true }))).toBeNull();
    // AltGr + : donne « / » sur certaines dispositions : ne doit pas ouvrir l’aide (Ctrl+/).
    expect(registry.handle(key({ key: '/', code: 'Slash', ctrlKey: true, altKey: true, altGraph: true }))).toBeNull();
    // Ctrl seul (sans AltGr) reste Ctrl+1, que le caractère soit « & » (AZERTY) ou « 1 » (QWERTY).
    expect(registry.handle(key({ key: '&', code: 'Digit1', ctrlKey: true }))).toBe('app.tab.today');
    expect(registry.handle(key({ key: '1', code: 'Digit1', ctrlKey: true }))).toBe('app.tab.today');
    expect(registry.handle(key({ key: '/', ctrlKey: true }))).toBe('app.shortcutsHelp');
    expect(help).toHaveBeenCalledOnce();
  });

  it('lit AltGr dans l’événement du navigateur', () => {
    const event = { key: 'é', code: 'Digit2', ctrlKey: true, altKey: true, shiftKey: false, metaKey: false, target: null, getModifierState: (m: string) => m === 'AltGraph' };
    expect(toKeyInput(event as unknown as KeyboardEvent).altGraph).toBe(true);
    expect(toKeyInput({ ...event, getModifierState: () => false } as unknown as KeyboardEvent).altGraph).toBe(false);
  });

  it('même effet en AZERTY et en QWERTY : chiffres par `code`, lettres par `key`', () => {
    const registry = createShortcutRegistry();
    const tab = vi.fn();
    const undo = vi.fn();
    registry.register('app.tab.progress', tab);
    registry.register('app.undo', undo);
    // Ctrl+4 : « ' » (AZERTY) ou « 4 » (QWERTY), même touche physique.
    expect(registry.handle(key({ key: "'", code: 'Digit4', ctrlKey: true }))).toBe('app.tab.progress');
    expect(registry.handle(key({ key: '4', code: 'Digit4', ctrlKey: true }))).toBe('app.tab.progress');
    // Ctrl+Z : la lettre produite, quelle que soit la position de la touche (Z est sur KeyW en AZERTY).
    expect(registry.handle(key({ key: 'z', code: 'KeyZ', ctrlKey: true }))).toBe('app.undo');
    expect(registry.handle(key({ key: 'z', code: 'KeyW', ctrlKey: true }))).toBe('app.undo');
    expect(tab).toHaveBeenCalledTimes(2);
    expect(undo).toHaveBeenCalledTimes(2);
  });

  it('un gestionnaire qui décline (false) laisse la main au précédent, puis à l’événement natif', () => {
    const registry = createShortcutRegistry();
    const first = vi.fn();
    const declining = vi.fn(() => false);
    const escape = key({ key: 'Escape' });
    registry.register('app.escape', first);
    registry.register('app.escape', declining);
    expect(registry.handle(escape)).toBe('app.escape');
    expect(declining).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledOnce();
    const alone = createShortcutRegistry();
    alone.register('app.escape', declining);
    expect(alone.handle(escape)).toBeNull();
  });

  it('`only` restreint aux raccourcis cités (fenêtre modale)', () => {
    const registry = createShortcutRegistry();
    const undo = vi.fn();
    const help = vi.fn();
    registry.register('app.undo', undo);
    registry.register('app.shortcutsHelp', help);
    expect(registry.handle(key({ key: 'z', ctrlKey: true }), ['app.shortcutsHelp'])).toBeNull();
    expect(registry.handle(key({ key: '/', ctrlKey: true }), ['app.shortcutsHelp'])).toBe('app.shortcutsHelp');
    expect(undo).not.toHaveBeenCalled();
  });

  it('convertit un événement hors DOM (Node) sans champ éditable', () => {
    const input = toKeyInput({ key: 'k', code: 'KeyK', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, target: null } as unknown as KeyboardEvent);
    expect(input).toMatchObject({ key: 'k', code: 'KeyK', ctrlKey: true, editable: false });
  });
});
