import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setDesktopLayout, RAIL_FOLD_MAX_WIDTH_PX, RAIL_FOLD_MEDIA_QUERY } from './useLayout';
import { TabRail, type TabRailItem } from './TabRail';

/**
 * C-135 (D-480, D-593), § 18.5 b : sur PC, la barre latérale se replie d'elle-même en icônes quand la place manque ; la disposition ne passe
 * jamais à celle de l'iPhone. Aucun seuil fixe ne change la disposition : seule la largeur de la barre s'adapte.
 */
const items: TabRailItem[] = [
  { id: 'today', labelKey: 'nav.tabs.today' },
  { id: 'training', labelKey: 'nav.tabs.training' },
];
const settingsItem: TabRailItem = { id: 'more', labelKey: 'nav.tabs.more' };
const hints = { today: 'Ctrl 1', training: 'Ctrl 2', more: 'Ctrl 5' };

function viewport(width: number): { fire: () => void } {
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      if (query === RAIL_FOLD_MEDIA_QUERY) return width <= RAIL_FOLD_MAX_WIDTH_PX;
      if (query === '(min-width: 1024px)') return width >= 1024;
      return false;
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
  return { fire: () => listeners.forEach((l) => l()) };
}

const rail = () => render(<TabRail items={items} settingsItem={settingsItem} activeId="today" onSelect={() => undefined} shortcutHints={hints} footer={<p>{'carte'}</p>} />);

describe('TabRail PC : repli automatique en icônes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setDesktopLayout(false);
  });

  it('le seuil de repli est distinct de la rupture de disposition et vaut 1 099 px', () => {
    expect(RAIL_FOLD_MAX_WIDTH_PX).toBe(1099);
    expect(RAIL_FOLD_MEDIA_QUERY).toBe('(max-width: 1099px)');
  });

  it('1 440 px : barre latérale dépliée, bouton de repli présent', () => {
    viewport(1440);
    const { container } = rail();
    const nav = container.querySelector('nav');
    expect(nav).toHaveAttribute('data-layout', 'pc');
    expect(nav).not.toHaveAttribute('data-collapsed');
    expect(screen.getByRole('button', { name: 'Barre latérale' })).toBeInTheDocument();
  });

  it('1 000 px sur un navigateur ou 853 px sur un PC Windows (zoom 150 %) : barre repliée en icônes, jamais la barre basse', () => {
    viewport(853);
    setDesktopLayout(true);
    const { container } = rail();
    const nav = container.querySelector('nav');
    expect(nav).toHaveAttribute('data-layout', 'pc');
    expect(nav).toHaveAttribute('data-collapsed', 'true');
    // Les libellés restent le nom accessible des onglets ; le bouton de repli n'a plus d'effet à montrer.
    expect(screen.getByRole('button', { name: 'Entraînement' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Barre latérale' })).toBeNull();
  });

  it('un redimensionnement replie puis déplie la barre sans remonter la coquille', () => {
    const media = viewport(1440);
    setDesktopLayout(true);
    const { container } = rail();
    const nav = container.querySelector('nav');
    expect(nav).not.toHaveAttribute('data-collapsed');
    viewport(900);
    act(() => media.fire());
    expect(nav).toHaveAttribute('data-collapsed', 'true');
    expect(nav).toHaveAttribute('data-layout', 'pc');
  });

  it('le repli manuel garde son bouton quand la place ne manque pas', () => {
    viewport(1440);
    const { container } = rail();
    fireEvent.click(screen.getByRole('button', { name: 'Barre latérale' }));
    expect(container.querySelector('nav')).toHaveAttribute('data-collapsed', 'true');
  });
});
