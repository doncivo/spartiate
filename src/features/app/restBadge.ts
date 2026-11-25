import { t } from '../../i18n';
import { tSession } from '../../i18n/trainingSessionText';
import { logDesktopFailure } from '../../platform';
import type { AppContainer } from './container';

/**
 * BL-118 (D-594, D-596) : badge du minuteur de repos dans le titre de la fenêtre PC. Module importé par la séance (bloc à la demande), jamais par le
 * départ : son code et son texte ne pèsent rien tant qu'aucun repos ne démarre. « Repos 1:23 · Spartiate », recalculé chaque seconde depuis l'échéance.
 */
let timer: ReturnType<typeof setInterval> | null = null;
let last: string | null = null;
let endMs: number | null = null;

/** « Repos 1:23 · Spartiate » : le reste arrondi à la seconde supérieure (jamais 0:00 tant que le repos court). */
export function restBadgeTitle(remainingMs: number): string {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return tSession('restBadge', { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` });
}

function stop(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

/** Échéance du repos (ms, horloge du conteneur) ou null ; sans PC (`container.desktop` nul) : rien. */
export function setRestBadge(container: Pick<AppContainer, 'desktop' | 'clock'>, end: number | null): void {
  const desktop = container.desktop;
  if (!desktop) return;
  endMs = end;
  const push = (title: string): void => {
    if (title === last) return;
    last = title;
    desktop.setWindowTitle(title).catch((error: unknown) => logDesktopFailure('window-title', error));
  };
  const refresh = (): void => {
    const remaining = endMs === null ? 0 : endMs - container.clock.nowMs();
    if (remaining <= 0) {
      stop();
      if (last !== null) push(t('app.name'));
      return;
    }
    push(restBadgeTitle(remaining));
    timer ??= setInterval(refresh, 1000);
  };
  stop();
  refresh();
}

/** Remet le titre simple et coupe la minuterie (tests, fermeture). */
export function clearRestBadge(container: Pick<AppContainer, 'desktop' | 'clock'>): void {
  setRestBadge(container, null);
}
