import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { INITIAL_NAVIGATION, TABS, TAB_IDS, useNavigationStore } from './navigation';
import { SHORTCUTS } from './shortcuts';

describe('navigation (cinq sections fixes, PRD § 18.2)', () => {
  beforeEach(() => useNavigationStore.setState(INITIAL_NAVIGATION));

  it('démarre sur Aujourd’hui et décrit les 5 sections', () => {
    expect(useNavigationStore.getState().route).toEqual({ tab: 'today' });
    expect(TABS.map((tab) => tab.id)).toEqual([...TAB_IDS]);
    expect(TABS.map((tab) => SHORTCUTS[tab.shortcut].keys)).toEqual(['Alt+1', 'Alt+2', 'Alt+3', 'Alt+4', 'Alt+5']);
    expect(TABS.map((tab) => t(tab.labelKey))).toEqual(['Aujourd’hui', 'Entraînement', 'Nutrition', 'Progrès', 'Plus']);
  });

  it('mémorise le dernier écran de chaque section', () => {
    const nav = useNavigationStore.getState();
    nav.navigate({ tab: 'more', screen: 'sync' });
    nav.goToTab('training');
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training' });
    nav.goToTab('more');
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'sync' });
  });

  it('Échap ferme la surcouche du dessus, puis rien', () => {
    const nav = useNavigationStore.getState();
    nav.openOverlay({ kind: 'shortcutsHelp' });
    expect(nav.escape()).toBe(true);
    expect(useNavigationStore.getState().overlays).toEqual([]);
    expect(nav.escape()).toBe(false);
  });
});
