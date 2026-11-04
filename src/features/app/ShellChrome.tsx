import { useEffect, useState, useSyncExternalStore } from 'react';
import { t, type PlainMessageKey } from '../../i18n';
import { statusLine } from '../sync/syncText';
import { useAppContainer } from './AppContainerContext';
import './ShellChrome.css';

const subscribeNone = (): (() => void) => () => undefined;

/**
 * Carte du bas de la barre latérale PC (maquettes PC-*.html) : « PC · Bureau » et l'état RÉEL de la synchro (même texte que la ligne de
 * Plus › Synchronisation) ; sans synchro dans ce build, un état explicite.
 */
export function SidebarSyncCard() {
  const { sync } = useAppContainer();
  const status = useSyncExternalStore(sync ? sync.subscribe : subscribeNone, () => (sync ? sync.status() : null));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="ct-sidebar-card" role="group" aria-label={t('nav.deviceCard.label')}>
      <p className="ct-sidebar-card__device">{t('nav.deviceCard.device')}</p>
      <p className="ct-sidebar-card__state" aria-live="polite">
        {status ? statusLine(status, now) : t('nav.deviceCard.noSync')}
      </p>
    </div>
  );
}

/** Barre supérieure PC : titre de la section en capitales (Cinzel) et, pour Aujourd'hui, la date du jour. */
export function PcTopBar({ labelKey, date }: { readonly labelKey: PlainMessageKey; readonly date?: string | undefined }) {
  return (
    <header className="ct-topbar">
      <p className="ct-topbar__title">{t(labelKey)}</p>
      {date ? <p className="ct-topbar__date">{date}</p> : null}
    </header>
  );
}
