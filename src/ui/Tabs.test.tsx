import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Tabs, type TabItem } from './Tabs';

/** PROG-0301a (BL-177, D-701, D-719) : barre d'onglets accessible (tablist, tab, tabpanel), clavier ← → Début Fin, activation au focus. */
type Id = 'a' | 'b' | 'c';
const ITEMS: readonly TabItem<Id>[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bêta' },
  { id: 'c', label: 'Gamma' },
];

function Harness({ initial = 'a' as Id }: { readonly initial?: Id }) {
  const [value, setValue] = useState<Id>(initial);
  return (
    <Tabs label="Essai" idBase="essai" items={ITEMS} value={value} onChange={setValue}>
      <p>{`contenu ${value}`}</p>
    </Tabs>
  );
}

describe('Tabs (src/ui, PROG-0301a)', () => {
  afterEach(cleanup);

  it('rôles : une tablist nommée, un tab par entrée dans l’ordre, un seul tabpanel nommé par l’onglet choisi', () => {
    render(<Harness initial="b" />);
    const list = screen.getByRole('tablist', { name: 'Essai' });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Alpha', 'Bêta', 'Gamma']);
    expect(list.contains(tabs[0] ?? null)).toBe(true);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
    const panel = screen.getByRole('tabpanel', { name: 'Bêta' });
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(tabs[1]?.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.textContent).toBe('contenu b');
  });

  it('clic : choisit l’onglet et change le panneau', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: 'Gamma' }));
    expect(screen.getByRole('tab', { name: 'Gamma' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Gamma' }).textContent).toBe('contenu c');
  });

  it('clavier : → et ← en boucle, Début et Fin ; l’activation suit le focus', () => {
    render(<Harness />);
    const tab = (name: string) => screen.getByRole('tab', { name });
    tab('Alpha').focus();
    fireEvent.keyDown(tab('Alpha'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tab('Bêta'));
    expect(tab('Bêta').getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab('Bêta'), { key: 'End' });
    expect(document.activeElement).toBe(tab('Gamma'));
    fireEvent.keyDown(tab('Gamma'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tab('Alpha'));
    fireEvent.keyDown(tab('Alpha'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tab('Gamma'));
    fireEvent.keyDown(tab('Gamma'), { key: 'Home' });
    expect(document.activeElement).toBe(tab('Alpha'));
    expect(screen.getByRole('tabpanel', { name: 'Alpha' }).textContent).toBe('contenu a');
  });

  it('une autre touche ne change rien', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Alpha' }), { key: 'ArrowDown' });
    expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('true');
  });
});
