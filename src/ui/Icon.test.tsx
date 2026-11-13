import { Search } from 'lucide-react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';

describe('Icon', () => {
  it('est décorative et masquée aux lecteurs d’écran par défaut', () => {
    const { container } = render(<Icon icon={Search} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    expect(svg).not.toHaveAttribute('aria-label');
  });

  it('applique la taille, la couleur et l’épaisseur du trait des maquettes par défaut', () => {
    const { container } = render(<Icon icon={Search} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-width', '1.8');
  });

  // ERGO-01b (décision d'Ali du 13/11) : icônes homogènes. La taille se choisit dans l'échelle nommée ; trait et couleur ne sont plus au
  // choix de l'appelant (ancienne attente « taille, couleur et épaisseur personnalisées » remplacée, voir src/ui/ErgoShared.test.tsx).
  it('accepte une taille nommée de l’échelle partagée, trait et couleur inchangés', () => {
    const { container } = render(<Icon icon={Search} size="sm" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-width', '1.8');
  });

  it('devient porteuse de sens quand un libellé accessible est fourni', () => {
    render(<Icon icon={Search} label="Rechercher" />);
    const img = screen.getByRole('img', { name: 'Rechercher' });
    expect(img).not.toHaveAttribute('aria-hidden');
  });
});
