import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const options = ['a', 'b', 'c', 'd', 'e'].map((value) => ({ value, label: value.toUpperCase() }));

describe('SegmentedControl défilant (0.7.1 point 4)', () => {
  it('marque la rangée défilante et ramène le choix actif dans la zone visible', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<SegmentedControl label="Sections" value="e" onChange={() => undefined} options={options} scrollable />);
    expect(screen.getByRole('radiogroup', { name: 'Sections' })).toHaveAttribute('data-scroll', 'true');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });

  it('sans l’option, aucune marque de défilement', () => {
    render(<SegmentedControl label="Sections" value="a" onChange={() => undefined} options={options} />);
    expect(screen.getByRole('radiogroup', { name: 'Sections' })).not.toHaveAttribute('data-scroll');
  });
});

/** jsdom ne fait pas de mise en page : on fixe les mesures que lit le composant. */
function measure(group: HTMLElement, m: { scrollWidth: number; clientWidth: number; scrollLeft: number }): void {
  Object.defineProperty(group, 'scrollWidth', { configurable: true, value: m.scrollWidth });
  Object.defineProperty(group, 'clientWidth', { configurable: true, value: m.clientWidth });
  group.scrollLeft = m.scrollLeft;
}

describe('SegmentedControl défilant : fondus de bord (FIX-0115)', () => {
  it('fondu à droite tant que des choix sont cachés, à gauche une fois défilé, aucun si tout tient', () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<SegmentedControl label="Sections" value="a" onChange={() => undefined} options={options} scrollable />);
    const group = screen.getByRole('radiogroup', { name: 'Sections' });
    measure(group, { scrollWidth: 600, clientWidth: 400, scrollLeft: 0 });
    fireEvent.scroll(group);
    expect(group).toHaveAttribute('data-fade-end', 'true');
    expect(group).not.toHaveAttribute('data-fade-start');
    measure(group, { scrollWidth: 600, clientWidth: 400, scrollLeft: 120 });
    fireEvent.scroll(group);
    expect(group).toHaveAttribute('data-fade-start', 'true');
    expect(group).toHaveAttribute('data-fade-end', 'true');
    measure(group, { scrollWidth: 600, clientWidth: 400, scrollLeft: 200 });
    fireEvent.scroll(group);
    expect(group).toHaveAttribute('data-fade-start', 'true');
    expect(group).not.toHaveAttribute('data-fade-end');
    measure(group, { scrollWidth: 400, clientWidth: 400, scrollLeft: 0 });
    fireEvent.scroll(group);
    expect(group).not.toHaveAttribute('data-fade-start');
    expect(group).not.toHaveAttribute('data-fade-end');
  });

  it('une rangée non défilante n’a jamais de fondu', () => {
    render(<SegmentedControl label="Sections" value="a" onChange={() => undefined} options={options} />);
    const group = screen.getByRole('radiogroup', { name: 'Sections' });
    measure(group, { scrollWidth: 600, clientWidth: 400, scrollLeft: 0 });
    fireEvent.scroll(group);
    expect(group).not.toHaveAttribute('data-fade-end');
  });
});
