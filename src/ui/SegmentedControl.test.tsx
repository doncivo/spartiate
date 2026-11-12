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

  it('FIX-0173 : ResizeObserver sur la rangée et ses choix recalcule le fondu (police plus grande, libellé changé) ; déconnecté au démontage', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const observers: { callback: ResizeObserverCallback; targets: Element[]; disconnected: boolean }[] = [];
    class FakeResizeObserver {
      private readonly entry: (typeof observers)[number];
      constructor(callback: ResizeObserverCallback) {
        this.entry = { callback, targets: [], disconnected: false };
        observers.push(this.entry);
      }
      observe(target: Element): void {
        this.entry.targets.push(target);
      }
      unobserve(): void {}
      disconnect(): void {
        this.entry.disconnected = true;
      }
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    try {
      const view = render(<SegmentedControl label="Sections" value="a" onChange={() => undefined} options={options} scrollable />);
      const group = screen.getByRole('radiogroup', { name: 'Sections' });
      const live = observers.filter((o) => o.targets.includes(group));
      expect(live).toHaveLength(1);
      expect(live[0]?.targets).toEqual(expect.arrayContaining(screen.getAllByRole('radio')));
      measure(group, { scrollWidth: 600, clientWidth: 400, scrollLeft: 0 });
      live[0]?.callback([], live[0] as unknown as ResizeObserver);
      expect(group).toHaveAttribute('data-fade-end', 'true');
      measure(group, { scrollWidth: 400, clientWidth: 400, scrollLeft: 0 });
      live[0]?.callback([], live[0] as unknown as ResizeObserver);
      expect(group).not.toHaveAttribute('data-fade-end');
      view.unmount();
      expect(live[0]?.disconnected).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('FIX-0173 : sans ResizeObserver, repli sur le redimensionnement de la fenêtre', () => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('ResizeObserver', undefined);
    try {
      render(<SegmentedControl label="Sections" value="a" onChange={() => undefined} options={options} scrollable />);
      const group = screen.getByRole('radiogroup', { name: 'Sections' });
      measure(group, { scrollWidth: 600, clientWidth: 400, scrollLeft: 0 });
      fireEvent(window, new Event('resize'));
      expect(group).toHaveAttribute('data-fade-end', 'true');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('une rangée non défilante n’a jamais de fondu', () => {
    render(<SegmentedControl label="Sections" value="a" onChange={() => undefined} options={options} />);
    const group = screen.getByRole('radiogroup', { name: 'Sections' });
    measure(group, { scrollWidth: 600, clientWidth: 400, scrollLeft: 0 });
    fireEvent.scroll(group);
    expect(group).not.toHaveAttribute('data-fade-end');
  });
});
