import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MissingValue } from './MissingValue';
import { StatusBanner } from './StatusBanner';

/** ERGO-02 (Degrades-apres.dc.html) : un tiret et sa raison, jamais un faux zéro ; un bandeau fin teinté, jamais une carte de plus. */
afterEach(cleanup);

describe('ERGO-02 : MissingValue', () => {
  it('un tiret « — » (décoratif) suivi de sa raison, lue par les lecteurs d’écran', () => {
    const { container } = render(<MissingValue reason="pas de nuit importée" />);
    const root = container.querySelector('.ct-missing');
    expect(root).not.toBeNull();
    expect(root?.querySelector('.ct-missing__dash')).toHaveTextContent('—');
    expect(root?.querySelector('.ct-missing__dash')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('pas de nuit importée')).toHaveClass('ct-missing__reason');
    expect(container.textContent).not.toMatch(/\b0\b/);
  });
});

describe('ERGO-02 : bandeau fin teinté', () => {
  it('sans teinte : bandeau d’avant ; avec teinte : classe de teinte (information, avertissement)', () => {
    const { container, rerender } = render(<StatusBanner message="Hors ligne" />);
    expect(container.querySelector('.ct-status-banner')?.className).toBe('ct-status-banner');
    rerender(<StatusBanner message="Hors ligne" tone="info" />);
    expect(container.querySelector('.ct-status-banner')).toHaveClass('ct-status-banner--info');
    rerender(<StatusBanner message="Signature" tone="warn" />);
    expect(container.querySelector('.ct-status-banner')).toHaveClass('ct-status-banner--warn');
  });
});
