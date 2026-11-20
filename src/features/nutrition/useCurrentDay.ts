import { useEffect, useState } from 'react';
import { todayLocal, type Clock } from '../../domain/clock';
import type { LocalDate } from '../../domain/types';

/** Délai jusqu'à la prochaine minuit locale, plus une seconde de garde (borné : un minuteur ne dépasse pas 24 h + 1 s). */
function msUntilNextMidnight(nowMs: number): number {
  const d = new Date(nowMs);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 1, 0).getTime();
  return Math.max(1_000, next - nowMs);
}

/**
 * Jour local courant, relu au retour au premier plan, au focus et à minuit (C-096) : un écran resté ouvert d'un jour à l'autre ne rattache
 * jamais une saisie à la veille.
 */
export function useCurrentDay(clock: Clock): LocalDate {
  const [day, setDay] = useState<LocalDate>(() => todayLocal(clock));
  useEffect(() => {
    const refresh = (): void => setDay(todayLocal(clock));
    const onVisible = (): void => {
      if (document.visibilityState !== 'hidden') refresh();
    };
    refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    const timer = window.setTimeout(refresh, msUntilNextMidnight(clock.nowMs()));
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      window.clearTimeout(timer);
    };
    // `day` : le minuteur est réarmé après chaque changement de jour.
  }, [clock, day]);
  return day;
}
