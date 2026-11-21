import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PC_MEDIA_QUERY } from './useLayout';
import { ContextMenuZone, type ContextMenuItem } from './ContextMenu';

/** COQUILLE-PC-a (§ 18.1, C-192) : menu contextuel commun, PC seulement, mêmes actions que les boutons de l'élément. */
function viewport(width: number): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === PC_MEDIA_QUERY && width >= 1024,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

const MENU_LABEL = 'Actions de la ligne';

function Row(props: { items: readonly ContextMenuItem[]; onActivate?: () => void }) {
  return (
    <ContextMenuZone items={props.items} menuLabel={MENU_LABEL} {...(props.onActivate ? { onActivate: props.onActivate } : {})}>
      {(bind) => (
        <button type="button" data-testid="row" {...bind}>
          {MENU_LABEL}
        </button>
      )}
    </ContextMenuZone>
  );
}
const makeItems = () => {
  const first = vi.fn();
  const second = vi.fn();
  const items: ContextMenuItem[] = [
    { id: 'a', label: 'Premier', onSelect: first },
    { id: 'b', label: 'Second', onSelect: second },
  ];
  return { first, second, items };
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('menu contextuel (PC)', () => {
  it('le clic droit ouvre un menu nommé avec les actions, sans menu natif', () => {
    viewport(1440);
    render(<Row items={makeItems().items} />);
    const notPrevented = fireEvent.contextMenu(screen.getByTestId('row'), { clientX: 40, clientY: 50 });
    expect(notPrevented).toBe(false);
    const menu = screen.getByRole('menu', { name: 'Actions de la ligne' });
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
  });

  it('choisir une action l’exécute une fois et ferme le menu', () => {
    viewport(1440);
    const { first, items } = makeItems();
    render(<Row items={items} />);
    fireEvent.contextMenu(screen.getByTestId('row'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Premier' }));
    expect(first).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Échap ferme le menu et rend le focus à la ligne', () => {
    viewport(1440);
    render(<Row items={makeItems().items} />);
    const row = screen.getByTestId('row');
    row.focus();
    fireEvent.contextMenu(row);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(row).toHaveFocus();
  });

  it('touche Menu et Maj+F10 ouvrent le menu au clavier ; la première action prend le focus ; flèches et Entrée', () => {
    viewport(1440);
    const { second, items } = makeItems();
    render(<Row items={items} />);
    const row = screen.getByTestId('row');
    row.focus();
    fireEvent.keyDown(row, { key: 'F10', shiftKey: true });
    expect(screen.getByRole('menuitem', { name: 'Premier' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Second' })).toHaveFocus();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Second' }));
    expect(second).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(row, { key: 'ContextMenu' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('un clic ailleurs ferme le menu', () => {
    viewport(1440);
    render(<Row items={makeItems().items} />);
    fireEvent.contextMenu(screen.getByTestId('row'));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('le double-clic appelle l’action principale', () => {
    viewport(1440);
    const onActivate = vi.fn();
    render(<Row items={makeItems().items} onActivate={onActivate} />);
    fireEvent.doubleClick(screen.getByTestId('row'));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('iPhone (< 1 024 px) : ni menu ni double-clic, le geste natif reste intact', () => {
    viewport(440);
    const onActivate = vi.fn();
    render(<Row items={makeItems().items} onActivate={onActivate} />);
    const notPrevented = fireEvent.contextMenu(screen.getByTestId('row'));
    expect(notPrevented).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.doubleClick(screen.getByTestId('row'));
    expect(onActivate).not.toHaveBeenCalled();
  });
});
