import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setDesktopLayout } from './useLayout';
import { TabRail, type TabRailItem } from './TabRail';

/**
 * C-135 (D-480, D-593, D-596), § 18.5 b : sur PC, la barre latérale se replie d'elle-même en icônes quand la place manque (1 099 px CSS et moins) ;
 * la disposition ne passe jamais à celle de l'iPhone. Le repli est en CSS seulement (le bundle de départ ne grossit pas) : on garde la règle et la
 * disposition PC à toute largeur.
 */
const css = readFileSync('src/ui/TabRail.css', 'utf8');
const items: TabRailItem[] = [
  { id: 'today', labelKey: 'nav.tabs.today' },
  { id: 'training', labelKey: 'nav.tabs.training' },
];
const settingsItem: TabRailItem = { id: 'more', labelKey: 'nav.tabs.more' };
const rail = () => render(<TabRail items={items} settingsItem={settingsItem} activeId="today" onSelect={() => undefined} shortcutHints={{ today: 'Ctrl 1' }} footer={<p>{'carte'}</p>} />);

function foldBlock(): string {
  const start = css.indexOf('@media (max-width: 1099px) {');
  if (start < 0) throw new Error('requête de repli absente');
  return css.slice(start);
}

describe('TabRail PC : repli automatique en icônes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setDesktopLayout(false);
  });

  it('à 1 099 px et moins : barre de 64 px, bouton de repli et carte masqués, libellés lus mais hors de l’écran', () => {
    const block = foldBlock();
    expect(block).toContain('width: 64px');
    expect(block).toMatch(/\.ct-tab-rail__toggle,\s*\.ct-tab-rail\[data-layout='pc'\] \.ct-tab-rail__footer \{\s*display: none/);
    expect(block).toContain('clip: rect(0 0 0 0)');
    expect(block).toContain('.ct-tab-rail__label');
  });

  it('la requête ne change que la barre : aucune règle de disposition (data-layout) n’est conditionnée par une largeur', () => {
    expect(foldBlock()).not.toContain("data-layout='mobile'");
  });

  it('PC Windows à 853 px (zoom 150 %) : toujours la barre latérale (data-layout pc), jamais la barre basse', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    setDesktopLayout(true);
    const { container } = rail();
    expect(container.querySelector('nav')).toHaveAttribute('data-layout', 'pc');
    expect(screen.getByRole('button', { name: 'Entraînement' })).toBeInTheDocument();
  });

  it('le repli manuel reste possible au-dessus du seuil', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(min-width: 1024px)', media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container } = rail();
    fireEvent.click(screen.getByRole('button', { name: 'Barre latérale' }));
    expect(container.querySelector('nav')).toHaveAttribute('data-collapsed', 'true');
  });
});
