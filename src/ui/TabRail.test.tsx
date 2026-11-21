import { fireEvent, render, screen } from '@testing-library/react';
import { t } from '../i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

/** SPA-009 critères 1 et 3 : barre basse sous 1 024 px (icône et libellé horizontal), barre latérale des maquettes à partir de 1 024 px. */
describe('TabRail : coquilles des maquettes', () => {
  const hints = { today: 'Ctrl 1', training: 'Ctrl 2', more: 'Ctrl 5' };
  const stub = (width: number): void => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(min-width: 1024px)' && width >= 1024, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  };
  afterEach(() => vi.unstubAllGlobals());

  it('iPhone : barre basse, une icône et un libellé par onglet, aucun raccourci ni marque ni carte', () => {
    stub(440);
    const { container } = render(<TabRail items={items} settingsItem={settingsItem} activeId="today" onSelect={() => undefined} shortcutHints={hints} footer={<p>{'carte'}</p>} />);
    expect(container.querySelector('nav')).toHaveAttribute('data-layout', 'mobile');
    expect(container.querySelectorAll('button svg')).toHaveLength(3);
    expect(screen.queryByText('Ctrl 1')).toBeNull();
    expect(screen.queryByText('carte')).toBeNull();
    expect(screen.queryByText('Spartiate')).toBeNull();
  });

  it('PC : marque Λ Spartiate, raccourcis « Ctrl N » et carte du bas', () => {
    stub(1440);
    const { container } = render(<TabRail items={items} settingsItem={settingsItem} activeId="today" onSelect={() => undefined} shortcutHints={hints} footer={<p>{'carte'}</p>} />);
    expect(container.querySelector('nav')).toHaveAttribute('data-layout', 'pc');
    expect(screen.getByText('Λ')).toBeInTheDocument();
    expect(screen.getByText('Spartiate')).toBeInTheDocument();
    expect(screen.getByText('Ctrl 1')).toBeInTheDocument();
    expect(screen.getByText('Ctrl 5')).toBeInTheDocument();
    expect(screen.getByText('carte')).toBeInTheDocument();
  });

  it('jamais de libellé vertical : aucune règle writing-mode dans la feuille de style', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/ui/TabRail.css', 'utf8');
    expect(css).not.toMatch(/writing-mode|rotate\(/);
  });
});

/** COQUILLE-PC-b (§ 18.1, C-192) : barre latérale PC rétractable, chaque onglet reste atteignable et nommé. */
describe('TabRail : repli de la barre latérale PC', () => {
  const rail = () => render(<TabRail items={items} settingsItem={settingsItem} activeId="today" onSelect={() => undefined} />);

  it('un bouton replie puis déploie la barre (aria-expanded, état exposé), au clavier comme à la souris', () => {
    rail();
    const nav = screen.getByRole('navigation');
    const toggle = screen.getByRole('button', { name: t('nav.sidebar') });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(nav).not.toHaveAttribute('data-collapsed');
    fireEvent.click(toggle);
    expect(nav).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByRole('button', { name: t('nav.sidebar') })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: t('nav.sidebar') }));
    expect(nav).not.toHaveAttribute('data-collapsed');
  });

  it('repliée, les onglets gardent leur nom accessible (libellé lu, hors de l’écran)', () => {
    rail();
    fireEvent.click(screen.getByRole('button', { name: t('nav.sidebar') }));
    expect(screen.getByRole('button', { name: 'Entraînement' })).toBeInTheDocument();
  });

  it('le bouton de repli est avant la liste des onglets : Plus reste le dernier bouton', () => {
    rail();
    expect(screen.getAllByRole('button').at(-1)).toHaveTextContent('Plus');
  });
});

describe('TabRail : iPhone', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('aucun bouton de repli sous 1 024 px', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<TabRail items={items} settingsItem={settingsItem} activeId="today" onSelect={() => undefined} />);
    expect(screen.queryByRole('button', { name: t('nav.sidebar') })).toBeNull();
  });
});
