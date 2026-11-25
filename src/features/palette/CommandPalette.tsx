import { useMemo, useState } from 'react';
import { tPalette } from '../../i18n/paletteText';
import { useFocusTrap } from '../../ui';
import { useNavigationStore } from '../app/navigation';
import { buildPaletteCommands, filterPaletteCommands, type PaletteCommand } from './commands';
import './CommandPalette.css';

/**
 * Palette de commandes Ctrl+K (C-135, D-480, § 18.1 b), PC seulement : aller à un écran, démarrer la séance du jour, ajouter un repas.
 * Bloc chargé à la demande avec son catalogue de textes ; le raccourci et la surcouche `commandPalette` restent dans le départ.
 */
export function CommandPalette() {
  const open = useNavigationStore((s) => s.overlays.at(-1)?.kind === 'commandPalette');
  return open ? <CommandPaletteDialog /> : null;
}

function CommandPaletteDialog() {
  const closeOverlay = useNavigationStore((s) => s.closeOverlay);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const all = useMemo(() => buildPaletteCommands(), []);
  const results = useMemo(() => filterPaletteCommands(all, query), [all, query]);
  const ref = useFocusTrap<HTMLElement>({ active: true, onEscape: closeOverlay });
  const current = results[Math.min(active, results.length - 1)];

  const run = (item: PaletteCommand | undefined): void => {
    if (!item) return;
    const navigation = useNavigationStore.getState();
    navigation.closeOverlay();
    navigation.navigate(item.route);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((now) => (Math.min(now, results.length - 1) + step + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(current);
    }
  };

  return (
    <div className="ct-palette__backdrop">
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={tPalette('title')} className="ct-palette">
        <input
          type="text"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={results.length > 0 ? 'ct-palette-list' : undefined}
          aria-activedescendant={current ? `ct-palette-${current.id}` : undefined}
          aria-label={tPalette('inputLabel')}
          placeholder={tPalette('inputPlaceholder')}
          className="ct-palette__input"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        {results.length === 0 ? (
          <p role="status" className="ct-palette__empty">
            {tPalette('empty')}
          </p>
        ) : (
          <ul id="ct-palette-list" role="listbox" aria-label={tPalette('listLabel')} className="ct-palette__list">
            {results.map((item) => (
              <li
                key={item.id}
                id={`ct-palette-${item.id}`}
                role="option"
                aria-selected={item === current}
                className="ct-palette__option"
                onMouseMove={() => setActive(results.indexOf(item))}
                onClick={() => run(item)}
              >
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
