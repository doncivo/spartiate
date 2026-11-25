import { useEffect, useState, useSyncExternalStore } from 'react';
import { todayLocal, type Clock } from '../../domain/clock';
import type { LocalDate } from '../../domain/types';
import { t, type PlainMessageKey } from '../../i18n';
import { statusLine } from '../sync/syncText';
import { useAppContainer } from './AppContainerContext';
import './ShellChrome.css';

/**
 * C-074, C-124 : jour local de l'horloge, relu à minuit et au retour au premier plan (veille longue) : l'écran ouvert la nuit ou
 * laissé ouvert ne garde pas la date de la veille. Hébergé ici (module du départ) pour ne pas ajouter de module au bundle de départ.
 */
export function useLocalDay(clock: Clock): LocalDate {
  const [day, setDay] = useState(() => todayLocal(clock));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = (): void => {
      setDay(todayLocal(clock));
      clearTimeout(timer);
      const now = new Date(clock.nowMs());
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
      timer = setTimeout(refresh, Math.max(1000, midnight - now.getTime() + 50));
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [clock]);
  return day;
}

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
