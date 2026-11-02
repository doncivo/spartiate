import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabRail, type TabRailItem } from './TabRail';

const items: TabRailItem[] = [
  { id: 'today', labelKey: 'nav.tabs.today' },
  { id: 'training', labelKey: 'nav.tabs.training' },
];
const settingsItem: TabRailItem = { id: 'more', labelKey: 'nav.tabs.more' };

describe('TabRail', () => {
  it('marque l’onglet actif avec aria-current', () => {
    render(<TabRail items={items} settingsItem={settingsItem} activeId="training" onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Entraînement' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Aujourd’hui' })).not.toHaveAttribute('aria-current');
  });

  it('place Réglages à part (dernier onglet)', () => {
    render(<TabRail items={items} settingsItem={settingsItem} activeId="today" onSelect={() => undefined} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.at(-1)).toHaveTextContent('Plus');
  });

  it('appelle onSelect au clic', () => {
    const onSelect = vi.fn();
    render(<TabRail items={items} settingsItem={settingsItem} activeId="today" onSelect={onSelect} />);
    screen.getByRole('button', { name: 'Entraînement' }).click();
    expect(onSelect).toHaveBeenCalledWith('training');
  });

  it('se déplace au clavier avec les flèches', () => {
    render(<TabRail items={items} settingsItem={settingsItem} activeId="today" onSelect={() => undefined} />);
    const tasks = screen.getByRole('button', { name: 'Aujourd’hui' });
    tasks.focus();
    tasks.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(screen.getByRole('button', { name: 'Entraînement' })).toHaveFocus();
  });

  it('porte un nom de navigation accessible', () => {
    render(<TabRail items={items} settingsItem={settingsItem} activeId="today" onSelect={() => undefined} />);
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
  });
});
