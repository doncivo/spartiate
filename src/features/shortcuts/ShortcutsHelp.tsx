import { useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n';
import { tShortcutsUi } from '../../i18n/shortcutsUiText';
import { Button, useFocusTrap } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useNavigationStore } from '../app/navigation';
import { lazyScreen } from '../app/lazyScreens';
import { buildHelpGroups } from '../app/shortcutsHelp';
import './ShortcutsHelp.css';

/**
 * C-135 (D-480, D-596) : la palette de commandes Ctrl+K est montée par cet hôte (déjà hors du départ), mais son bloc et son catalogue de textes ne se
 * chargent qu'à sa première ouverture (jamais préchargé, aucun repli).
 */
const CommandPalette = lazyScreen<object>(() => import('../palette/CommandPalette').then((m) => ({ default: m.CommandPalette })), undefined, { onDemand: true });

/**
 * Fenêtre « Raccourcis clavier » (P-08), ouverte par Ctrl+/ depuis n'importe quel écran. Montée par la coquille quand la
 * surcouche `shortcutsHelp` est au sommet de la pile. PC seulement : le raccourci n'est enregistré que par la coquille PC.
 */
export function ShortcutsHelp() {
  const container = useAppContainer();
  const top = useNavigationStore((s) => s.overlays.at(-1)?.kind);
  // C-135 (D-480, D-596) : Ctrl+K, enregistré par ce bloc (monté sur PC seulement, préchargé au repos) : ouvre la palette, la referme ; ignoré sous une feuille ou une fenêtre modale.
  useEffect(
    () =>
      container.shortcuts.register('app.palette', (): boolean => {
        const navigation = useNavigationStore.getState();
        if (navigation.overlays.at(-1)?.kind === 'commandPalette') navigation.closeOverlay();
        else if (document.querySelector('[aria-modal="true"]') !== null) return false;
        else navigation.openOverlay({ kind: 'commandPalette' });
        return true;
      }),
    [container],
  );
  return top === 'shortcutsHelp' ? <ShortcutsHelpDialog /> : top === 'commandPalette' ? <CommandPalette /> : null;
}

function ShortcutsHelpDialog() {
  const container = useAppContainer();
  const closeOverlay = useNavigationStore((s) => s.closeOverlay);
  const [query, setQuery] = useState('');
  // Raccourcis ayant un gestionnaire à l'ouverture : ceux de l'écran courant (la fenêtre n'en ajoute pas pour ces portées).
  const activeIds = useMemo(() => container.shortcuts.activeIds(), [container]);
  const ref = useFocusTrap<HTMLElement>({ active: true, onEscape: closeOverlay });
  const groups = buildHelpGroups({ activeIds, query });

  return (
    <div className="ct-shortcuts__backdrop">
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ct-shortcuts-title" className="ct-shortcuts">
        <header className="ct-shortcuts__header">
          <h2 id="ct-shortcuts-title" className="ct-shortcuts__title">
            {tShortcutsUi('title')}
          </h2>
          <Button variant="secondary" onClick={closeOverlay}>
            {t('common.close')}
          </Button>
        </header>
        <input
          type="search"
          className="ct-shortcuts__filter"
          aria-label={tShortcutsUi('filterLabel')}
          placeholder={tShortcutsUi('filterPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {/* Zone défilante atteignable au clavier (Tab, puis ↑ ↓ Page ↑ Page ↓ défilent sans souris). */}
        <div className="ct-shortcuts__scroll" tabIndex={0} role="region" aria-label={tShortcutsUi('tableLabel')}>
          {groups.length === 0 ? (
            <p className="ct-shortcuts__empty" role="status">
              {tShortcutsUi('empty')}
            </p>
          ) : (
            <table className="ct-shortcuts__table">
              <caption className="ct-shortcuts__srOnly">{tShortcutsUi('tableLabel')}</caption>
              <thead className="ct-shortcuts__srOnly">
                <tr>
                  <th scope="col">{tShortcutsUi('colKeys')}</th>
                  <th scope="col">{tShortcutsUi('colAction')}</th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.scope} data-scope={group.scope}>
                  <tr>
                    <th scope="colgroup" colSpan={2} className="ct-shortcuts__group">
                      {group.label}
                    </th>
                  </tr>
                  {group.entries.map((entry) => (
                    <tr key={entry.id} className="ct-shortcuts__row" data-dimmed={entry.dimmed || undefined} data-shortcut={entry.id}>
                      <td className="ct-shortcuts__keys">
                        <kbd className="ct-kbd">
                          <span aria-hidden="true">{entry.keys}</span>
                          <span className="ct-shortcuts__srOnly">{entry.spoken}</span>
                        </kbd>
                      </td>
                      <td>
                        {entry.description}
                        {entry.note && <span className="ct-shortcuts__note"> {entry.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
