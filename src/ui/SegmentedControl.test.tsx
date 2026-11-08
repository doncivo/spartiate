import { render, screen } from '@testing-library/react';
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
