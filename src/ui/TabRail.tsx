import { useRef, type ReactNode } from 'react';
import { t, type PlainMessageKey } from '../i18n';
import { TabIcon } from './TabIcon';
import { useLayout } from './useLayout';
import './TabRail.css';

/**
 * Forme structurelle de `TabDefinition` (src/features/app/navigation.ts) : la
 * feature passe `TABS` directement (sous-ensemble compatible), sans que
 * `src/ui` importe `src/features` (frontière de couches, ADR 0001).
 */
export interface TabRailItem {
  readonly id: string;
  readonly labelKey: PlainMessageKey;
  /** Variable CSS de la couleur de l'onglet ; absente : jetons de la charte (§ 18.4). */
  readonly colorVar?: string;
}

export interface TabRailProps {
  /** Onglets, dans l'ordre d'affichage. */
  items: readonly TabRailItem[];
  /** Dernier onglet (Plus), affiché à la suite des autres. */
  settingsItem: TabRailItem;
  activeId: string;
  onSelect: (id: string) => void;
  /** PC : raccourci affiché à droite de chaque onglet (« Ctrl 1 »), par identifiant d'onglet. */
  shortcutHints?: Readonly<Record<string, string>>;
  /** PC : carte du bas de la barre latérale (état de la synchro). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Navigation des cinq sections, selon la mise en page (rupture 1 024 px, `useLayout`) :
 * - iPhone : barre basse, icône au-dessus d'un libellé horizontal ;
 * - PC : barre latérale des maquettes (marque Λ Spartiate, icône et libellé horizontaux, raccourci, carte d'état en bas).
 * Jamais de libellé vertical. L'onglet actif est en bronze (charte § 18.4).
 *
 * @example
 * <TabRail items={RAIL_ITEMS} settingsItem={MORE_ITEM} activeId={route.tab} onSelect={goToTab} />
 */
export function TabRail({ items, settingsItem, activeId, onSelect, shortcutHints, footer, className }: TabRailProps) {
  const layout = useLayout();
  const pc = layout === 'pc';
  const allItems = [...items, settingsItem];
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = pc ? 'ArrowDown' : 'ArrowRight';
    const previous = pc ? 'ArrowUp' : 'ArrowLeft';
    let nextIndex: number | null = null;
    if (event.key === next) nextIndex = (index + 1) % allItems.length;
    else if (event.key === previous) nextIndex = (index - 1 + allItems.length) % allItems.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = allItems.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const target = allItems[nextIndex];
    if (target) refs.current[target.id]?.focus();
  };

  const renderTab = (item: TabRailItem, index: number) => {
    const active = item.id === activeId;
    const hint = pc ? shortcutHints?.[item.id] : undefined;
    return (
      <button
        key={item.id}
        type="button"
        ref={(el) => {
          refs.current[item.id] = el;
        }}
        aria-current={active ? 'page' : undefined}
        onClick={() => onSelect(item.id)}
        onKeyDown={(event) => handleKeyDown(event, index)}
        className="ct-tab-rail__tab"
        data-active={active ? 'true' : undefined}
      >
        <TabIcon id={item.id} />
        <span className="ct-tab-rail__label">{t(item.labelKey)}</span>
        {hint ? (
          <span className="ct-tab-rail__hint" aria-hidden="true">
            {hint}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <nav aria-label={t('nav.primaryLabel')} data-layout={layout} className={['ct-tab-rail', className].filter(Boolean).join(' ')}>
      {pc ? (
        <div className="ct-tab-rail__brand">
          <span className="ct-tab-rail__mark" aria-hidden="true">
            {'Λ'}
          </span>
          <span className="ct-tab-rail__name">{t('app.name')}</span>
        </div>
      ) : null}
      <div className="ct-tab-rail__list">{allItems.map((item, index) => renderTab(item, index))}</div>
      {pc ? <div className="ct-tab-rail__footer">{footer}</div> : null}
    </nav>
  );
}
