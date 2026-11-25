import { useEffect } from 'react';
import { todayLocal, type Clock } from '../../domain/clock';
import type { LocalDate } from '../../domain/types';
import { useAppStore } from './appStore';

/**
 * C-074, C-124 : jour local de l'horloge, relu à minuit et au retour au premier plan (veille longue) : l'écran ouvert la nuit ou laissé
 * ouvert ne garde pas la date de la veille. Le jour courant vit dans `appStore.day` : la barre PC (coquille, départ) le lit sans importer
 * ce module, qui n'est chargé qu'avec Aujourd'hui (bundle de départ).
 */
export function useLocalDay(clock: Clock): LocalDate {
  const stored = useAppStore((state) => state.day);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = (): void => {
      useAppStore.getState().setDay(todayLocal(clock));
      clearTimeout(timer);
      const now = new Date(clock.nowMs());
      timer = setTimeout(refresh, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 50);
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [clock]);
  return stored ?? todayLocal(clock);
}
