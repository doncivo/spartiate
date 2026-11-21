import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLayout } from './useLayout';
import './ContextMenu.css';

export interface ContextMenuItem {
  readonly id: string;
  readonly label: string;
  /** Même fonction que le bouton de l'élément : le menu n'ajoute jamais d'action. */
  readonly onSelect: () => void;
  readonly danger?: boolean;
}

/** Propriétés à poser sur l'élément de liste (vides sur iPhone). */
export interface ContextMenuBind {
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onDoubleClick?: () => void;
}

export interface ContextMenuZoneProps {
  items: readonly ContextMenuItem[];
  /** Nom accessible du menu (ex. « Actions de Squat »). */
  menuLabel: string;
  /** Double-clic : action principale (ouvrir), PC seulement. */
  onActivate?: () => void;
  children: (bind: ContextMenuBind) => ReactNode;
}

interface Opened {
  readonly x: number;
  readonly y: number;
  readonly origin: HTMLElement;
}

/**
 * Menu contextuel PC (PRD § 18.1 : clic droit, double-clic) : clic droit, touche Menu ou Maj+F10 ouvrent la liste des actions de
 * l'élément ; flèches, Entrée, Échap (focus rendu à l'élément). Sur iPhone (< 1 024 px) : aucun effet, geste natif intact.
 *
 * @example
 * <ContextMenuZone items={items} menuLabel={label} onActivate={open}>{(bind) => <li {...bind}>…</li>}</ContextMenuZone>
 */
export function ContextMenuZone({ items, menuLabel, onActivate, children }: ContextMenuZoneProps) {
  const pc = useLayout() === 'pc';
  const [opened, setOpened] = useState<Opened | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!opened) return undefined;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      setOpened(null);
    };
    document.addEventListener('pointerdown', away);
    window.addEventListener('blur', away);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('blur', away);
    };
  }, [opened]);

  const close = (restore: boolean) => {
    const origin = opened?.origin;
    setOpened(null);
    if (restore) origin?.focus();
  };

  const bind: ContextMenuBind = pc
    ? {
        onContextMenu: (event) => {
          event.preventDefault();
          setOpened({ x: event.clientX, y: event.clientY, origin: event.currentTarget });
        },
        onKeyDown: (event) => {
          if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          setOpened({ x: rect.left + 16, y: rect.top + Math.min(rect.height, 32), origin: event.currentTarget });
        },
        ...(onActivate ? { onDoubleClick: onActivate } : {}),
      }
    : {};

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const index = entries.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      entries[(index + step + entries.length) % entries.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      entries[event.key === 'Home' ? 0 : entries.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  return (
    <>
      {children(bind)}
      {opened && pc
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={menuLabel}
              className="ct-context-menu"
              style={{ left: Math.max(0, Math.min(opened.x, window.innerWidth - 220)), top: Math.max(0, Math.min(opened.y, window.innerHeight - 8 - items.length * 44)) }}
              onKeyDown={onMenuKeyDown}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="ct-context-menu__item"
                  data-danger={item.danger ? 'true' : undefined}
                  onClick={() => {
                    close(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
