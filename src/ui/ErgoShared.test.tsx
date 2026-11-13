import { Search } from 'lucide-react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HeroFigure } from './HeroFigure';
import { Icon } from './Icon';
import { ICON_SIZE, ICON_STROKE } from './iconStyle';
import { Rule } from './Rule';
import { SectionTitle } from './SectionTitle';
import { TabRail } from './TabRail';

/**
 * ERGO-01b (décision d'Ali du 13/11, règles de tous les autres écrans) : composants partagés de src/ui. Titre de section en petites capitales
 * bronze espacées, chiffre héros, filet fin, icônes Lucide homogènes, indicateur bronze de l'onglet actif.
 */

const GOAL = 'Objectif';
const HISTORY = 'Historique';

describe('ERGO-01b : titre de section', () => {
  it('h2 par défaut, classe partagée (petites capitales bronze), identifiant transmis', () => {
    render(<SectionTitle id="x-title">{GOAL}</SectionTitle>);
    const heading = screen.getByRole('heading', { level: 2, name: 'Objectif' });
    expect(heading).toHaveClass('ct-section-title');
    expect(heading).toHaveAttribute('id', 'x-title');
  });

  it('niveau 3 sur demande, classe de l’écran ajoutée à la classe partagée', () => {
    render(
      <SectionTitle level={3} className="ct-x__title">
        {HISTORY}
      </SectionTitle>,
    );
    const heading = screen.getByRole('heading', { level: 3, name: 'Historique' });
    expect(heading).toHaveClass('ct-section-title', 'ct-x__title');
  });
});

describe('ERGO-01b : chiffre héros', () => {
  it('le chiffre porte la classe héros (Cinzel bronze), l’unité à part ; le texte de la ligne se lit d’un trait', () => {
    const { container } = render(<HeroFigure value="1 900" unit="kcal par jour" />);
    const hero = container.querySelector('.ct-hero');
    expect(hero).not.toBeNull();
    expect(hero?.querySelector('.ct-hero__num')).toHaveTextContent('1 900');
    expect(hero?.querySelector('.ct-hero__unit')).toHaveTextContent('kcal par jour');
    expect(hero).toHaveTextContent('1 900 kcal par jour');
  });

  it('sans unité : le chiffre seul', () => {
    const { container } = render(<HeroFigure value="12" />);
    expect(container.querySelector('.ct-hero__num')).toHaveTextContent('12');
    expect(container.querySelector('.ct-hero__unit')).toBeNull();
  });
});

describe('ERGO-01b : filet', () => {
  it('filet fin décoratif (classe partagée, masqué aux lecteurs d’écran)', () => {
    const { container } = render(<Rule />);
    const hr = container.querySelector('hr');
    expect(hr).toHaveClass('ct-rule');
    expect(hr).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ERGO-01b : icônes homogènes', () => {
  it('trois tailles nommées, un seul trait', () => {
    expect(ICON_SIZE).toEqual({ sm: 16, md: 20, lg: 24 });
    expect(ICON_STROKE).toBe(1.8);
  });

  it.each([
    ['sm', '16'],
    ['md', '20'],
    ['lg', '24'],
  ] as const)('taille %s : %s px, trait partagé', (size, px) => {
    const { container } = render(<Icon icon={Search} size={size} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', px);
    expect(svg).toHaveAttribute('height', px);
    expect(svg).toHaveAttribute('stroke-width', String(ICON_STROKE));
  });
});

describe('ERGO-01b : onglet actif à indicateur bronze', () => {
  const ITEMS = [
    { id: 'today', labelKey: 'nav.tabs.today' },
    { id: 'training', labelKey: 'nav.tabs.training' },
  ] as const;
  const MORE = { id: 'more', labelKey: 'nav.tabs.more' } as const;

  function mockViewport(width: number): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: width >= 1024 && query.includes('min-width: 1024px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  }

  it.each([440, 1440])('%i px : un seul onglet actif (aria-current, data-active porteur de l’indicateur), icônes au trait partagé', (width) => {
    mockViewport(width);
    const { container } = render(<TabRail items={ITEMS} settingsItem={MORE} activeId="training" onSelect={() => undefined} />);
    const current = container.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('data-active', 'true');
    expect(current[0]).toHaveClass('ct-tab-rail__tab');
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('stroke-width', String(ICON_STROKE));
      expect(svg).toHaveAttribute('width', String(ICON_SIZE.lg));
    }
    vi.unstubAllGlobals();
  });
});
