import { beforeEach, describe, expect, it } from 'vitest';
import { createShortcutRegistry, type KeyInput } from './shortcuts';
import { BODY_TAB_IDS, INITIAL_NAVIGATION, PROGRESS_TAB_IDS, useNavigationStore } from './navigation';
import { registerTabShortcuts } from './tabShortcuts';

/**
 * PROG-0301a (BL-177, D-701, D-719) : onglet et sous-onglet de Progrès retenus en mémoire tant que l'app est ouverte ; un nouvel appui sur
 * Progrès (barre du bas, barre latérale, Ctrl+4 : tous passent par `goToTab`) quand Progrès est affiché ramène à Récup et Corps à Mesures.
 * P-38 : Ctrl+4 ouvre Progrès.
 */
const CTRL_4: KeyInput = { key: '4', code: 'Digit4', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, editable: false };

describe('navigation : vue de Progrès (PROG-0301a, D-719)', () => {
  beforeEach(() => useNavigationStore.setState(INITIAL_NAVIGATION));

  it('6 onglets et 4 sous-onglets de Corps, dans l’ordre d’Ali ; départ sur Récup et Mesures', () => {
    expect([...PROGRESS_TAB_IDS]).toEqual(['recovery', 'sessions', 'review', 'strength', 'body', 'activity']);
    expect([...BODY_TAB_IDS]).toEqual(['measures', 'health', 'visbody', 'photos']);
    expect(useNavigationStore.getState().progressView).toEqual({ tab: 'recovery', body: 'measures' });
  });

  it('revenir sur Progrès depuis une autre section rend l’onglet et le sous-onglet retenus', () => {
    const nav = useNavigationStore.getState();
    nav.goToTab('progress');
    nav.setProgressView({ tab: 'body', body: 'photos' });
    nav.goToTab('training');
    nav.navigate({ tab: 'progress' });
    expect(useNavigationStore.getState().progressView).toEqual({ tab: 'body', body: 'photos' });
    nav.goToTab('more');
    nav.goToTab('progress');
    expect(useNavigationStore.getState().route).toEqual({ tab: 'progress' });
    expect(useNavigationStore.getState().progressView).toEqual({ tab: 'body', body: 'photos' });
  });

  it('nouvel appui sur Progrès déjà affiché : Récup, et Corps revient à Mesures', () => {
    const nav = useNavigationStore.getState();
    nav.goToTab('progress');
    nav.setProgressView({ tab: 'body', body: 'visbody' });
    nav.goToTab('progress');
    expect(useNavigationStore.getState().progressView).toEqual({ tab: 'recovery', body: 'measures' });
  });

  it('changer d’onglet garde le sous-onglet de Corps', () => {
    const nav = useNavigationStore.getState();
    nav.setProgressView({ tab: 'body', body: 'health' });
    nav.setProgressView({ tab: 'activity' });
    expect(useNavigationStore.getState().progressView).toEqual({ tab: 'activity', body: 'health' });
  });

  it('P-38 : Ctrl+4 ouvre Progrès ; Ctrl+4 sur Progrès ramène à Récup', () => {
    const registry = createShortcutRegistry();
    const off = registerTabShortcuts(registry, () => false);
    expect(registry.handle(CTRL_4)).toBe('app.tab.progress');
    expect(useNavigationStore.getState().route).toEqual({ tab: 'progress' });
    useNavigationStore.getState().setProgressView({ tab: 'strength' });
    expect(registry.handle(CTRL_4)).toBe('app.tab.progress');
    expect(useNavigationStore.getState().progressView.tab).toBe('recovery');
    off();
  });

  it('une autre section rappuyée garde son comportement (aucune remise à zéro hors Progrès)', () => {
    const nav = useNavigationStore.getState();
    nav.navigate({ tab: 'more', screen: 'sync' });
    nav.goToTab('more');
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'sync' });
  });
});
