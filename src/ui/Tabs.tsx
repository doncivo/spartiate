import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import './Tabs.css';

export interface TabItem<V extends string> {
  readonly id: V;
  readonly label: string;
}

export interface TabsProps<V extends string> {
  /** Nom accessible de la barre (texte résolu par l'appelant). */
  readonly label: string;
  /** Préfixe des identifiants des onglets et du panneau (unique dans la page). */
  readonly idBase: string;
  readonly items: readonly TabItem<V>[];
  readonly value: V;
  readonly onChange: (value: V) => void;
  /** Contenu du panneau de l'onglet choisi ; seul ce panneau est rendu (chaque onglet se charge à son ouverture). */
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * PROG-0301a (BL-177, D-701, D-719) : barre d'onglets accessible, aspect de `SegmentedControl` (boutons de 44 pt, tokens de la charte).
 * Rôles `tablist`, `tab` et `tabpanel` ; un seul arrêt de tabulation (l'onglet choisi) ; ← et → passent à l'onglet voisin en boucle, Début et
 * Fin au premier et au dernier ; l'activation suit le focus. Sur une largeur étroite, la barre défile horizontalement, l'onglet choisi visible.
 * Importé directement (`../../ui/Tabs`), jamais par le barrel : il reste dans le bloc à la demande de son hôte.
 */
export function Tabs<V extends string>({ label, idBase, items, value, onChange, children, className }: TabsProps<V>) {
  const list = useRef<HTMLDivElement>(null);
  const tabId = (id: V): string => `${idBase}-tab-${id}`;
  const panelId = `${idBase}-panel`;
  const current = items.some((item) => item.id === value) ? value : items[0]?.id;

  // Onglet choisi gardé visible dans la barre qui défile : seul le défilement horizontal de la liste bouge, jamais celui de la page.
  useEffect(() => {
    const el = list.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !tab) return;
    if (tab.offsetLeft < el.scrollLeft) el.scrollLeft = tab.offsetLeft;
    else if (tab.offsetLeft + tab.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = tab.offsetLeft + tab.offsetWidth - el.clientWidth;
  }, [current]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const last = items.length - 1;
    const next = event.key === 'ArrowRight' ? (index + 1) % items.length : event.key === 'ArrowLeft' ? (index - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (next === null) return;
    event.preventDefault();
    const item = items[next];
    if (!item) return;
    onChange(item.id);
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div className={className ? `ct-tabs ${className}` : 'ct-tabs'}>
      <div ref={list} className="ct-tabs__list" role="tablist" aria-label={label} aria-orientation="horizontal">
        {items.map((item, index) => {
          const selected = item.id === current;
          return (
            <button
              key={item.id}
              id={tabId(item.id)}
              type="button"
              role="tab"
              className="ct-tabs__tab"
              aria-selected={selected}
              aria-controls={selected ? panelId : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {current === undefined ? null : (
        <div id={panelId} className="ct-tabs__panel" role="tabpanel" aria-labelledby={tabId(current)} tabIndex={0}>
          {children}
        </div>
      )}
    </div>
  );
}
